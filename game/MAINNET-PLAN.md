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
  localStorage > `p:pokebells-collection.*_urls[]` > baked fallback.
- **Indexer** = verifiable applicative cache. Nintondo = dumb pipe for
  raw inscription lookup. Neither is an opaque authority.
- **Service fee** (0.001 BEL) baked in the official app PSBT, visible
  in the confirmation UI. Validator / indexer never require it for
  mint validity. A fork removes or redirects the fee trivially.
- **`bellforge.app` / companion / bridge** = mirrors, recovery, fallback.
  No mainnet-P0 path depends on them.

## P0 — live/integration (block mainnet until validated)

1. **Content-host direct path.** Wallet connect, durable storage, catch,
   direct mint, indexer sync, reload — end-to-end on a real testnet wallet.
2. **Choose `/content/<id>` vs `/html/<id>` officially.** Decide the
   canonical Play URL form after comparing wallet injection, storage
   persistence, rendering stability.
3. **Origin safety.** Another inscription on the same content host must
   not be able to reuse the wallet permission or call sensitive methods
   silently.
4. **Storage scoping.** IDB / localStorage isolation across inscriptions
   served by the same content host.
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
   `bellforge.app`.
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
2. **`op:"collection_update"` signer.** Deployer wallet (simple, single
   point of failure) vs multisig (robust, more complex UX). No current
   recommendation.
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
