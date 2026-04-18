# PokeBells Session Memory

Last updated: 2026-04-18
Workspace: `Z:\PokeBells`

## Current Goal

Build PokeBells so the game/runtime can live in inscriptions, captured Pokemon can become NFT-like assets with rich metadata, and the wallet/mint flow works with the least friction for players.

## Architecture Decision (final, 2026-04-18)

**Hybrid architecture: game-as-inscription + GH Pages companion for wallet ops + sign-in identity.**

- **Inscription** (`nintondo.io/bells/inscriptions/<game-id>`) hosts the game itself: ROM chunks pulled from on-chain inscriptions, binjgb emulator, capture detection, capture JSON generation. **Read-only** wrt wallet — receives `?wallet=<addr>&sig=<sig>` URL params, verifies signature locally, loads owned Pokemon from chain. Zero IP hosted on a domain we own.
- **GH Pages companion** (`<owner>.github.io/pokebells` or custom domain) is **wallet-only**: sign-in via `signMessage`, generates the verified game URL for the player, and acts as the mint surface for capture JSONs (paste JSON → builds PSBT → signs → broadcasts). No ROM, no emulator, no Pokemon sprites — just a wallet utility specialized for PokeBells JSON inscriptions. Legal exposure minimized.
- **Two clipboard handoffs per session**: (1) copy signature from companion sign-in into inscription URL/state; (2) copy capture JSON from inscription, paste into companion mint UI. No way around this — wallet is in extension origin, isolated from inscription iframe.

**Why this is the floor**: Nintondo dev confirmed (2026-04-18 Telegram) they will not ship a wallet bridge for inscriptions because of drainer risk. So no wallet inside `content.nintondo.io` ever. Hybrid is the only path that combines on-chain canonical game + working wallet + minimum legal exposure.

**OP_CAT activation update (2025-12)**: OP_CAT is live on Bells mainnet since Christmas 2025. CAT20 tokens are now executable. $POKEBALL becomes a real token, burned atomically with each Pokemon mint via the companion's PSBT builder. Phase 8 in the roadmap is no longer gated.

## What We Have Built

### Phase 1 shell and ROM pipeline
- `phase1/build-rom-manifest.mjs` — splits ROM into inscription-sized chunks, generates local/testnet manifests.
- `phase1/manifest.local.json`, `manifest.testnet-template.json`, `inscription-plan.template.json`
- `phase1/index.html` — browser shell UI, adapter selector, diagnostics, mint flow, party/box display.
- `phase1/shell.js` — reassembles chunks, verifies hashes, caches in IndexedDB, boots binjgb, RAM watcher, wallet UI, SRAM sync.

### Capture pipeline
- `phase1/capture-core.mjs` — pure capture logic + NFT metadata shape (collection fields, species, IVs/EVs, derived HP IV, EXP, OT id, battle stats, type ids, shiny, `nft_metadata.attributes`).
- `phase1/gen1-species.mjs` — Gen 1 species/base-stat data.
- `phase1/gen1-pc-storage.mjs` — serialize wallet/mock Pokemon into Gen 1 PC box SRAM format.

### Wallet/mock flow
- `phase1/wallet-adapter.mjs` — mock adapter with persisted storage, best-effort Nintondo wrapper for `window.nintondo`, party/boxed collection model, mock mint flow (quote → signing → pending → confirmed).

### In-game PC sync
- `phase1/dev-red.sav` — dev save skipping the tutorial.
- `phase1/shell.js` exposes `Load dev save` and `Sync wallet to PC`.

### Tests (15/15 passing)
Run: `node --test phase1/capture-core.test.mjs phase1/gen1-species.test.mjs phase1/gen1-pc-storage.test.mjs phase1/wallet-adapter.test.mjs`

## Verified Local State

- HTTP dev: `python -m http.server 9002 --bind 127.0.0.1` from `Z:\PokeBells` → `http://127.0.0.1:9002/phase1/`
- HTTPS dev: `python phase1/mainnet-canary/serve-https.py` → `https://127.0.0.1:9443/phase1/` (self-signed cert in `phase1/.https-cert/`)

## Nintondo / Bellschain Research — Final Findings (reusable for future skill)

### Mainnet inscription runtime
Test inscription: `58bf94bfb7214a783656e792dc39490e2a70dd59e9c9221c923f0e4300407681i0`. Canary: `phase1/mainnet-canary/inscription-probe.html`. Inside an inscription: JS works, WASM works, **`window.nintondo` is undefined**.

### Viewer iframe architecture
- Inscription rendered as `<iframe sandbox="allow-scripts">` pointing to `bells-mainnet-content.nintondo.io/html/<id>`
- Viewer at `nintondo.io/bells/inscriptions/<id>` is top-level, has `window.nintondo`
- `phase1/mainnet-canary/bridge-probe.html` sent `postMessage` to parent: **zero replies**. No bridge exists.

### Extension injection gates (Firefox Nintondo Wallet 0.3.10)
Source at `phase1/tmp-nintondo-wallet-0.3.10/`. Content-script injects if ALL gates pass:
1. Valid HTML doctype
2. URL path not `.xml` / `.pdf`
3. `documentElement.nodeName === "html"`
4. URL does NOT match `content.nintondo.io`
5. Not in iframe (`window.self === window.top`)

`pageProvider.js` has **no URL allowlist** (exhaustive grep confirmed). If content-script runs, provider is injected unconditionally.

### Localhost is blocked by Firefox (new finding 2026-04-18)
Using `phase1/mainnet-canary/localhost-probe.html`:
- `http://127.0.0.1:9002` → FAIL
- `http://localhost:9002` → FAIL
- `https://127.0.0.1:9443` (self-signed cert) → FAIL
- All 5 content-script gates show PASS on the probe
- Console has zero Nintondo errors — content-script simply doesn't run
- MetaMask disabled: no change
- `about:addons` shows `<all_urls>` optional permission toggle ON

Root cause: Firefox MV3 has an undocumented behavior that prevents content-script injection on localhost/127.0.0.1 even with `<all_urls>` matches and permission granted. No user-side workaround found.

### Cross-domain HTTPS confirmed working
- `https://wikipedia.org` → `typeof window.nintondo === "object"` CONFIRMED by console test
- Extension injects on any HTTPS domain except the specific `content.nintondo.io` exclusion and localhost
- GitHub Pages URL will receive injection

### Net conclusions (reusable)
1. **Inscription URL cannot host wallet-dependent code** until/unless Nintondo ships a bridge.
2. **Localhost dev cannot host wallet-dependent code** under Firefox MV3 (as of 2026-04-18).
3. **Any non-localhost HTTPS domain works** for wallet injection.
4. Dev loop: mock adapter locally (`wallet-adapter.mjs` mock mode); real wallet only testable on a deployed HTTPS URL.

### Nintondo team contact
Bridge request message drafted 2026-04-18. Proposes postMessage EIP-1193-style proxy from viewer to iframe. Security properties requested: per-inscription-id consent, no silent approval, origin check, rate limit.

## Anti-Cheat Architecture (decided 2026-04-18)

**Frame**: permissionless minting — anyone can inscribe a `p:pokebells` JSON. Only inscriptions with valid ZK proof are referenced in the **Official PokeBells Collection** (indexer-curated). Cheaters can mint into the void; their inscriptions exist on-chain but don't appear in the canonical collection. Economy and reputation attach to the verified set.

**Architectural reason for ZK route**: a centralized validator would re-introduce the legal exposure we explicitly avoid by going inscription-only. ZK keeps verification trustless and proof generation client-side, so no server we operate ever touches Nintendo IP or game state.

**Layered defense by phase:**

| Layer | Phase | What |
|---|---|---|
| Schema validation | 3 | species 1–151, level 1–100, IVs 0–15, legal moves for species/level, HP IV derived correctly, `catch_rate` matches ROM table |
| Block hash provenance | 3 | capture JSON includes block hash at capture time (fetch from `api.nintondo.io`) — verifiable timestamp, "first to catch X" culture |
| Hash-attestation | 3 | JSON includes `sha256(block_hash + full_RAM + wallet + sequence_n)` — raises forging cost |
| Soft indexer v1 | 3–4 | open-source script scans Bells inscriptions, runs the three checks above, exposes a public registry endpoint |
| ZK proof of capture | 6 | browser-side proof via SP1 or RISC Zero zkVM running binjgb. Proves: from committed state `S`, applying inputs `I`, reach state `S'` containing a valid capture event for these stats. ~5–10s of GB execution per proof. |
| Indexer v2 + Official Collection | 7 | indexer accepts ZK proofs, builds canonical "Official PokeBells Collection". Verified Pokemon get a badge — only verified mons appear in the official UI. Non-verified = legacy tier. |
| OP_CAT covenant gating | 9+ | optional, gated on OP_CAT activation on Bells mainnet. Enforces "valid proof required to mint" at protocol level. |

**Key tech constraints:**
- ZK proving runs **browser-side only** (WASM), no cloud prover, to preserve legal cleanliness.
- Estimated proof gen: 5–15 min per capture on a decent laptop, runs in WebWorker while player continues.
- Proof size: 100–250KB per inscription. Cost: 0.001–0.01 BEL per mint, negligible.
- Only the capture event is proven (not the full playthrough). Each proof references a checkpoint state hash from the prior capture or game start, forming a chain.
- Indexer is open-source — anyone can run their own and verify the "official" set independently. Decentralized validation, no central authority.

## Remaining Work

- **Phase 3 priority**: schema + block hash + attestation in `capture-core.mjs` and `wallet-adapter.mjs`. Real `window.nintondo` wired in once shell is on HTTPS.
- GitHub Pages deploy (`.github/workflows/pages.yml`, static export of `phase1/`)
- Phase 6 POC: pick zkVM (SP1 vs RISC Zero benchmark on a single capture circuit), measure real proof time/size on binjgb
- Continue remaining phases from `pokebells_roadmap_v41 (1).html`

## Temporary Research Artifacts

- `phase1/tmp-nintondo-wallet-0.3.10/` + `.xpi` / `.zip` (unpacked Firefox extension)
- `phase1/tmp-nintondo-viewer-bundles/`
- `phase1/.https-cert/` (self-signed cert for HTTPS dev — should be gitignored)
