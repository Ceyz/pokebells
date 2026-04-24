# Root App Indirection — Design v3 (frozen)

Status: **v3 frozen 2026-04-24 after three GPT rounds.** Implements
P0 #9 (root app inscribed) and resolves product decision #2
(`op:"collection_update"` authority mechanism). Depends on
MAINNET-PLAN.md. Two sub-items gate implementation: the Phase 0
feasibility probe below, and the same-block ordering constraint in
the authority rule.

## Motivation

The canonical Play URL is content-host direct:
`bells-mainnet-content.nintondo.io/content/<root-id>`. But a root
inscription is **immutable**, so a UI bug means a new root URL unless
we add an indirection layer. Without indirection the user base
splits between old and new inscriptions every patch; we have to
re-announce on Twitter / Discord each time.

Target outcome: after the first mainnet root, UI fixes reinscribe
only a module (or at most a manifest), never a new root. Users stay
on the same URL and pick up updates automatically.

## Current chain (already mostly right)

```
root.html  (inscribed, baked boot.js + DEFAULT_*_MANIFEST_ID)
  |
  `- ?manifest=<id> URL param, OR baked DEFAULT_*_MANIFEST_ID
        |
        `- p:pokebells-manifest JSON inscription
              |-- rom_manifest_inscription_id
              |-- sprite_pack_manifest_inscription_id
              |-- modules.capture_core -> inscription id
              |-- modules.shell        -> inscription id
              `-- ... (all module keys)
```

`boot.js` already has a manifest-id indirection
(`game/boot.js:114-119`). Missing pieces for mainnet:

1. A way to change the "current" manifest for everyone without
   asking them to change the URL.
2. A canonical place to publish indexer / companion / bridge / root
   URL history.
3. An authority mechanism for those updates that does **not** depend
   on Bells wallet signMessage (still unresolved) and cannot be
   spoofed by inscribing from any wallet.

## Target chain

```
root.html  (inscribed, baked DEFAULT_*_MANIFEST_ID + DEFAULT_*_COLLECTION_ID)
  |
  `- discovery resolution (see "Discovery" below)
        |
        +- path for app_manifest_id (boot-critical)
        |     `- p:pokebells-manifest -> modules as today
        |
        `- path for indexer_url, bridge_url, companion_url (post-boot)
              `- p:pokebells-collection (immutable body) + aggregated
                 op:"collection_update" inscriptions via indexer

p:pokebells-collection   (one root inscription, immutable body)
  |-- indexer_urls[]        (already exists)
  |-- companion_urls[]      (already exists)
  |-- bridge_urls[]         (already exists)
  |-- root_app_urls[]       (NEW: latest at index 0; may be empty at
  |                          initial mint — see "Mint choreography")
  |-- app_manifest_ids[]    (NEW: latest at index 0)
  |-- update_authority      (NEW: see "Authority" section)
  `-- schema_ref           -> "op:collection_update v1"

op:"collection_update" inscriptions
  |-- Append-only pointer updates aggregated by indexers
  |-- Authority = the commit tx of the update's reveal spent the
  |   UTXO that held the collection root inscription
  |-- Indexer fails CLOSED on any update that does not satisfy the
  |   authority rule or breaks sequence monotonicity
  `-- Shell consults the indexer on boot for the aggregated view;
      shell may fail OPEN for DISCOVERY (baked defaults work), but
      the indexer itself never accepts a spoofable update
```

## Authority — spending the collection root sat

**Rejected: "sender of reveal tx".** That primitive is spoofable:
anyone can inscribe a `collection_update` body and transfer the
resulting inscription to the operator's address, and any naive
"sender / owner" check sees a match. Discarded in v3.

**Primary authority (v3): the commit transaction of the update's
reveal tx must spend the UTXO that held the collection root
inscription.** The operator demonstrates custody by actually
spending the collection root sat during the inscription process;
after the update confirms, the collection root sat has moved (to
an output the operator controls) and the next update must spend
that new location.

Formal rule:

> Let `S` be the satpoint (`txid:vout`) of the collection root
> inscription at the instant immediately before the update's
> **commit transaction** is processed in canonical chain order
> (block height, then tx index within block).
> The update is valid iff `S` appears as an input to the commit
> transaction of the update's reveal tx.
>
> **v1 same-block constraint.** If a block contains BOTH a transfer
> of the collection root sat (some tx spending `S`) AND a
> `collection_update` referencing the same collection, the update
> is REJECTED (recorded in `rejected_updates`) regardless of tx
> ordering within the block. The operator must wait for at least
> one confirmation between transferring the collection root and
> broadcasting an update. Eliminates same-block ordering ambiguity
> and reorg corner cases for v1; removable in v2 once the indexer
> has canonical tx-order satpoint tracking under reorg pressure.

This reuses ordinals' native custody primitive without requiring
Bells-specific signMessage semantics. Rotation is trivial: the
operator transfers the collection root to a new address (or a
multisig) and from that point on, only spends from that address can
authorize updates.

Verification work for the indexer (Phase B):
- Track the collection root inscription's satpoint over time. Every
  block, scan for spends of the current location; record the new
  location.
- When ingesting a `collection_update`:
  - Look up the collection root satpoint as-of `B - 1`.
  - Fetch the commit tx of the update's reveal tx.
  - Require one of the commit's inputs to equal that satpoint.
  - Reject otherwise, record in `rejected_updates`.
- Fail CLOSED on ANY failure to verify: electrs down, sat tracking
  missing a block, anything ambiguous. A silent pass on a spoofable
  update is worse than a visible "update not yet verified".

**Optional signature binding (deferred to v2 of this op).** Once
Bells signMessage is proven stable, a future `op:"collection_update"
v2` can add a `signature` field as defense-in-depth. Not required
for v1 validity; v1 validity is satpoint-only.

**Parent/child ordinals mechanism.** If Bells ord ever exposes the
Bitcoin-style parent / child inscription pointer natively (a child
inscription declares `parent: <id>` and mint requires spending the
parent sat as an input), `collection_update` can be re-expressed as
a child of the collection root with cleaner verification. Worth
probing; not required for v1.

## Bootstrap — avoiding the circularity

Root HTML must discover the collection without fetching any manifest
first. Decision: **bake `DEFAULT_*_COLLECTION_ID` in root**,
alongside `DEFAULT_*_MANIFEST_ID`. Boot fetches both in parallel.
The collection gives `app_manifest_ids[0]`, preferred over the
baked manifest id if different.

Cost: one extra baked constant, one extra parallel fetch at boot.
Benefit: clean bootstrap, no redirect chain.

## Discovery — shell may fail open, indexer never does

### Shell resolution for `app_manifest_id` (boot-critical)

Earliest wins, fail-open to later tiers if the earlier one is
unreachable / invalid:

1. `?manifest=<id>` URL param — explicit per-session opt-in.
   Requires deliberate user action (pasting a URL); not silent
   poisoning.
2. `p:pokebells-collection.app_manifest_ids[0]` via indexer
   `/api/collection/latest` (2 s timeout).
3. Same field from the raw collection inscription body (fallback
   when indexer is down, content host still works).
4. Baked `DEFAULT_*_MANIFEST_ID` (works offline).
5. (`localStorage` is NOT in this chain — see below.)

### `localStorage` is a validated cache, never an authority

Until P0 origin/storage safety is proven (MAINNET-PLAN.md #3 + #4),
another inscription on the same content host could in principle
write to `localStorage.pokebells:app_manifest_id` and silently
redirect subsequent boots. Until that risk is empirically closed:

- Boot MAY cache the resolved manifest id in `localStorage` under
  `pokebells:app_manifest_id_cache:<network>` **alongside** the
  collection id it was resolved against.
- On next boot, the cache is used as a performance optimization
  ONLY IF the collection inscription still advertises the same
  `app_manifest_ids[0]`. Any mismatch = drop cache, re-resolve
  from the collection.
- Cache never overrides an authoritative source; it only
  short-circuits the `app_manifest_ids[0]` lookup when the
  collection agrees.

Any other `localStorage` key the user / a third party might have
set (e.g. legacy `pokebells:manifest_url`) is ignored by boot.

### Indexer `/api/collection/latest` — fail-closed

The indexer is the one place that MUST never return a spoofable
update. Rules:
- On any update whose authority check fails, indexer records
  `rejected_updates` and does NOT include it in the aggregated
  view.
- If the indexer cannot verify an update (missing sat tracking
  data, electrs unreachable, block not yet indexed), the endpoint
  returns the aggregated view **as of the last fully-verified
  update** and a `stale_until_block` field so shells can decide
  whether to trust or fall back.
- The shell's fall-open path (step 3 above) reads the on-chain
  collection inscription verbatim, so a down indexer never
  prevents launch — but a misbehaving indexer can never inject a
  bad manifest either.

## Mint choreography — ordering the first mainnet inscriptions

Because root HTML bakes `DEFAULT_*_COLLECTION_ID`, the collection
must be minted before the root. And because the collection's
`root_app_urls[]` points at the root URL, it can't be populated at
initial mint either. Sequence:

1. **Mint the first `p:pokebells-manifest` inscription** (module
   keys all filled with already-inscribed module ids). Record
   `<manifest-v1-id>`.
2. **Mint the initial `p:pokebells-collection` inscription**, with:
   - `app_manifest_ids`: `["<manifest-v1-id>"]`
   - `root_app_urls`: `[]` (empty; root not yet minted)
   - `update_authority`: `{ "scheme": "sat-spend-v1" }`
   - Operator-controlled wallet holds the collection sat.
   Record `<collection-v1-id>`.
3. **Mint the root HTML inscription** with baked constants:
   - `DEFAULT_*_MANIFEST_ID = <manifest-v1-id>`
   - `DEFAULT_*_COLLECTION_ID = <collection-v1-id>`
   Record `<root-v1-id>`.
4. **Broadcast the first `collection_update`** prepending
   `<root-v1-url>` to `root_app_urls`:
   - Commit tx spends the UTXO currently holding
     `<collection-v1-id>`.
   - Reveal carries the `op:"collection_update"` body.
   - After confirmation, the collection root sat is at a new
     location (operator-controlled); next update spends from there.
5. **Verify end-to-end**: `GET /api/collection/latest` returns
   `app_manifest_ids: ["<manifest-v1-id>"]` + `root_app_urls:
   ["<root-v1-url>"]` (after indexer catches up). Companion + any
   external linker reads this aggregated view.

Same sequence on testnet before mainnet. Phase C acceptance depends
on the testnet choreography working end-to-end.

## Schema — p:pokebells-collection extension

Additive change to `collection.template.json`. Existing fields
stay as-is. New fields:

```json
{
  "p": "pokebells-collection",
  "v": 1,
  "...": "existing fields unchanged",
  "root_app_urls": [],
  "app_manifest_ids": ["<manifest-v1-id>"],
  "update_authority": {
    "scheme": "sat-spend-v1",
    "comment": "Valid collection_update must spend the UTXO holding this collection's inscription sat. Signature field optional, deferred to update schema v2."
  }
}
```

Semantics:
- Latest item is at index 0 in each list (prepend on update, never
  remove). Older entries retained for auditability.
- `update_authority.scheme` is frozen to `sat-spend-v1` at root
  inscription time. Migrating to a different scheme = new
  collection root.
- Explicit non-goal: **service fee address is NOT stored here**. It
  lives baked in the official app module (MAINNET-PLAN.md decision
  #3). A compromised `collection_update` must not be able to
  redirect fees.

## Schema — op:"collection_update" v1

```json
{
  "p": "pokebells",
  "op": "collection_update",
  "v": 1,
  "network": "bells-mainnet",
  "collection_inscription_id": "<collection-v1-id>",
  "update_sequence": 3,
  "issued_at": "2026-06-01T12:00:00.000Z",
  "set": {
    "app_manifest_ids_prepend": ["<new-manifest-id>"],
    "root_app_urls_prepend": ["https://..."]
  }
}
```

### `set` semantics (explicit)

- Allowlist (v1): `app_manifest_ids_prepend`, `root_app_urls_prepend`,
  `indexer_urls_prepend`, `companion_urls_prepend`,
  `bridge_urls_prepend`. Any other key in `set` = reject.
- Lists only. Values must be arrays of the expected element shape
  (URL strings for `*_urls`, inscription ids for `*_ids`).
- Semantics: **prepend** new entries to the front of the existing
  list. Old entries are NEVER removed or reordered by an update.
- **Scalars cannot be changed by v1 updates**: any scalar field
  baked into the collection root (slug, name, etc.) stays baked.
  Scalar migration = new collection root.

### Indexer validation rules (fail-closed)

- `p` / `op` / `v` exactly match.
- `collection_inscription_id` must resolve to a known collection
  root on the same `network`.
- `update_sequence` strictly greater than the previous accepted
  update for this collection.
- All keys in `set` must be in the v1 allowlist above.
- All values must be arrays of the expected shape.
- Authority rule (sat-spend-v1): commit tx of the update's reveal
  tx must have spent the collection root sat's satpoint as-of the
  block before confirmation.
- Any verification failure → record in `rejected_updates`, do not
  include in aggregated view.

Indexer endpoint: `GET /api/collection/latest?network=bells-mainnet`
→ collection body with all accepted updates applied in sequence
order. Includes `stale_until_block` if there are pending updates
the indexer hasn't fully verified yet.

## Migration phases

**Phase 0 — sat-spend feasibility probe. SHIPPED + PASS 2026-04-24.**

`tools/probe-sat-spend.mjs` ran end-to-end on Bells testnet, producing
two on-chain fixture inscriptions:

- collection-probe: `1d7056ea2dab7a44c40a5921ccf27e629c91907c61f5041cf917a8ec76ddc73di0`
  (testnet block 665484)
- update-probe: `036d7e5c6bb1918426a23956a55e2e5842d7cd45178e7329dc62e67d245113a2i0`
  (testnet block 665486)

Observed commit_2 inputs: `1d7056ea:0 (1000 sats — the inscription
UTXO) + f051798b:1 (93,157,382 sats — funding change)`. The update's
commit transaction deliberately spent the collection-probe's UTXO, and
both inscription bodies remain readable at the content host after the
sat-move. sat-spend-v1 is empirically feasible with the production
bells-inscriber tooling.

### Phase 0 findings (binding on Phase B)

- **Nintondo electrs dust filter.** `/address/<addr>/utxo` returns
  outputs only above a dust threshold (empirically ≥ 1001 sats on
  testnet 2026-04-24). The inscription UTXO (1000 sats = Bells
  `UTXO_MIN_VALUE`) is **invisible** via this endpoint even though
  it is unspent on chain. Tooling that wants to spend a specific
  inscription UTXO cannot rely on the address UTXO endpoint — it
  must track the target satpoint independently (via reveal-tx
  output inspection, or via block-by-block spend scan).
- **Consequence for Phase B operator tooling.** The `collection_update`
  builder must construct the inscription UTXO manually from the most
  recent satpoint (reveal tx of the last accepted update, or the
  original collection root reveal if none yet). It cannot rely on
  electrs address UTXO fetch.
- **Consequence for Phase B indexer.** The indexer validator tracks
  the collection root satpoint via its own chain scan; it does NOT
  consult the address UTXO endpoint. (Already implied by the design,
  now confirmed by the tooling gap.)
- **`UTXO_MIN_VALUE` is 1000 sats** in Bells (see
  `tools/pokebells-inscriber/src/consts.mjs`), not 546 as in
  Bitcoin ordinals. Tests + validators should reference this
  constant by name, not hard-code a value.

### Probe artifacts

Persisted in git as Phase B acceptance fixtures:
- `tools/probe-sat-spend.mjs` — the standalone probe script.
- `tools/PROBE-SAT-SPEND.md` — the operator procedure.
- `tools/probe-sat-spend.log` — the PASS run log (kept in repo for
  reproducibility; regenerated on future probes).

**Phase A — collection schema extension + schema doc refresh.
SHIPPED 2026-04-24.**
- `collection.template.json` extended with `root_app_urls[]` (empty
  at initial mint per choreography), `app_manifest_ids[]`,
  `update_authority: { scheme: "sat-spend-v1" }`.
- `game/schemas/pokebells-collection.schema.md` rewritten from Gen 1
  era (`capture_schema_version: "1.2"`, attestation v1,
  `max_species_id: 151`, `rom_sha1`, `operator_signature`,
  `default_manifest_inscription_id`) to Crystal / v1.5 era, with
  the new indirection fields + `sat-spend-v1` authority section.
- `validateCollection` added to `game/indexer/src/validator.js` with
  12 unit tests in `game/indexer/src/validator.test.js` covering
  shape checks, URL format, inscription id format (+ REPLACE_
  placeholder for pre-mint templates), authority scheme freeze to
  `sat-spend-v1`, networks allowlist, and deep-copy normalization.
- Phase A does NOT yet wire ingestion / aggregation — those land in
  Phase B. Validator export is available for Phase B consumption.
- Acceptance met: the new template validates; inserted data passes
  the schema; indexer `npm test` suite grew from 23 to 35.

**Phase B — core logic SHIPPED 2026-04-24; worker route still pending.**

Shipped (196/196 tests green):
- Schema (schema.sql): `collections` (one row per registered root),
  `collection_updates` (append-only, UNIQUE on
  (collection, network, update_sequence) — replays and
  out-of-order sequences rejected at storage layer),
  `rejected_updates` (audit trail, idempotent).
- Builder (`capture-core.mjs` `buildCollectionUpdateRecord`):
  canonical body with the `_prepend` allowlist, scalar keys
  rejected at build time.
- Validator (`indexer/src/validator.js` `validateCollectionUpdate`):
  schema stage. Rejects wrong p/op/v, bad network, malformed
  collection id, non-positive sequence, empty or malformed set,
  set keys outside the allowlist, non-array or empty-array set
  values, non-inscription-id entries in `app_manifest_ids_prepend`,
  non-URL entries in `*_urls_prepend`.
- DB helpers (`indexer/src/db.js`): `registerCollectionRoot`
  (idempotent), `insertAcceptedCollectionUpdate` (UNIQUE-enforced),
  `recordRejectedUpdate` (idempotent audit), `currentCollectionSatpoint`
  (derives the satpoint deterministically from the accepted update
  chain — no separate sat tracker needed because the chain itself
  says where the sat is), `aggregatedCollectionLatest` (prepend-only
  aggregator that returns root body + applied updates in sequence
  order, plus stats + current satpoint).
- Authority check (`indexer/src/validator.js`
  `verifyCollectionUpdateAuthority`): fetches the update's reveal
  tx + its commit tx via electrs, verifies one of the commit tx
  inputs matches the expected satpoint. Fail-closed on mainnet
  without `ELECTRS_BASE_MAINNET`; testnet `skipped:true` fallback
  for local dev. Tests cover the full matrix (pass, wrong
  satpoint, fetch failures, malformed inputs, mainnet
  fail-closed, testnet skipped).

Still pending in Phase B:
- Worker route wiring in `indexer/src/worker.js`:
  `POST /api/collections` (operator registers the root body),
  `POST /api/collection-updates` (ingestion pipeline:
  fetch inscription body from content host → validate schema →
  load `currentCollectionSatpoint` → `verifyCollectionUpdateAuthority`
  → `insertAcceptedCollectionUpdate` on success, `recordRejectedUpdate`
  on any failure), `GET /api/collection/latest` (returns
  `aggregatedCollectionLatest`).
- D1 migration ingestion so `schema.sql` changes auto-apply on the
  next deploy (the existing GHA hook handles this; just needs the
  schema push).

Acceptance met for the core logic: validator rejects all the shape
errors, DB layer enforces monotonicity + idempotency, authority
check refuses anything that doesn't spend the expected satpoint,
mainnet fails closed when electrs is unavailable. Integration with
live chain is the remaining worker-route work.

**Phase C — boot.js collection-aware discovery.**
- Bake `DEFAULT_*_COLLECTION_ID` alongside `DEFAULT_*_MANIFEST_ID`
  in boot.js.
- Implement the 4-tier shell resolution chain (URL > indexer >
  raw collection > baked; localStorage only as validated cache).
- 2 s timeout + fail-open at every shell tier.
- Expose the resolved path via `window.PokeBellsBoot.discovery` for
  debugging.
- Acceptance: an out-of-date baked manifest is transparently
  replaced when a newer `app_manifest_ids[0]` is available;
  offline / indexer-down boot still works with baked defaults.

**Phase D — shell.js tab split (P1, not a mainnet blocker).**
- Extract Trainer / Pokedex / Leaderboard / Pending / Settings from
  the ~5200-line `shell.js` into separate modules.
- Root HTML stays small; Pokedex tweak = reinscribe one module + one
  manifest, no root reinscription.
- Velocity improvement after mainnet launch, not a prerequisite.

**Phase E — UI for collection updates (post-launch).**
- Settings tab shows current resolution path (which tier won).
- Collection history viewer (all applied `update_sequence` values
  + the current aggregated state).

## Open decisions — resolved in this doc

### Decision #2 — `op:"collection_update"` authority

**Resolved: sat-spend-v1.** Commit tx of the update's reveal tx
must spend the UTXO holding the collection root inscription.
Independent of signMessage. Rotation = transfer the collection
root to a new address (single-key or multisig). Signature binding
reserved for update-schema v2 once Bells signMessage is stable.

### Signer rotation model

**Resolved: rotation = transfer the collection root inscription.**
No "migrate from single-wallet to multisig via special update"
complexity. The root body fixes the authority *scheme*
(`sat-spend-v1`); the current holder can move the inscription to
any address they choose.

### Service fee boundary

**Resolved: baked in the official app module, never in the
collection.** A compromised `collection_update` must not redirect
fees. MAINNET-PLAN.md decision #3.

### Revocation / rollback

If an update points at a broken manifest:
1. Owner of the collection root issues a new `collection_update`
   prepending a known-good manifest id (latest at index 0 wins).
2. Power users set `?manifest=` in the URL.
3. Last resort: worst case, users fall back to baked
   `DEFAULT_*_MANIFEST_ID` which always works.

No automatic rollback — manual + authoritative.

## Acceptance criteria for mainnet launch

Before the first root mainnet inscription:

- [ ] **Phase 0 probe passed on testnet**: sat-spend commit-tx
      mechanics verified against the production Bells inscription
      pipeline (Nintondo Inscriber UI AND bells-inscriber client-
      side), including the satpoint-moves-to-commit-tx-output
      expectation.
- [ ] Phase A shipped + verified on testnet: schema doc refreshed,
      collection template extended, indexer accepts new fields.
- [ ] Phase B shipped + tested on testnet with:
      (a) valid update accepted,
      (b) spoof update (inscribed from wrong wallet) rejected,
      (c) replay rejected, out-of-sequence rejected,
      (d) scalar-set key rejected.
- [ ] Phase C boot.js shipped + verified in browser: altering the
      collection on testnet makes a reloaded browser pick up the
      new manifest; offline / indexer-down boot still works.
- [ ] `DEFAULT_*_COLLECTION_ID` baked in the root before minting.
- [ ] Collection root inscription held by the operator's
      designated wallet before broadcasting the first update.
- [ ] Mint choreography executed on testnet end-to-end before
      mainnet: manifest → collection → root → first update.
- [ ] Recovery playbook documented.

Phase D and Phase E are post-launch.

## Dependency risks

1. **Satpoint tracking cost.** The indexer must scan every block
   for spends of the current collection root UTXO. This is O(tx
   inputs per block); negligible for a single inscription tracked
   per network, but non-trivial compared to the current indexer
   which does not track sats. Implementation needs careful
   reorg-safety.
2. **Electrs unreachability during a verification.** Fail-closed
   means unverified updates don't reach the aggregated view. The
   shell falls back to the raw collection inscription, which
   works, at the cost of losing the latest updates until electrs
   returns.
3. **Collection root transfer accident.** If the operator
   accidentally transfers the collection inscription to an
   address they don't control, authority is lost — the aggregated
   state freezes at its current value. The baked default
   manifest + URL param escape hatch keep users functional, and
   a new collection root + new root HTML is always a fresh
   start. Mitigation: keep the collection inscription in a cold
   wallet with paranoid handling.
4. **localStorage silent-poison vector.** Until P0 origin /
   storage safety is empirically closed, `localStorage` is a
   cache validated against the on-chain collection, NEVER an
   authoritative source. Revisit this constraint after the
   origin-safety testnet check.
