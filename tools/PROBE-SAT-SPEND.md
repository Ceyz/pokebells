# Phase 0 probe — sat-spend-v1 feasibility test

Verifies that the Bells inscription pipeline (greedy smallest-first UTXO
picker in `tools/pokebells-inscriber`) can deliberately spend a specific
UTXO as the commit-tx input of a second inscription. This is the
cryptographic primitive `op:"collection_update"` relies on (Phase B of
[ROOT-APP-DESIGN.md](../game/ROOT-APP-DESIGN.md)).

The probe auto-runs on testnet, inscribes two dummy bodies, and reports
PASS/FAIL with the observed commit-tx inputs.

## What you need

- A testnet throwaway wallet with **~50,000 sats** at its address.
  (Reuse an existing funded testnet wallet, or generate a new one + fund
  from your main wallet / a faucet.)
- Node.js (the rest of the repo already uses ≥ 20).

## Steps

### 1. (optional) Generate a throwaway wallet

```bash
node tools/gen-bells-wallet.mjs --network bells-testnet > /tmp/probe.key
```

Copy the address from the output and fund it with ~50,000 testnet sats.

### 2. Run the probe

```bash
node tools/probe-sat-spend.mjs \
  --key-file /tmp/probe.key \
  --network bells-testnet \
  --fee-rate 3 \
  --log tools/probe-sat-spend.log
```

The probe will:

1. Inscribe a dummy `p:pokebells-collection-probe` body. Prints the
   inscription id, commit txid, reveal txid.
2. Poll electrs until the reveal tx confirms (~1–2 blocks).
3. Fetch the wallet's UTXOs again and identify the 546-sat inscription
   UTXO (the reveal-tx output that carries the inscription).
4. Inscribe a dummy `op:"collection-update-probe"` body, letting the
   greedy smallest-first picker run naturally. If greedy picks the
   546-sat inscription UTXO as its first input (expected behavior), the
   commit tx deliberately spends the inscription UTXO — which is
   sat-spend-v1 in action.
5. Poll for the second reveal to confirm.
6. Fetch both inscription bodies from the content host to verify they
   are still readable after the sat-spend.

Expected runtime: 10–20 minutes (dominated by two block confirmations).

### 3. Report back

Paste the final `PROBE RESULT` block (everything between the two
`======================` lines) back to Claude, plus:

- Pass/fail summary
- Both inscription ids (so we can add them as Phase B fixtures)
- If it fails: also paste the stderr + the commit_2 tx hex (available
  via `curl https://bells-testnet-api.nintondo.io/tx/<commit_2_txid>/hex`)

### 4. Clean up

```bash
shred -u /tmp/probe.key
```

(Windows: delete manually. The key was throwaway — funds left in it
stay burnable.)

## Interpreting the result

- **PASS** — sat-spend-v1 is feasible with the default inscriber.
  Phase B can assume the same primitive works for a real collection
  root inscription. The dummy inscription ids become acceptance-test
  fixtures for Phase B.
- **FAIL — `spentInscriptionUtxo: NO`** — the greedy picker did NOT
  include the 546-sat UTXO. Unexpected given smallest-first; report
  the commit_2 tx hex + input list so we can check whether the picker
  changed behavior or the UTXO set had something unusual.
- **FAIL — `body1 unreadable`** — the collection-probe inscription was
  orphaned after the sat-move. Very unexpected; this would invalidate
  the whole sat-spend-v1 scheme and force a rethink (probably back to
  a parent/child inscription mechanism or a signature-based authority
  once signMessage stabilizes).
- **FAIL — `body2 unreadable`** — probably a content-host caching
  issue (eventual consistency). Retry `curl <content-base>/<id>` after
  a few more minutes; the indexer's POST /api/mints already handles
  this class of lag via its ingestion queue.

## What Phase B will add after a PASS

- Indexer schema validator for `op:"collection_update"` bodies
  (`_prepend` allowlist, scalar-set reject, sequence monotonicity).
- Satpoint tracking for the collection root inscription, block by
  block.
- Authority check: commit tx of an incoming `collection_update` must
  spend the UTXO currently holding the collection root. Fail-closed
  on any verification failure.
- `/api/collection/latest` aggregator endpoint.
- Tests for all the above using the PASS fixtures from this probe.
