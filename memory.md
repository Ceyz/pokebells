# PokeBells Session Memory

Last updated: 2026-04-19
Workspace: `Z:\PokeBells`

## Current Goal

Build PokeBells so the game/runtime can live in inscriptions, captured Pokemon can become NFT-like assets with rich metadata, and the wallet/mint flow works with the least friction for players.

## Architecture Decision (final, 2026-04-18)

**Hybrid architecture: game-as-inscription + GH Pages companion for wallet ops + sign-in identity.**

- **Inscription** (`nintondo.io/bells/inscriptions/<game-id>`) hosts the game itself: ROM chunks pulled from on-chain inscriptions, binjgb emulator, capture detection, capture JSON generation. **Read-only** wrt wallet — receives `?wallet=<addr>&sig=<sig>` URL params, verifies signature locally, loads owned Pokemon from chain. Zero IP hosted on a domain we own.
- **Companion site** (must be on a **custom non-PSL domain** — see Public Suffix List finding below) is **wallet-only**: sign-in via `signMessage`, generates the verified game URL for the player, and acts as the mint surface for capture JSONs (paste JSON → builds PSBT → signs → broadcasts). No ROM, no emulator, no Pokemon sprites — just a wallet utility specialized for PokeBells JSON inscriptions. Legal exposure minimized.
- **Two clipboard handoffs per session**: (1) sign-in on companion produces a verified game URL containing `?wallet=<addr>&sig=<sig>&issued=<ts>&expires=<ts>&nonce=<n>` — user opens this URL to play; (2) at mint time, copy capture JSON from inscription, paste into companion mint UI which forwards to Nintondo Inscriber for signing. No way around this — wallet is in extension origin, isolated from inscription iframe.
- **Sign-in challenge format** (canonical, used by `companion/index.html`): `pokebells:signin:v1:<inscription_id>:<addr>:<issued_ms>:<expires_ms>:<nonce>`. 24h TTL. Inscription must parse params, recompute the challenge, verify the signature recovers `<addr>`, check `now < expires`, then trust.

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

### Public Suffix List (PSL) domains are blocked (finding 2026-04-19)
Empirical test results (Firefox + Chrome, both with Nintondo Wallet enabled, all other wallets disabled):

| URL | `typeof window.nintondo` |
|---|---|
| `https://wikipedia.org` | `"object"` ✅ |
| `https://docs.github.com` | `"object"` ✅ |
| `https://octocat.github.io/` (HTTPS) | `"undefined"` ❌ |
| `https://ceyz.github.io/pokebells/` | `"undefined"` ❌ |
| `https://pokebells.pages.dev` | `"undefined"` ❌ |

**Pattern**: extension injects on regular registered domains, NOT on Public Suffix List subdomains. Free static hosts (github.io, pages.dev, vercel.app, netlify.app, workers.dev, fly.dev, replit.app, glitch.me, etc.) are all on the PSL because they isolate user-served subdomains as separate origins. The Nintondo extension (or the browser MV3 layer interacting with it) doesn't run content-scripts on PSL subdomains — we couldn't find the exclusion in the extension source, so the cause is likely browser-level handling of PSL.

**Workaround**: the companion site must be deployed on a **custom non-PSL domain**. Cost: $1–15/year (Cloudflare Registrar at-cost, Porkbun cheap). Domain can be generic (no Pokemon branding) to keep legal exposure minimal. Can still use GitHub Pages or Cloudflare Pages as the host — just point a custom domain at it.

**Important nuance — CDN proxy must be OFF**: when pointing a Cloudflare-managed domain at GitHub Pages, the DNS proxy status MUST be set to "DNS only" (grey cloud), not "Proxied" (orange cloud). Proxied means traffic re-enters Cloudflare's CDN infrastructure, which empirically reproduces the PSL-style block.

### Surprise blocker — missing favicon also prevents injection (finding 2026-04-19, late session)
After acquiring `bellforge.app` and pointing it at GH Pages with custom domain (DNS-only, no proxy), the wallet still failed to inject. The fix that finally worked: **adding a `favicon.svg` file + `<link rel="icon" href="favicon.svg" type="image/svg+xml">` in the HTML head** (commit `6ea2774`). After this, `https://bellforge.app/` serves cleanly and the wallet injects.

Two possible interpretations:
1. **Browser/extension heuristic**: pages without a favicon may be treated as incomplete or error-page-like by some content-script injection paths. Empirically reproducible here.
2. **Coincidence with redeploy**: the new commit forced a CDN cache refresh + the user's local DNS cache happened to expire at the same time. Favicon is incidental to the actual fix being a fresh deploy.

Without controlled A/B testing it's hard to be certain which. **Pragmatic rule: every page hosted for wallet integration MUST include a favicon.** Cheap insurance, zero downside.

### Net conclusions (reusable)
1. **Inscription URL cannot host wallet-dependent code** until/unless Nintondo ships a bridge (refused by dev 2026-04-18).
2. **Localhost dev cannot host wallet-dependent code** under Firefox MV3 (as of 2026-04-19).
3. **PSL subdomains (github.io, pages.dev, vercel.app, etc.) cannot host wallet-dependent code** — must use a custom registered domain.
4. **Custom HTTPS domain works** for wallet injection (`wikipedia.org`, `docs.github.com`, etc. confirmed; any registered domain expected to work).
5. Dev loop: mock adapter locally (`wallet-adapter.mjs` mock mode); real wallet only testable on a deployed custom-domain HTTPS URL.

### Inscription iframe sandbox capabilities (probe results 2026-04-18)
Tool: `phase1/mainnet-canary/sandbox-capabilities-probe.html`. Inscribed on testnet, opened via `bells-testnet-content.nintondo.io`. Verified what survives the `<iframe sandbox="allow-scripts">` restriction:

| Capability | Result | Notes |
|---|---|---|
| `navigator.clipboard.writeText` | ✅ PASS | requires user gesture (button click). The mint flow's "Copy capture JSON" button works. |
| `document.execCommand('copy')` | ✅ PASS | deprecated fallback, also works. |
| `fetch` | ✅ PASS | needed for block hash + inscription content fetches. |
| `Blob` + `URL.createObjectURL` | ✅ PASS | available but … |
| `<a download>` file save | ❌ FAIL | sandbox blocks downloads (no `allow-downloads`). |
| `localStorage` | ❌ FAIL | opaque origin throws SecurityError. |
| `indexedDB` | API exists, real ops UNTESTED | probe v2 added real put/get tests but user couldn't scroll to click them in the iframe. Critical to retest — ROM chunk cache depends on it. |
| `caches` (Cache API) | API exists, real ops UNTESTED | same as IDB — fallback if IDB fails. |
| `window.open` | ❌ FAIL | sandbox blocks popups (no `allow-popups`). |
| `<a target="_blank">` click | ❌ FAIL | same. |
| `form submit target="_blank"` | ❌ FAIL | same. |
| `postMessage` to parent | ✅ PASS | one-way only — viewer doesn't reply (no bridge). |
| `window.nintondo` | ❌ FAIL | as expected, content-script blocked. |

**Implication for the design**: the inscription-side mint flow MUST use clipboard + manual tab switch by the user. Cannot auto-open the companion or download a file. UX: inscription shows "Copy capture JSON" → user clicks → user opens companion bookmark → paste → sign.

**Open question**: real IDB ops in sandbox. Inscription scroll bug prevented testing. Either fix the probe to put new buttons at top OR use a less tall layout for the next iteration. If IDB fails, persistence is impossible inside the inscription, which kills "save state across sessions" — falls back to "address-derived state, no local persistence".

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

## Repo & Deployment State

- GitHub repo: `Ceyz/pokebells` (public, created 2026-04-18). Initial commit `5cbf3eb`, fix commit `9427f6d` (provider timing).
- Tracked: `companion/`, `.github/workflows/pages.yml`, `memory.md`, `pokebells_roadmap_v41 (1).html`, `.gitignore`.
- NOT tracked (deliberately): `phase1/` (game shell code), `pokemon_red.gb` (ROM — gitignored), `phase1/chunks/` (encoded ROM — gitignored), `phase1/.https-cert/` (private key — gitignored), `phase1/tmp-*/` (extension reverse-eng — gitignored).
- GH Pages live at `https://ceyz.github.io/pokebells/` — wallet doesn't inject (PSL).
- Cloudflare Pages live at `https://pokebells.pages.dev/` — wallet doesn't inject (PSL).
- **Custom domain `bellforge.app` (acquired 2026-04-19, $14/yr Cloudflare Registrar) → GH Pages** with DNS-only (no CF proxy) + favicon.svg → **wallet injects, end-to-end working** (commits `6ea2774` favicon, prior `9427f6d` provider timing).
- The CF Pages route with custom domain (`bellforge.app` proxied through CF) was tried first and failed; the GH Pages route with DNS-only succeeded after the favicon was added.

## Remaining Work

- ~~**CRITICAL UNBLOCKER**: acquire and configure a custom non-PSL domain~~ — **DONE 2026-04-19**: `bellforge.app` live on GH Pages + DNS-only + favicon, wallet injects.
- **Phase 3 priority**: schema + block hash + attestation in `capture-core.mjs` and `wallet-adapter.mjs`. Already-passing tests (15/15) are the regression baseline.
- **Inscription side wiring** (deferred until domain ready): companion sign-in produces `?wallet=<addr>&sig=<sig>&issued=<ts>&expires=<ts>&nonce=<n>` URL params; the inscription must parse, verify the signature against the challenge format `pokebells:signin:v1:<inscription_id>:<addr>:<issued>:<expires>:<nonce>`, then load owned `p:pokebells` inscriptions from `api.nintondo.io` for that address.
- **IDB/Cache real test inside the sandbox**: re-do probe with buttons at top so they're reachable when the viewer iframe doesn't scroll.
- Phase 6 POC: pick zkVM (SP1 vs RISC Zero benchmark on a single capture circuit), measure real proof time/size on binjgb.
- Continue remaining phases from `pokebells_roadmap_v41 (1).html`.

## Files Created This Session (2026-04-18 → 2026-04-19)

- `companion/index.html` — sign-in + mint companion (single file, no build step). Working, blocked only by PSL hosting.
- `.github/workflows/pages.yml` — GH Pages deploy workflow (functional but blocked by PSL).
- `.gitignore` — protects against committing IP/secrets.
- `phase1/mainnet-canary/localhost-probe.html` — tests window.nintondo injection on localhost.
- `phase1/mainnet-canary/sandbox-capabilities-probe.html` — tests clipboard/IDB/Cache/popup APIs in inscription sandbox.
- `phase1/mainnet-canary/serve-https.py` — local HTTPS server for testing self-signed cert behavior.
- `phase1/.https-cert/cert.pem`, `key.pem` — self-signed cert for `127.0.0.1` and `localhost` (gitignored).

## Temporary Research Artifacts

- `phase1/tmp-nintondo-wallet-0.3.10/` + `.xpi` / `.zip` (unpacked Firefox extension)
- `phase1/tmp-nintondo-viewer-bundles/`
- `phase1/.https-cert/` (self-signed cert for HTTPS dev — gitignored)
