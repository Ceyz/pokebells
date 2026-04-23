import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PENDING_CAPTURE_STATUSES,
  PENDING_CAPTURE_TRANSITIONS,
  PENDING_CAPTURE_TERMINAL,
  PENDING_CAPTURE_MINT_LOCKED,
  isValidPendingStatus,
  isAllowedPendingTransition,
  assertPendingTransition,
  makePendingCaptureRow,
  cancelAllowed,
  detectCommitRecoveryState,
  detectMintRecoveryState,
} from './pending-captures.mjs';

const FIXTURE_COMMIT = Object.freeze({
  p: 'pokebells',
  op: 'capture_commit',
  schema_version: '1.5',
  attestation: 'a'.repeat(64),
  signed_in_wallet: 'tb1ptest',
});
const FIXTURE_REVEAL = Object.freeze({
  ivs: { atk: 10, def: 11, spe: 12, spd: 13 },
  ivs_salt_hex: '42'.repeat(32),
  ram_snapshot_base64: 'AAAA',
});

function makeRow(overrides = {}) {
  return {
    ...makePendingCaptureRow({
      commitRecord: FIXTURE_COMMIT,
      privateReveal: FIXTURE_REVEAL,
      partySlotIndex: 2,
      signedInWallet: 'tb1ptest',
      network: 'bells-testnet',
      previewSpeciesName: 'Cyndaquil',
      previewLevel: 5,
    }),
    ...overrides,
  };
}

test('PENDING_CAPTURE_STATUSES freeze + length 7', () => {
  assert.equal(PENDING_CAPTURE_STATUSES.length, 7);
  assert.throws(() => { PENDING_CAPTURE_STATUSES.push('extra'); });
});

test('isValidPendingStatus accepts all known + rejects unknown', () => {
  for (const s of PENDING_CAPTURE_STATUSES) assert.equal(isValidPendingStatus(s), true);
  assert.equal(isValidPendingStatus('not-a-state'), false);
  assert.equal(isValidPendingStatus(null), false);
  assert.equal(isValidPendingStatus(''), false);
});

test('isAllowedPendingTransition matrix', () => {
  // Allowed edges:
  assert.equal(isAllowedPendingTransition('pending_commit', 'commit_broadcast'), true);
  assert.equal(isAllowedPendingTransition('pending_commit', 'cancelled'), true);
  assert.equal(isAllowedPendingTransition('commit_broadcast', 'commit_confirmed'), true);
  assert.equal(isAllowedPendingTransition('commit_broadcast', 'pending_commit'), true);
  assert.equal(isAllowedPendingTransition('commit_broadcast', 'cancelled'), true);
  assert.equal(isAllowedPendingTransition('commit_confirmed', 'pending_mint'), true);
  assert.equal(isAllowedPendingTransition('commit_confirmed', 'cancelled'), true);
  assert.equal(isAllowedPendingTransition('pending_mint', 'mint_broadcast'), true);
  assert.equal(isAllowedPendingTransition('pending_mint', 'cancelled'), true);
  assert.equal(isAllowedPendingTransition('mint_broadcast', 'mint_confirmed'), true);
  assert.equal(isAllowedPendingTransition('mint_broadcast', 'pending_mint'), true);

  // Forbidden edges (cancel matrix invariant 4):
  assert.equal(isAllowedPendingTransition('mint_broadcast', 'cancelled'), false);
  assert.equal(isAllowedPendingTransition('mint_confirmed', 'cancelled'), false);
  assert.equal(isAllowedPendingTransition('mint_confirmed', 'mint_broadcast'), false);
  assert.equal(isAllowedPendingTransition('cancelled', 'pending_commit'), false);
  assert.equal(isAllowedPendingTransition('pending_commit', 'mint_confirmed'), false);
});

test('assertPendingTransition: happy path through full pipeline', () => {
  let row = makeRow();
  row = assertPendingTransition(row, 'commit_broadcast', { commit_inscription_id: 'b'.repeat(64) + 'i0' });
  assert.equal(row.status, 'commit_broadcast');
  assert.equal(row.commit_inscription_id.slice(-2), 'i0');

  row = assertPendingTransition(row, 'commit_confirmed');
  assert.equal(row.status, 'commit_confirmed');

  row = assertPendingTransition(row, 'pending_mint');
  assert.equal(row.status, 'pending_mint');

  row = assertPendingTransition(row, 'mint_broadcast', { mint_inscription_id: 'c'.repeat(64) + 'i0' });
  assert.equal(row.status, 'mint_broadcast');

  row = assertPendingTransition(row, 'mint_confirmed');
  assert.equal(row.status, 'mint_confirmed');
});

test('assertPendingTransition: rejects illegal edges', () => {
  const initial = makeRow();
  assert.throws(
    () => assertPendingTransition(initial, 'mint_confirmed'),
    /illegal pendingCaptures transition pending_commit → mint_confirmed/,
  );
  assert.throws(
    () => assertPendingTransition({ ...initial, status: 'mint_broadcast' }, 'cancelled'),
    /illegal pendingCaptures transition mint_broadcast → cancelled/,
  );
  assert.throws(
    () => assertPendingTransition({ ...initial, status: 'cancelled' }, 'pending_commit'),
    /illegal pendingCaptures transition cancelled → pending_commit/,
  );
});

test('assertPendingTransition: refuses commit_broadcast if partial overwrites existing inscription_id with a different value', () => {
  const row = makeRow({ commit_inscription_id: 'd'.repeat(64) + 'i0', status: 'pending_commit' });
  assert.throws(
    () => assertPendingTransition(row, 'commit_broadcast', {
      commit_inscription_id: 'e'.repeat(64) + 'i0',
    }),
    /commit_inscription_id conflict/,
  );
});

test('assertPendingTransition: refuses mint_broadcast if partial overwrites existing inscription_id with a different value', () => {
  const row = makeRow({
    status: 'pending_mint',
    commit_inscription_id: 'd'.repeat(64) + 'i0',
    mint_inscription_id: 'e'.repeat(64) + 'i0',
  });
  assert.throws(
    () => assertPendingTransition(row, 'mint_broadcast', {
      mint_inscription_id: 'f'.repeat(64) + 'i0',
    }),
    /mint_inscription_id conflict/,
  );
});

test('assertPendingTransition: refuses commit_broadcast if partial overwrites existing fund_txid', () => {
  const row = makeRow({ status: 'pending_commit', commit_fund_txid: 'a'.repeat(64) });
  assert.throws(
    () => assertPendingTransition(row, 'commit_broadcast', {
      commit_fund_txid: 'b'.repeat(64),
      commit_inscription_id: 'c'.repeat(64) + 'i0',
    }),
    /commit_fund_txid conflict/,
  );
});

test('assertPendingTransition: rewind commit_broadcast → pending_commit ONLY when no fund/reveal/inscription id', () => {
  // Empty broadcast row (atomic write before any tx left the wallet) —
  // rewind allowed. This covers the "wallet rejected the first popup
  // before signing fund" case.
  const fresh = makeRow({ status: 'commit_broadcast' });
  const rewound = assertPendingTransition(fresh, 'pending_commit');
  assert.equal(rewound.status, 'pending_commit');

  // Once commit_inscription_id is set (= reveal tx broadcast succeeded),
  // rewind is forbidden. Broadcast-partial guard.
  const withId = makeRow({
    status: 'commit_broadcast',
    commit_inscription_id: 'f'.repeat(64) + 'i0',
  });
  assert.throws(
    () => assertPendingTransition(withId, 'pending_commit'),
    /refusing rewind commit_broadcast → pending_commit/,
  );

  // Once commit_fund_txid is set (fund tx broadcast succeeded but reveal
  // hasn't) — rewind is also forbidden. This is the GPT broadcast-partial
  // gap closer.
  const withFundOnly = makeRow({
    status: 'commit_broadcast',
    commit_fund_txid: 'a'.repeat(64),
  });
  assert.throws(
    () => assertPendingTransition(withFundOnly, 'pending_commit'),
    /refusing rewind commit_broadcast → pending_commit/,
  );

  // commit_reveal_txid alone (rare but possible if persistence ordered
  // reveal-first) should also block.
  const withRevealOnly = makeRow({
    status: 'commit_broadcast',
    commit_reveal_txid: 'b'.repeat(64),
  });
  assert.throws(
    () => assertPendingTransition(withRevealOnly, 'pending_commit'),
    /refusing rewind commit_broadcast → pending_commit/,
  );
});

test('assertPendingTransition: rewind to pending_mint with mint artifacts → refused', () => {
  const mintWithFund = makeRow({
    status: 'mint_broadcast',
    commit_inscription_id: 'd'.repeat(64) + 'i0',
    mint_fund_txid: 'e'.repeat(64),
  });
  assert.throws(
    () => assertPendingTransition(mintWithFund, 'pending_mint'),
    /refusing rewind mint_broadcast → pending_mint/,
  );
});

test('integration: progressive commit happy path — fresh → cache → fund_txid → reveal_txid → commit_broadcast (no throws)', () => {
  // Mirrors what runDirectMintFlow does in shell.js. The state machine
  // must allow the full sequence without throwing — GPT round 6 caught
  // that the over-broad invariant blocked the final transition.
  let row = makeRow();
  assert.equal(row.status, 'pending_commit');

  // Step 1: cache signed hexes (status unchanged).
  row = { ...row, commit_fund_tx_hex: 'aabb', commit_reveal_tx_hex: 'ccdd' };

  // Step 2: persist commit_fund_txid after fund broadcast (status unchanged).
  row = { ...row, commit_fund_txid: 'a'.repeat(64) };

  // Step 3: persist commit_reveal_txid after reveal broadcast (status unchanged).
  row = { ...row, commit_reveal_txid: 'b'.repeat(64) };

  // Step 4: transition to commit_broadcast with the inscription_id.
  // Existing fund/reveal txids must be preserved; partial only adds
  // inscription_id. MUST NOT throw.
  const next = assertPendingTransition(row, 'commit_broadcast', {
    commit_inscription_id: 'b'.repeat(64) + 'i0',
  });
  assert.equal(next.status, 'commit_broadcast');
  assert.equal(next.commit_inscription_id, 'b'.repeat(64) + 'i0');
  assert.equal(next.commit_fund_txid, 'a'.repeat(64));   // preserved
  assert.equal(next.commit_reveal_txid, 'b'.repeat(64)); // preserved
});

test('integration: progressive mint happy path passes the same way', () => {
  let row = makeRow({
    status: 'pending_mint',
    commit_inscription_id: 'a'.repeat(64) + 'i0',
    commit_fund_txid: 'a'.repeat(64),
    commit_reveal_txid: 'a'.repeat(64),
    commit_fund_tx_hex: 'aa',
    commit_reveal_tx_hex: 'bb',
  });

  row = { ...row, mint_fund_tx_hex: 'cc', mint_reveal_tx_hex: 'dd' };
  row = { ...row, mint_fund_txid: 'c'.repeat(64) };
  row = { ...row, mint_reveal_txid: 'd'.repeat(64) };

  const next = assertPendingTransition(row, 'mint_broadcast', {
    mint_inscription_id: 'd'.repeat(64) + 'i0',
  });
  assert.equal(next.status, 'mint_broadcast');
  assert.equal(next.mint_inscription_id, 'd'.repeat(64) + 'i0');
  assert.equal(next.mint_fund_txid, 'c'.repeat(64));
  assert.equal(next.mint_reveal_txid, 'd'.repeat(64));
});

test('cancelAllowed: returns false for mint-locked + terminal states', () => {
  assert.equal(cancelAllowed('pending_commit'), true);
  assert.equal(cancelAllowed('commit_broadcast'), true);
  assert.equal(cancelAllowed('commit_confirmed'), true);
  assert.equal(cancelAllowed('pending_mint'), true);
  assert.equal(cancelAllowed('mint_broadcast'), false);
  assert.equal(cancelAllowed('mint_confirmed'), false);
  assert.equal(cancelAllowed('cancelled'), false);
});

test('makePendingCaptureRow: defaults match spec', () => {
  const row = makePendingCaptureRow({
    commitRecord: FIXTURE_COMMIT,
    privateReveal: FIXTURE_REVEAL,
    partySlotIndex: 3,
    signedInWallet: 'tb1pCASE',
    network: 'bells-testnet',
    previewSpeciesName: 'Pikachu',
    previewLevel: 17,
  });
  assert.equal(row.attestation, 'a'.repeat(64));
  assert.equal(row.status, 'pending_commit');
  assert.equal(row.commit_inscription_id, null);
  assert.equal(row.mint_inscription_id, null);
  assert.equal(row.party_slot_index, 3);
  assert.equal(row.signed_in_wallet, 'tb1pCASE');
  assert.equal(row.network, 'bells-testnet');
  assert.equal(row.preview_species_name, 'Pikachu');
  assert.equal(row.preview_level, 17);
  assert.deepEqual(row.pending_registrations, []);
  assert.equal(row.retry_count, 0);
  assert.equal(row.last_error, null);
  assert.ok(row.created_at);
  assert.ok(row.updated_at);
});

test('makePendingCaptureRow: cached signed-tx-hex slots default to null', () => {
  const row = makeRow();
  assert.equal(row.commit_fund_tx_hex, null);
  assert.equal(row.commit_reveal_tx_hex, null);
  assert.equal(row.mint_fund_tx_hex, null);
  assert.equal(row.mint_reveal_tx_hex, null);
});

test('detectCommitRecoveryState: fresh row → safe to sign + broadcast', () => {
  const row = makeRow();
  const r = detectCommitRecoveryState(row);
  assert.equal(r.state, 'fresh');
  assert.equal(r.canProceed, true);
});

test('detectCommitRecoveryState: partial broadcast WITH cached hexes → recovery', () => {
  const row = makeRow({
    commit_fund_txid: 'a'.repeat(64),
    commit_fund_tx_hex: '01000000ff',
    commit_reveal_tx_hex: '02000000ff',
  });
  const r = detectCommitRecoveryState(row);
  assert.equal(r.state, 'recovery');
  assert.equal(r.canProceed, true);
});

test('detectCommitRecoveryState: partial broadcast WITHOUT cached hexes → stranded', () => {
  // This is the GPT round-5 scenario: fund tx broadcast but no signed
  // hex cache (e.g. cache cleared, or pre-cache code shipped). Direct
  // mint flow MUST refuse to call inscriber lib (would re-sign + double-
  // spend).
  const row = makeRow({
    commit_fund_txid: 'a'.repeat(64),
    commit_fund_tx_hex: null,
    commit_reveal_tx_hex: null,
  });
  const r = detectCommitRecoveryState(row);
  assert.equal(r.state, 'stranded');
  assert.equal(r.canProceed, false);
  assert.match(r.reason, /commit broadcast partial.*manual recovery required/);

  // Same conclusion if only inscription_id exists with no hexes:
  const r2 = detectCommitRecoveryState(makeRow({
    commit_inscription_id: 'b'.repeat(64) + 'i0',
  }));
  assert.equal(r2.state, 'stranded');
});

test('detectMintRecoveryState: fresh / recovery / stranded buckets', () => {
  const fresh = detectMintRecoveryState(makeRow());
  assert.equal(fresh.state, 'fresh');

  const recovery = detectMintRecoveryState(makeRow({
    mint_fund_txid: 'a'.repeat(64),
    mint_fund_tx_hex: 'ff',
    mint_reveal_tx_hex: 'ff',
  }));
  assert.equal(recovery.state, 'recovery');

  const stranded = detectMintRecoveryState(makeRow({
    mint_fund_txid: 'a'.repeat(64),
  }));
  assert.equal(stranded.state, 'stranded');
  assert.equal(stranded.canProceed, false);
});

test('cancel matrix: every state in the spec is reachable from initial path', () => {
  // Walk: pending_commit → commit_broadcast → commit_confirmed →
  //        pending_mint → mint_broadcast → mint_confirmed
  const reached = new Set();
  let row = makeRow();
  reached.add(row.status);
  for (const next of [
    'commit_broadcast', 'commit_confirmed', 'pending_mint',
    'mint_broadcast', 'mint_confirmed',
  ]) {
    const partial = next === 'commit_broadcast'
      ? { commit_inscription_id: 'b'.repeat(64) + 'i0' }
      : next === 'mint_broadcast'
      ? { mint_inscription_id: 'c'.repeat(64) + 'i0' }
      : null;
    row = assertPendingTransition(row, next, partial);
    reached.add(row.status);
  }
  // cancelled is reachable from a separate path
  const cancelable = makeRow();
  const cancelled = assertPendingTransition(cancelable, 'cancelled');
  reached.add(cancelled.status);
  for (const expected of PENDING_CAPTURE_STATUSES) {
    assert.ok(reached.has(expected), `state "${expected}" unreachable in walk`);
  }
});
