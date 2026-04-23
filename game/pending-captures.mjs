// Pure state-machine helpers for the v1.5 pending-captures store.
// Lives outside shell.js so it can be unit-tested in node without
// stubbing the entire DOM + IDB stack. shell.js imports these +
// composes them with its IDB layer + UI side-effects.
//
// Invariants enforced here (matches SHELL-V1.5-PIPELINE.md):
//   1. only op:"mint" makes a Pokémon canonical (state machine ends at
//      mint_confirmed)
//   2. capture_commit alone never creates an NFT (intermediate states
//      cannot reach mint_confirmed without going through pending_mint
//      → mint_broadcast)
//   3. after commit_inscription_id is set, never re-inscribe the commit
//      (assertPendingTransition refuses pending_commit → commit_broadcast
//      when the row already has commit_inscription_id; same for mint)
//   4. after mint_broadcast, cancel is forbidden (mint_broadcast and
//      mint_confirmed are not in PENDING_CAPTURE_TRANSITIONS source set
//      for `cancelled`)
//   5. wallet/bridge absent → manual fallback always available (state
//      machine doesn't care how the inscription got on-chain; only that
//      the inscription_id is known + valid format)
//   6. UI surfaces Pending / Retry / Cancelled / Minted (state names
//      map directly to badge categories)

export const PENDING_CAPTURE_STATUSES = Object.freeze([
  'pending_commit',
  'commit_broadcast',
  'commit_confirmed',
  'pending_mint',
  'mint_broadcast',
  'mint_confirmed',
  'cancelled',
]);

export const PENDING_CAPTURE_TERMINAL = new Set(['mint_confirmed', 'cancelled']);
export const PENDING_CAPTURE_MINT_LOCKED = new Set(['mint_broadcast', 'mint_confirmed']);

// (from → set of allowed `to`). Edges align with SHELL-V1.5-PIPELINE.md
// state diagram + cancel matrix. mint_broadcast → pending_mint allows
// retry of the mint inscription only if both txids are null (caller
// enforces the txid guard; the state machine just allows the edge).
export const PENDING_CAPTURE_TRANSITIONS = Object.freeze({
  pending_commit:   new Set(['commit_broadcast', 'cancelled']),
  commit_broadcast: new Set(['commit_confirmed', 'pending_commit', 'cancelled']),
  commit_confirmed: new Set(['pending_mint', 'cancelled']),
  pending_mint:     new Set(['mint_broadcast', 'cancelled']),
  mint_broadcast:   new Set(['mint_confirmed', 'pending_mint']),
  mint_confirmed:   new Set([]),
  cancelled:        new Set([]),
});

export function isValidPendingStatus(status) {
  return PENDING_CAPTURE_STATUSES.includes(status);
}

export function isAllowedPendingTransition(from, to) {
  return Boolean(PENDING_CAPTURE_TRANSITIONS[from]?.has(to));
}

// Throws on illegal transitions or invariant 3 / broadcast-partial
// violations. Returns the `next` row shape ready to persist (caller
// writes to IDB).
//
// Invariant 3 is strengthened from "no re-inscribe if inscription_id
// set" to "no rewind if ANY commit/mint txid OR inscription_id is set".
// This closes the broadcast-partial gap: if the fund tx broadcast
// succeeded but the reveal failed, commit_fund_txid IS set. The state
// machine refuses to rewind to pending_commit (which would imply "start
// fresh" + lose track of the in-flight fund tx). Caller must instead
// resume from commit_broadcast with the existing fund_txid in mind
// (manual re-broadcast of just the reveal).
export function assertPendingTransition(existing, nextStatus, partial = null) {
  if (!existing) {
    throw new Error('assertPendingTransition: existing row required');
  }
  if (!isValidPendingStatus(nextStatus)) {
    throw new Error(`unknown pendingCaptures status "${nextStatus}"`);
  }
  if (!isAllowedPendingTransition(existing.status, nextStatus)) {
    throw new Error(
      `illegal pendingCaptures transition ${existing.status} → ${nextStatus}`,
    );
  }
  // ---- Commit side: refuse rewind / re-broadcast if any commit
  // artifact exists on chain (or in mempool).
  const commitInFlight = Boolean(
    existing.commit_inscription_id
    || existing.commit_fund_txid
    || existing.commit_reveal_txid,
  );
  if (nextStatus === 'commit_broadcast' && commitInFlight) {
    throw new Error(
      `refusing to re-broadcast commit: existing artifact `
      + `(inscription_id=${existing.commit_inscription_id ?? '∅'}, `
      + `fund_txid=${existing.commit_fund_txid ?? '∅'}, `
      + `reveal_txid=${existing.commit_reveal_txid ?? '∅'}). `
      + `Resume from current state — never rebuild from scratch.`,
    );
  }
  if (nextStatus === 'pending_commit' && commitInFlight) {
    throw new Error(
      `refusing rewind commit_broadcast → pending_commit: a commit tx `
      + `or inscription_id already exists. Rewind would lose track of `
      + `the in-flight broadcast (broadcast-partial guard).`,
    );
  }
  // ---- Mint side: same rule.
  const mintInFlight = Boolean(
    existing.mint_inscription_id
    || existing.mint_fund_txid
    || existing.mint_reveal_txid,
  );
  if (nextStatus === 'mint_broadcast' && mintInFlight) {
    throw new Error(
      `refusing to re-broadcast mint: existing artifact `
      + `(inscription_id=${existing.mint_inscription_id ?? '∅'}, `
      + `fund_txid=${existing.mint_fund_txid ?? '∅'}, `
      + `reveal_txid=${existing.mint_reveal_txid ?? '∅'}).`,
    );
  }
  if (nextStatus === 'pending_mint' && mintInFlight) {
    throw new Error(
      `refusing rewind mint_broadcast → pending_mint: a mint tx or `
      + `inscription_id already exists.`,
    );
  }
  return {
    ...existing,
    ...(partial ?? {}),
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
}

export function makePendingCaptureRow({
  commitRecord,
  privateReveal,
  partySlotIndex,
  signedInWallet,
  network,
  previewSpeciesName,
  previewLevel,
}) {
  const now = new Date().toISOString();
  return {
    attestation: String(commitRecord.attestation).toLowerCase(),
    commit_record: commitRecord,
    private_reveal: privateReveal,
    status: 'pending_commit',
    commit_inscription_id: null,
    mint_inscription_id: null,
    commit_fund_txid: null,
    commit_reveal_txid: null,
    mint_fund_txid: null,
    mint_reveal_txid: null,
    party_slot_index: partySlotIndex,
    signed_in_wallet: signedInWallet,
    network,
    created_at: now,
    updated_at: now,
    last_error: null,
    retry_count: 0,
    preview_species_name: previewSpeciesName ?? null,
    preview_level: previewLevel ?? null,
    pending_registrations: [],
    // Signed-but-not-yet-broadcast tx hexes. The direct mint flow
    // caches these BEFORE attempting any broadcast so a partial
    // failure (fund OK, reveal KO) can recover by rebroadcasting only
    // the missing tx — no second wallet popup, no double-spend of
    // already-broadcast UTXOs. Cleared (kept null) once we've confirmed
    // both txids are persisted; can be cleared again post-mint to free
    // IDB. Each hex is a few hundred bytes — fine for IDB.
    commit_fund_tx_hex: null,
    commit_reveal_tx_hex: null,
    mint_fund_tx_hex: null,
    mint_reveal_tx_hex: null,
  };
}

export function cancelAllowed(status) {
  if (PENDING_CAPTURE_MINT_LOCKED.has(status)) return false;
  if (PENDING_CAPTURE_TERMINAL.has(status)) return false;
  return true;
}

// Decide what action the direct-mint flow should take when entering
// the commit step. Three buckets:
//   - 'fresh': no commit artifact → safe to sign + broadcast normally
//   - 'recovery': partial broadcast happened AND signed hexes are
//     cached → re-broadcast only the missing tx, no new wallet popup
//   - 'stranded': partial broadcast happened BUT signed hexes are
//     missing → manual recovery required (cancel or wait); DO NOT
//     allow the flow to call the inscriber lib again, that would
//     double-spend the already-broadcast fund tx.
export function detectCommitRecoveryState(row) {
  const hasArtifact = Boolean(
    row.commit_fund_txid
    || row.commit_reveal_txid
    || row.commit_inscription_id,
  );
  const hasHexes = Boolean(row.commit_fund_tx_hex && row.commit_reveal_tx_hex);
  if (!hasArtifact) return { state: 'fresh', canProceed: true };
  if (hasHexes) return { state: 'recovery', canProceed: true };
  return {
    state: 'stranded',
    canProceed: false,
    reason: `commit broadcast partial (fund_txid=${row.commit_fund_txid ?? '∅'}, reveal_txid=${row.commit_reveal_txid ?? '∅'}) but signed hexes are not cached locally — manual recovery required (Cancel + accept fund as wasted, or wait for the broadcast to confirm so the indexer can pick it up).`,
  };
}

// Same logic for the mint side.
export function detectMintRecoveryState(row) {
  const hasArtifact = Boolean(
    row.mint_fund_txid
    || row.mint_reveal_txid
    || row.mint_inscription_id,
  );
  const hasHexes = Boolean(row.mint_fund_tx_hex && row.mint_reveal_tx_hex);
  if (!hasArtifact) return { state: 'fresh', canProceed: true };
  if (hasHexes) return { state: 'recovery', canProceed: true };
  return {
    state: 'stranded',
    canProceed: false,
    reason: `mint broadcast partial (fund_txid=${row.mint_fund_txid ?? '∅'}, reveal_txid=${row.mint_reveal_txid ?? '∅'}) but signed hexes are not cached locally — manual recovery required.`,
  };
}

const browserExports = {
  PENDING_CAPTURE_STATUSES,
  PENDING_CAPTURE_TERMINAL,
  PENDING_CAPTURE_MINT_LOCKED,
  PENDING_CAPTURE_TRANSITIONS,
  isValidPendingStatus,
  isAllowedPendingTransition,
  assertPendingTransition,
  makePendingCaptureRow,
  cancelAllowed,
  detectCommitRecoveryState,
  detectMintRecoveryState,
};

if (typeof window !== 'undefined') {
  window.PokeBellsPendingCaptures = browserExports;
}
