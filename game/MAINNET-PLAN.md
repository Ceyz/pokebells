# PokeBells Mainnet Plan (Frozen 2026-04-24)

Frozen after 6 rounds of Claude + GPT review loop. Every file/line reference
verified against the repo. Treat the P0 list as binding — adding items
requires another review round.

## Canonical architecture

- **Play URL** = `bells-mainnet-content.nintondo.io/content/<root-id>` served
  directly from the Nintondo content host. The wallet extension injects
  `window.nintondo` natively (validated 2026-04-24).
- **Root HTML** = minimal launcher. Tabs (Play, Trainer, Pokedex,
  Leaderboard, Pending, Settings) live in swappable modules/manifests
  behind an `app_manifest_id` indirection. A UI bug does NOT require
  reinscribing the ROM.
- **Discovery order** (indexer, root, app manifest): URL param >
  `p:pokebells-collection.*_urls[]` (via indexer, then raw on
  content host) > baked fallback. localStorage is a validated
  cache only, never authoritative — see
  [ROOT-APP-DESIGN.md](ROOT-APP-DESIGN.md) "Discovery" section
  for the rationale (origin-safety P0 isn't empirically closed
  yet, so another inscription on the same content host could in
  principle poison localStorage).
- **Indexer** = verifiable applicative cache. Nintondo = dumb pipe for
  raw inscription lookup. Neither is an opaque authority.
- **Service fee** (0.001 BEL) baked in the official app PSBT, visible
  in the confirmation UI. Validator / indexer never require it for
  mint validity. A fork removes or redirects the fee trivially.
- **`bellforge.app` / companion / bridge** = mirrors, recovery, fallback.
  No mainnet-P0 path depends on them.

## P0 — live/integration (block mainnet until validated)

1. **Content-host direct path — VALIDATED 2026-04-24** (testnet live
   session, see `tools/TESTNET-LIVE-P0.md`). Root at
   `bells-testnet-content.nintondo.io/content/e1c15e0bd5b4be8a76cb03c35ebdb96388ea2528242f2cb57db6ce0e454f4ea2i0`
   injects `window.nintondo` (30 methods exposed),
   `connect('bellsTestnet')` returns the account silently (origin
   pre-approved from the 2026-04-24 mint session — normal wallet
   behaviour), `getNetwork()` returns `bellsTestnet`, the full PokeBells
   app loads (capture-core, gen2-species, shell, the whole module
   chain visible in boot logs). Minor: WASM streaming compile
   (`binjgb.wasm`) fails due to MIME `application/octet-stream`
   instead of `application/wasm`; falls back to `ArrayBuffer`
   instantiation, no functional impact. Nintondo ask: serve `.wasm`
   with the proper MIME.
2. **`/content/<id>` vs `/html/<id>` — RESOLVED 2026-04-24.**
   Empirically both serve the same bytes + both trigger wallet
   injection + both load the full PokeBells app. **Canonical: `/content/`**
   (it is what `boot.js` `CONTENT_BASES` already targets); `/html/`
   works as a fallback. No Nintondo viewer chrome observed on either
   for HTML-typed inscriptions.
3. **Origin safety — resolved 2026-04-24 with clone-injection probe.
   Nintondo extension keys on CONTENT (not per-inscription-id).**
   Empirical result from `tools/probe-clone-injection.mjs`:
   - Inscribed a byte-identical clone of the PokeBells testnet root
     (`e1c15e0b…`) at a NEW inscription id:
     `6c35d0f9a9c4caf3da5f96555fdbe51a053a8c7f81e8a0c0cc65e5883f4060c7i0`
     (53 057 bytes, ~41k sats fee, block 665838).
   - On the clone URL: `typeof window.nintondo === 'object'` AND
     `getAccount()` returns the operator address **silently** — no
     popup, same state as the real root.
   - The earlier "no injection on `0ea64bbd…`" result is consistent:
     the mini-test root has DIFFERENT bytes, so the content-based
     criterion didn't match. Injection is not per-inscription-id.

   **Mainnet threat vector (phishing flavor)**:
   1. Attacker inscribes a byte-identical copy of the mainnet root
      at a different inscription id.
   2. Social-engineers a user to visit the clone URL.
   3. User sees a UI that looks like PokeBells.
   4. Clone JS calls `window.nintondo.signPsbt(badPsbt)` with outputs
      to the attacker.
   5. **The Nintondo signPsbt popup still opens**, showing the tx
      details. An attentive user can reject; a distracted user clicks
      Sign and loses funds.

   **Technical mitigations already in place**:
   - signPsbt popup is inalienable (Nintondo always requires explicit
     confirmation on signature; cannot be bypassed by the page).
   - Multi-tab writer lease (P0 #11) blocks a second PokeBells tab
     (incl. a clone loaded as a second tab) from writing to the
     shared IDB while the original is active.
   - Our post-sign tx verification (P0 #6 post-sign half) does NOT
     help here — the clone controls its own JS and would bypass our
     `inscribePayloadOnChain` entirely, calling `signPsbt` directly
     with any PSBT.

   **Communication mitigations required before mainnet**:
   - Publish the canonical root inscription id prominently (Twitter
     profile, GitHub README, companion hub banner). Users should
     verify the URL matches this id before connecting.
   - Document the content-based injection finding so users know to
     verify signPsbt tx details on every signature, not just blindly
     approve.
   - Consider asking Nintondo to offer a per-inscription-id
     allowlist mode (would meaningfully tighten origin safety, but
     that's their roadmap, not ours).

   **Residual risk**: phishing + social engineering on signPsbt
   content review — the standard Web3 wallet threat model. Not
   unique to PokeBells; not a mainnet blocker; but needs honest
   communication.
4. **Storage scoping — CONFIRMED 2026-04-24.** Browser same-origin
   policy applies as expected: `localStorage` + IndexedDB
   (`pokebells-phase1@v4`) are SHARED across the two inscriptions on
   the same `bells-testnet-content.nintondo.io` origin. The secondary
   tab read the primary tab's localStorage marker verbatim and saw
   the same IDB database. This is why the design already treats
   `localStorage` as a validated cache, never an authoritative
   source (see [ROOT-APP-DESIGN.md](ROOT-APP-DESIGN.md) "Discovery"
   section). Wallet privkey stays inside the Nintondo extension,
   not in our storage, so the leak surface is limited to non-secret
   application state (pendingCaptures rows, cached save SRAM).
   Multi-tab writer lease (shipped in P0 #11) plus the fact that the
   user would need to voluntarily visit a hostile inscription next
   to PokeBells make this a manageable attack surface.

**Bonus observation**: the `BroadcastChannel` multi-tab warning
banner triggered correctly live on testnet when the operator opened
a second PokeBells tab. Lease lock mechanics validated end-to-end.
5. **Client mint guard.** Direct and manual mint flows refuse to sign
   the PSBT if the sprite resolver is absent or `mint.image` is non-
   canonical. Prevents the `image:null` orphan mints (3 lost on
   2026-04-24).
6. **PSBT safety.**
   - **Shipped 2026-04-24 — pre-build guard half.**
     `assertInscribeCallSafe` in `game/capture-core.mjs` runs at the top
     of `inscribePayloadOnChain` (`game/shell.js:4034`). Throws before
     any PSBT is built if the network is not whitelisted, the wallet
     address is missing / malformed, the fee rate is outside
     `[INSCRIBE_FEE_RATE_MIN..MAX]` sat/vB, the body is empty or
     exceeds `INSCRIBE_MAX_BODY_BYTES`, or the pubkey is not
     33/65-byte hex. 14 unit tests in `game/capture-core.test.mjs`.
   - **Deferred — post-sign PSBT decode.** Parsing the signed PSBT to
     confirm outputs go only to the connected wallet + the inscription
     envelope, with the visible service fee output pinned to the baked
     address. Threat model today is our own bugs (covered by pre-build
     guard); the inscriber bundle is chain-immutable. Promote to P0 if
     a collection update ever makes the inscriber mutable.
7. **Partial recovery live.** `commit_confirmed` then mint rejected,
   reload, retry without re-broadcasting the commit (popups 5-8 only).
8. **Queue / re-notify.** IDB queue survives reload, feedback visible
   on the button, retry succeeds or shows an explicit error.
9. **Root app inscribed.** Play tab + proposal of Trainer / Pokedex /
   Leaderboard / Pending / Settings tabs. Hub ceases to depend on
   `bellforge.app`. Full architecture in
   [ROOT-APP-DESIGN.md](ROOT-APP-DESIGN.md) (v3 frozen).
   - **Phase A shipped 2026-04-24**: `game/schemas/pokebells-collection.schema.md`
     refreshed to Crystal / v1.5 / species 1..251 / attestation v2.1;
     `game/collection.template.json` extended with `root_app_urls[]`,
     `app_manifest_ids[]`, `update_authority`;
     `validateCollection` in `game/indexer/src/validator.js` +
     12 unit tests in `validator.test.js`.
   - **Phase 0 PASS 2026-04-24**: sat-spend-v1 feasibility confirmed
     end-to-end on Bells testnet via `tools/probe-sat-spend.mjs`.
     Commit_2 deliberately spent the inscription UTXO of commit_1;
     both bodies remain readable post-sat-move. Fixture ids:
     `1d7056ea…ddc73di0` (collection-probe) +
     `036d7e5c…45113a2i0` (update-probe). Critical finding:
     Nintondo electrs filters UTXOs ≤ 1000 sats from the address
     endpoint, so Phase B tooling + indexer must track satpoints
     independently (see ROOT-APP-DESIGN.md "Phase 0 findings").
   - **LIVE TESTNET ROUND-TRIP PASS 2026-04-24** via
     `tools/phase-b-live-probe.mjs`. Full pipeline end-to-end on
     real Bells testnet: inscribe collection body → strict
     validator accepts → sat-spend-v1 update inscribed with
     commit tx spending the collection UTXO at vin[0] →
     `POST /api/collection-updates` accepted → `GET /api/collection/latest`
     returns the aggregated view with applied_updates=1, correctly
     prepended app_manifest_ids, and a current_satpoint equal to
     the update's `reveal_txid:0`. Fixtures (persisted as
     regression anchors):
     - collection: `1ecc86cd6983d4c8eab44d9f0b208bcba10852a37d17b6839d2d497819f5118di0`
     - update:     `890ea7191ff64fede254464889b0ea1c8cbfe6b03d69226ca3c9c68204b44856i0`
     - commit:     `09df8ee6426d5e0f52d77b9f951715fa7097d436fad5b372847444a0c406d30f`
     Phase B + C are now mainnet-ready from a code + protocol
     standpoint; the remaining gates are product decisions (multi-
     tab lease lock, service-fee address location) + the hub /
     root-app inscription choreography.
   - **Phase C shipped 2026-04-24 — boot.js discovery**:
     `game/boot.js` adds `DEFAULT_*_COLLECTION_ID` +
     `DEFAULT_*_INDEXER_URL` baked constants + an async
     `resolveAppManifestId(network, contentBase)` that walks the
     4-tier chain (URL param > indexer `/api/collection/latest` >
     raw collection inscription > baked manifest) with a 2 s timeout
     per remote tier + fail-open at every step. Discovery trace
     surfaces on `window.PokeBellsBoot.discovery` for devtools /
     Settings tab. `tools/bulk-inscribe.mjs` `fillRootHtml`
     substitutes the collection placeholder before the manifest
     placeholder (longest-prefix-first, since
     `REPLACE_ME_BEFORE_*_MINT` is a prefix of
     `REPLACE_ME_BEFORE_*_MINT_COLLECTION`). When the collection
     isn't yet inscribed, the placeholder stays in place and
     discovery skips tiers 2 + 3 gracefully — boot falls open to
     the baked manifest, preserving existing pre-collection
     behavior.
   - **Phase B shipped 2026-04-24 (core logic, no worker wiring yet)**:
     - Schema: `collections`, `collection_updates`, `rejected_updates`
       tables in `game/indexer/schema.sql`.
     - Builder: `buildCollectionUpdateRecord` + constants in
       `game/capture-core.mjs` (11 tests).
     - Validator: `validateCollectionUpdate` in indexer (12 tests).
     - DB helpers: `registerCollectionRoot`, `getCollectionRoot`,
       `insertAcceptedCollectionUpdate` (UNIQUE-enforced monotonic
       sequence), `recordRejectedUpdate` (audit trail, idempotent),
       `currentCollectionSatpoint` (derived deterministically from
       the accepted update chain, no separate sat tracker needed),
       `aggregatedCollectionLatest` (prepend-only aggregator)
       (12 tests).
     - Authority: `verifyCollectionUpdateAuthority` — sat-spend-v1
       check via electrs tx fetch (commit tx must spend the
       expected satpoint). Fail-closed on mainnet without electrs;
       testnet skipped:true fallback for local dev. 10 tests.
     - Worker routes shipped 2026-04-24: `POST /api/collections`,
       `POST /api/collection-updates` (full ingestion pipeline with
       strict network compare + sequence check + sat-spend authority,
       audit trail via `rejected_updates` on every reject path),
       `GET /api/collection/latest`. 12 smoke tests
       (`worker.test.js`) end-to-end with fake fetch + in-memory DB.
       indexer suite 78 → 90 tests. Still pending: D1 migration push
       + testnet live validation of the full round-trip.
   - **Phase C** (boot.js discovery + baked `DEFAULT_*_COLLECTION_ID`)
     still pending.
10. **Fork resilience.** Follow `OPEN_SOURCE.md` from scratch and
    confirm a fresh fork can deploy its own indexer in 2-3 hours.
11. **Multi-tab decision — shipped 2026-04-24.** Exclusive
    `navigator.locks` lease `pokebells:writer` held for the tab's
    lifetime. First tab = active writer (full UI); second tab =
    `isWriter=false` + read-only banner. Legacy BroadcastChannel
    warning-only banner kept as fallback for browsers without
    `navigator.locks`. Write-side guards at `persistPendingCapture`,
    `runDirectMintFlow`, `writeStoredExtRamSnapshot`,
    `markLocalSaveSyncedWithChain`, `backupStoredExtRamSnapshotIfMissing`,
    and `backupNamedExtRamSnapshot` via `assertMultiTabWriter`.
    Closes the emulator auto-save corruption vector (the original
    "j'ai lancé deux onglets en meme temps" bug). 4 tests in
    `game/capture-core.test.mjs`.

## P0 CI gate — keep green before release

Test suites that must pass:

- `game/capture-core.test.mjs`
- `game/pending-captures.test.mjs`
- `game/gen2-species.test.mjs`
- `game/wallet-adapter.test.mjs`
- `game/signin-verify.test.mjs`
- `game/pbrp/session-key.test.mjs`
- `tools/bulk-inscribe.test.mjs`

Indexer:

- `cd game/indexer && npm run check` — syntax checks on `worker.js`,
  `validator.js`, `db.js`.
- `cd game/indexer && npm test` — runs
  `game/indexer/src/validator.test.js` (schema-stage smoke) and
  `game/indexer/src/db.test.js` (insertPokemon + isStarterRaceError).
  23 tests, shipped 2026-04-24.

ROM / chunk invariant:

- Chunk tamper and wrong ordering must refuse boot. Logic exists at
  `game/shell.js:1417` (chunk size + sha256) and `game/shell.js:1458`
  (assembled ROM sha256 compared to `manifest.rom.sha256`). **Pin with
  a unit test** — do not re-implement.

## P1 — indexer correctness (shipped 2026-04-24)

Shipped:
- `isStarterRaceError(e)` exported from `game/indexer/src/db.js`.
  Matches both `UNIQUE constraint failed` wording AND the specific
  `idx_pokemon_starter_unique` index name. Inspects `e.message` and
  `e.cause.message` so the helper keeps working if D1 wraps the
  SQLite error in a cause chain.
- `insertPokemon` retry branch now calls the helper instead of the
  broad `/UNIQUE constraint/i` regex. A PK duplicate on
  `pokemon.mint_inscription_id` rethrows cleanly; no spurious starter
  retry.
- 8 `insertPokemon` tests in `game/indexer/src/db.test.js` cover happy
  path, subsequent mint, starter race retry, PK duplicate, unknown D1
  error, and the isStarterRaceError error matrix (including
  `e.cause.message` wrapping).

Deferred:
- Inspect the real D1 error shape (`e.code`, `e.cause`,
  `Object.keys(e)`) in miniflare when convenient and promote to
  structured code matching if a stable field exists. Current string
  match is surgical enough for mainnet.

## P1 — follow-ups from shipped P0

- Post-sign PSBT decode (deferred half of P0 #6). Parse the signed
  PSBT to confirm outputs go only to the connected wallet + the
  inscription envelope; enforce the service-fee output is pinned to
  the baked address + expected amount. Bump to P0 if the inscriber
  ever becomes mutable via collection update.
- Disable write buttons in the UI when `state.multiTab.isWriter === false`
  (currently read-only mode relies on the guard-throw to surface). Visual
  disable is a UX polish, not a safety gap.

## P1 — UX and decentralization

- Trainer tab reads `pokemon[]` from `/api/trainer/<wallet>`; shows
  sprite, level, shiny, starter flag, mint id.
- Pokedex tab wired to `/api/pokedex`.
- Leaderboard tab wired to `/api/leaderboard`.
- Save restore from a new device (requires encrypted save per
  `game/CRYSTAL-MIGRATION-TODO.md:213` PURE-SAVE-2).
- `detectMode` sandbox: P1 UX unless a sandboxed iframe can expose
  `signPsbt` / trigger the bridge silently — in which case bumps to
  P0 origin safety.
- `ORD_BASE` override for a forked indexer scanning a different ord node.
- Nametag sanitizer edge cases: bidi, ZWJ / emoji, combining
  diacritics, RTL.
- Bridge fallback: method allowlist, `?game=`, `?indexer=`, wallet
  absent, iframe sandbox.

## Product decisions — trench before mainnet

1. **Multi-tab — DECIDED 2026-04-24: lease lock.** Implemented via
   `navigator.locks` exclusive lease `pokebells:writer` (P0 #11
   above). Save-snapshot write guard is the remaining sub-item,
   tracked as P1 below.
2. **`op:"collection_update"` authority — DECIDED v3: sat-spend-v1.**
   Valid iff the commit tx of the update's reveal tx spends the UTXO
   currently holding the collection root inscription (ordinals-native
   custody primitive, no `signMessage` dependency). Rotation =
   issue a `collection_update` whose reveal output 0 sends the sat
   to a new address / multisig; off-protocol transfers are
   explicitly banned in v1 because the indexer's derived satpoint
   cannot follow them. See
   [ROOT-APP-DESIGN.md](ROOT-APP-DESIGN.md) "Authority" and
   "Signer rotation model — v1 constraint". Shipped in Phase B
   (validator + DB monotonicity + authority check). Phase 0 probe
   PASS on 2026-04-24 confirms the primitive is achievable with
   the production inscriber tooling.
3. **Service fee address location.** Baked in the official app module
   (recommended and accepted) vs resolved via
   `p:pokebells-collection`. Baked = immutable per inscription, fork
   removes or replaces trivially, no update-attack vector.

## Assumptions

- The inscribed app is the canonical product. `bellforge.app` is a
  mirror / fallback.
- The PokeBells indexer is a verifiable applicative cache, never an
  opaque authority.
- The indexer source can live as an inscription; the runtime stays a
  redeployable service (CF Worker / VPS / full node).
- Replacing the indexer must never require reinscribing the ROM or
  the sprites.
- A future in-game leaderboard = web overlay first, not a ROM
  modification.
- Service fee = UX revenue, not a protocol validity rule.
- `save-snapshot` on mainnet = encrypted only. Clear-text SRAM is
  acceptable on testnet only. See `game/CRYSTAL-MIGRATION-TODO.md:213`
  PURE-SAVE-2 for the encryption scheme.

## Historical notes

Learnings from the 6-round review that should not be re-relitigated:

- ROM hash verify was already implemented at `game/shell.js:1417` and
  `game/shell.js:1458`. Originally flagged as a new P0 before the code
  was checked. Pinned as a CI invariant instead.
- State machine (7 states + cancel matrix), `party_slot_index` v2.1,
  canonical `mint.image` / `name` / `attributes` validator, and
  `save-snapshot` schema are all covered in existing unit tests.
  Live / integration coverage is the real gap.
- `is_starter` retry logic at `game/indexer/src/db.js:403-414` depends
  on string regex matching SQLite error text. Fragile; needs a
  structured check (see P1 indexer correctness).
- The wallet injects on `bells-*-content.nintondo.io` content hosts
  natively. `bellforge.app` is not required for the primary play URL.
  Earlier assumption ("content host doesn't inject") was never
  empirically tested before 2026-04-24.
