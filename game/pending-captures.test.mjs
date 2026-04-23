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

test('assertPendingTransition: invariant 3 — refuses re-inscribe commit', () => {
  const row = makeRow({ commit_inscription_id: 'd'.repeat(64) + 'i0', status: 'pending_commit' });
  assert.throws(
    () => assertPendingTransition(row, 'commit_broadcast'),
    /refusing to re-broadcast commit/,
  );
});

test('assertPendingTransition: invariant 3 — refuses re-inscribe mint', () => {
  const row = makeRow({
    status: 'pending_mint',
    commit_inscription_id: 'd'.repeat(64) + 'i0',
    mint_inscription_id: 'e'.repeat(64) + 'i0',
  });
  assert.throws(
    () => assertPendingTransition(row, 'mint_broadcast'),
    /refusing to re-broadcast mint/,
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

test('assertPendingTransition: refuse re-broadcast if ANY commit/mint artifact exists', () => {
  // Fund-only (reveal failed before tx broadcast) — re-broadcast forbidden.
  const fundOnly = makeRow({
    status: 'pending_commit',
    commit_fund_txid: 'a'.repeat(64),
  });
  assert.throws(
    () => assertPendingTransition(fundOnly, 'commit_broadcast'),
    /refusing to re-broadcast commit/,
  );

  // Mint side: fund-only.
  const mintFundOnly = makeRow({
    status: 'pending_mint',
    commit_inscription_id: 'd'.repeat(64) + 'i0',
    mint_fund_txid: 'c'.repeat(64),
  });
  assert.throws(
    () => assertPendingTransition(mintFundOnly, 'mint_broadcast'),
    /refusing to re-broadcast mint/,
  );

  // Mint side: rewind mint_broadcast → pending_mint with txid set.
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
