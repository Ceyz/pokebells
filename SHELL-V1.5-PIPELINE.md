# Shell v1.5 capture-to-mint pipeline — mini-spec

**Status:** spec frozen 2026-04-23. Implementation lands in the next
shell.js commit. Reviewed against [SCHEMA-v1.5.md](SCHEMA-v1.5.md) and
[EXTENSION-VS-SUBSTITUTION.md](EXTENSION-VS-SUBSTITUTION.md).

This doc fixes the orchestration around v1.5's two-inscription protocol
inside `game/shell.js`. The cryptography lives in
[capture-core.mjs](game/capture-core.mjs); this spec defines the state
machine, cancel/resume semantics, and the manual fallback so we don't
re-discover the rules halfway through the refactor.

## Six invariants the shell must respect

1. **Only `op:"mint"` makes a Pokémon canonical.** A capture_commit
   inscribed alone is a cryptographic receipt, not an NFT. The hub /
   indexer / collection only list mints.

2. **A capture_commit alone never creates an NFT.** UI must reflect
   this — never call a pending or cancelled capture "Pokemon X". Use
   "Pending mint of slot 2" until `mint_confirmed`.

3. **After `commit_inscription_id` is set, never re-inscribe the commit.**
   The same `(wallet, salt, ram_snapshot, block_hash)` already produced
   one on-chain commit; a second would be a duplicate row in the
   indexer's `commits` table. Resume to the mint step instead.

4. **After mint broadcast, cancel is forbidden / ignored.** Once the
   reveal tx is in the mempool, the Pokémon is already on the way to
   becoming canonical. The shell hides Cancel and offers only "track
   confirmation".

5. **Wallet / bridge absent → manual fallback always available.** If
   `window.nintondo` is undefined and we're not running inside a
   `play-bridge.html` parent, the shell exposes a Copy/paste flow:
   commit JSON → field for inscription id → mint JSON → field for
   inscription id → indexer register. Slower but always works on a
   pure inscription host.

6. **UI clearly surfaces Pending / Retry / Cancelled / Minted.** Each
   pending capture shows its current status with a colored badge + a
   primary action button matched to the next expected step.

## State machine

```
                  ┌──────────────────┐
                  │ pending_commit   │  initial state right after capture
                  └────────┬─────────┘  (commitRecord built, nothing on-chain)
                           │
                  user clicks "Mint here" or "Mint via companion"
                           │
                  ┌────────▼─────────┐
                  │ commit_broadcast │  fund tx + reveal tx of capture_commit
                  └────────┬─────────┘  in mempool, not yet confirmed
                           │
                  electrs / indexer poll: tx confirmed
                           │
                  ┌────────▼─────────┐
                  │ commit_confirmed │  capture_commit live on-chain;
                  └────────┬─────────┘  inscription_id known + indexer notified
                           │
                  user clicks "Inscribe mint"
                  (auto-fires from "Mint here" if same session)
                           │
                  ┌────────▼─────────┐
                  │ pending_mint     │  mint JSON built locally from commit
                  └────────┬─────────┘  + privateReveal, ready to inscribe
                           │
                  ┌────────▼─────────┐
                  │ mint_broadcast   │  fund + reveal of op:"mint" in mempool
                  └────────┬─────────┘  Cancel button hidden from this state on
                           │
                  electrs / indexer poll: confirmed
                           │
                  ┌────────▼─────────┐
                  │ mint_confirmed   │  Pokémon canonical, in collection.
                  └──────────────────┘  Pending entry archived (not deleted).

                  ┌──────────────────┐
                  │ cancelled        │  reachable from any state EXCEPT
                  └──────────────────┘  mint_broadcast / mint_confirmed
                                       (mint already irreversible). Always
                                       releases the Pokémon in-game; entry
                                       kept for audit, never silently purged.
                                       Terminal in v1.5 — no Reactivate.
```

Allowed transitions, summarized:

| From | To | Trigger |
|---|---|---|
| `pending_commit` | `commit_broadcast` | wallet signs commit fund + reveal txs |
| `pending_commit` | `cancelled` | user clicks Cancel + confirms |
| `commit_broadcast` | `commit_confirmed` | electrs sees both txs confirmed |
| `commit_broadcast` | `pending_commit` | **only if** `commit_fund_txid` AND `commit_reveal_txid` are both null (no broadcast happened) — typically a network error before the wallet finished signing. If either txid exists, retry stays in `commit_broadcast` and re-polls electrs; we never re-inscribe from scratch when bytes might already be in flight. |
| `commit_broadcast` | `cancelled` | user clicks Cancel + confirms (commit may still land on-chain; no mint follows) |
| `commit_confirmed` | `pending_mint` | user clicks "Inscribe mint" |
| `commit_confirmed` | `cancelled` | user clicks Cancel + confirms (commit on-chain stays as opaque receipt; no NFT) |
| `pending_mint` | `mint_broadcast` | wallet signs mint fund + reveal txs |
| `pending_mint` | `cancelled` | user clicks Cancel + confirms (last point cancel is allowed) |
| `mint_broadcast` | `mint_confirmed` | electrs sees both txs confirmed |
| `mint_broadcast` | `pending_mint` | **only if** `mint_fund_txid` AND `mint_reveal_txid` are both null (same partial-broadcast guard as commit). If either exists, stay in `mint_broadcast` and poll. |
| `mint_broadcast` | (no cancel) | cancel disabled from this state on — Pokémon is on its way to canonical |

States `commit_confirmed` and any `*_broadcast` can also display
`last_error` + a Retry button if the next transition errored.

## IDB schema — `pendingCaptures` store

```js
db.createObjectStore('pendingCaptures', { keyPath: 'attestation' });
```

Each record:

```js
{
  attestation: '<64hex>',                    // primary key
  commit_record: { p, op:'capture_commit', schema_version:'1.5', ... },
  private_reveal: { ivs, evs, ivs_salt_hex, ram_snapshot_base64 },
  status: 'pending_commit'|'commit_broadcast'|'commit_confirmed'
        |'pending_mint'|'mint_broadcast'|'mint_confirmed'|'cancelled',
  commit_inscription_id: null | '<64hex>i0',
  mint_inscription_id:   null | '<64hex>i0',
  commit_fund_txid:      null | '<64hex>',
  commit_reveal_txid:    null | '<64hex>',
  mint_fund_txid:        null | '<64hex>',
  mint_reveal_txid:      null | '<64hex>',
  party_slot_index: 1..6,
  signed_in_wallet: 'tb1p...',
  network: 'bells-testnet'|'bells-mainnet',
  created_at: ISO8601,
  updated_at: ISO8601,
  last_error: null | string,
  retry_count: 0,
  // For UI display before mint reveals traits:
  preview_species_name: 'Cyndaquil',
  preview_level: 5,
}
```

`captureReveals` (legacy v1.4) stays read-only for back-compat with
already-inscribed testnet records. New captures only write to
`pendingCaptures`.

## Resume semantics

On `boot()` after wallet adapter init:

```
for each row in pendingCaptures where status != 'mint_confirmed':
  switch status:
    pending_commit:
      // user paused before broadcasting; nothing to do automatically.
      // Surface in "Pending mints" panel with [Mint here] button.
    commit_broadcast:
      // tx might have confirmed while we were offline — poll electrs
      // (vs commit_fund_txid / commit_reveal_txid). If both confirmed,
      // transition to commit_confirmed (also POST /api/captures with
      // commit_inscription_id derived from commit_reveal_txid).
    commit_confirmed:
      // Surface with [Inscribe mint] button.
    pending_mint:
      // Same as commit_confirmed — never inscribed mint, prompt user.
    mint_broadcast:
      // Poll electrs; on confirmation, POST /api/mints + transition
      // to mint_confirmed.
    cancelled:
      // Show in archive panel only; no action button.
```

Polling cadence: 30 s while a tab is open and any *_broadcast row
exists. Stops when zero broadcasts pending. Manual "Refresh" button
also available.

## Cancel matrix

**Universal rule**: every successful Cancel transition releases the
Pokémon in-game (calls the same release handler the strict-cancel
v1.4 flow already uses). Without this, an attacker could "cancel" the
NFT but keep playing with the Pokémon in their Crystal save → exactly
the trust-loss the v1.5 redesign was meant to remove.

| Current status | Cancel allowed? | Effect |
|---|---|---|
| `pending_commit` | Yes (with `confirm()` modal) | Entry → `cancelled`. **Pokémon released in-game.** Nothing on-chain. |
| `commit_broadcast` | Yes (with strong warning) | Entry → `cancelled`. **Pokémon released in-game.** Commit may still land on-chain (already in mempool) but no mint will follow → no NFT. The on-chain commit is a public "I caught something hidden" with no payoff. |
| `commit_confirmed` | Yes | Entry → `cancelled`. **Pokémon released in-game.** Commit stays on-chain forever as opaque receipt; never becomes a Pokémon NFT (v1.5 spec: cancel is terminal, no Reactivate). |
| `pending_mint` | Yes | Same as `commit_confirmed`. **Pokémon released in-game.** Mint never broadcasts. |
| `mint_broadcast` | **No** | Button hidden. Display "Mint already broadcasting — cannot cancel. Tracking confirmation…". The Pokémon stays in-game (it's about to be canonical). |
| `mint_confirmed` | N/A | Done. Pokémon canonical, both in-game and on-chain. |
| `cancelled` | N/A | Terminal in v1.5. Row stays in IDB for audit/debug. No Reactivate UI — that's a v1.6 design question if real users ask. |

The user-confirmation modal text varies by status to make the
consequence explicit (especially "the commit you already inscribed
will stay on-chain forever even if you cancel now"). We never
silently mark a capture cancelled.

## Manual fallback (no wallet, no bridge)

Detection at module load:

```js
const hasWallet = typeof window.nintondo !== 'undefined';
const inBridge  = window.parent !== window  // iframe
                  && /* postMessage handshake done */;
const canDirectMint = hasWallet || inBridge;
```

If `!canDirectMint`, the capture handoff modal hides "Mint here
(direct)" and instead shows **Manual mint flow**:

```
┌─ Manual mint v1.5 (no wallet detected) ─────────────────────────┐
│  No window.nintondo found. Use this path to mint via the        │
│  Nintondo Inscriber UI manually.                                │
│                                                                 │
│  Step 1 — Inscribe the capture commit:                          │
│  [Copy capture_commit JSON]  [Open nintondo.io/inscriber ↗]     │
│  Commit inscription id:                                         │
│  [_______________________________________________________i0]    │
│  → On valid paste: auto-POST /api/captures, advance to step 2.  │
│                                                                 │
│  Step 2 — Inscribe the Pokémon mint:                            │
│  [Copy mint JSON]  [Open nintondo.io/inscriber ↗]               │
│  Mint inscription id:                                           │
│  [_______________________________________________________i0]    │
│  → On valid paste: auto-POST /api/mints, mark mint_confirmed.   │
│                                                                 │
│  Status: <pending_commit / commit_broadcast / etc.>             │
└─────────────────────────────────────────────────────────────────┘
```

Flow rules:

- Step 1 button stays the only available action until a 64hex+iN id is
  pasted in the commit field. Pending status visibly tied to step.
- Mint JSON is generated client-side once `commit_inscription_id` is
  known (no extra wallet call needed — `buildPokemonMintRecord` is
  pure JS, the salt + RAM are already in IDB).
- If user closes the tab between steps, the pending entry survives:
  on next boot, the manual modal can be reopened and resumed at the
  right step.
- `commit_inscription_id` / `mint_inscription_id` validation = format
  check (regex `^[0-9a-f]{64}i\d+$`). The indexer ping is **best-effort
  only**: it's a UX nicety to confirm the inscription was registered,
  but the manual flow MUST advance even if the indexer is unreachable.
  A user playing from a pure inscription host with our worker down
  must still be able to: copy commit JSON → inscribe → paste id →
  generate mint JSON → inscribe → paste id → done. Auto-register POSTs
  go through a retry queue (persisted in IDB alongside the pending
  entry) and can be replayed manually via a "Re-notify indexer" button
  if needed. The on-chain inscriptions are the canonical truth; the
  indexer is an optional convenience.

## UI surfaces

### In the capture handoff modal (right after a catch)

If wallet detected:
- Primary: **Mint here (direct)** → triggers commit + mint pipeline.
- Secondary: **Copy JSON + open companion** (legacy bellforge route).
- Tertiary: **Cancel mint** (releases Pokémon).

If no wallet:
- Primary: **Manual mint flow** (the Step 1 / Step 2 panel above).
- Secondary: **Cancel mint**.

### In the main game shell, "Pending mints" section

Always visible if any `pendingCaptures` row is not `mint_confirmed`:

```
Pending mints
─────────────
🟡 pending_commit       Slot 2  Lvl 5  ↻ 0 retries  [Mint here] [Cancel]
🟠 commit_broadcast     Slot 1  Lvl 7  ↻ 0          [Track] [Cancel]
🟢 commit_confirmed     Slot 3  Lvl 9  ↻ 0          [Inscribe mint] [Cancel]
🟢 mint_broadcast       Slot 5  Lvl 12 ↻ 0          [Track]
✅ mint_confirmed       Cyndaquil Lv.5 → /content/<id>i0  (archived)
🔴 cancelled            Slot 4  Lvl 6  (released)        (archived)
```

Each row preview text uses `preview_species_name` + `preview_level`
from the cached snapshot — but never publishes them to marketplaces
until `mint_confirmed`. Pending rows say "Slot N Lv X" not the species
name in collection-facing surfaces.

### Status badges color code

- 🟡 `pending_commit` — waiting for user action
- 🟠 `commit_broadcast` — in mempool, waiting for confirmation
- 🟢 `commit_confirmed` / `mint_broadcast` — actionable next step
- ✅ `mint_confirmed` — canonical
- 🔴 `cancelled` — terminal, archived

## Test plan stubs

Tests to add when implementing:

```
test('capture producer emits v1.5 commit + privateReveal + persists pending row')
test('boot resume: pending_commit shows in panel, no auto-action')
test('boot resume: commit_broadcast polls electrs and advances on confirm')
test('boot resume: commit_confirmed has Inscribe mint button + no commit re-broadcast')
test('boot resume: mint_broadcast polls electrs and advances on confirm')
test('cancel from pending_commit deletes nothing on chain, releases in-game')
test('cancel from commit_broadcast keeps commit on-chain, no mint follows')
test('cancel button hidden in mint_broadcast state')
test('idempotence: clicking Mint twice never inscribes 2nd commit')
test('manual fallback: no wallet → step 1 / step 2 form, advances on valid id paste')
test('manual fallback: pending row resumes at correct step on tab reopen')
test('mint_confirmed entry is archived not deleted')
```

## Out of scope for this pass

- RBF / fee bumping for stuck commit_broadcast / mint_broadcast txs.
  Manual workaround for now: wait or accept loss. Hardening v1.6.
- Sponsor / gasless mint. Wallet pays the fee, period.
- Cross-tab synchronization of pendingCaptures. IDB writes are visible
  across tabs of the same origin via the storage event; we'll poll on
  `visibilitychange` to refresh the UI when a sibling tab updates.
- Reactivate of cancelled captures. v1.5 cancel is terminal — the
  cancelled row stays in IDB for audit but no UI button can revive it.
  Revisit only if real users ask in v1.6+; rationale is keeping the
  state machine simple and the "Pokémon released in-game" guarantee
  irrevocable.

## Acceptance check before merge

- [ ] All six invariants enforced by code, not just by UI hints.
- [ ] State machine transitions tested individually.
- [ ] Resume from every non-terminal state tested.
- [ ] Cancel matrix tested (each cell).
- [ ] Manual fallback tested with `window.nintondo` deleted.
- [ ] Idempotence: simulating a double-click on Mint never produces
      two commits with the same attestation.
- [ ] Companion (legacy paste flow) still works end-to-end on a
      separate tab.
- [ ] No Quick mint / off-chain reveal UI surface remains (only
      legacy `/api/reveals/offchain` endpoint kept dead in code).
