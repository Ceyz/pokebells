# PokeBells indexer

Cloudflare Worker + D1 database that ingests minted captures and exposes the
trainer / pokedex / leaderboard APIs consumed by `bellforge.app/pokebells`.

## Model

**Register-on-mint (not chain scan).** Nintondo doesn't expose a public
inscription-listing API, so the companion posts each new inscription id to
`POST /api/captures` immediately after the user signs. The worker:

1. Fetches the inscription content from `bells-*-content.nintondo.io`.
2. Validates the capture JSON (schema v1.2 + attestation hash + block-hash
   existence on the claimed network).
3. On success, inserts a row into D1. Duplicate posts are idempotent.

Captures minted outside this flow never reach the indexer and therefore never
appear in the official collection UI. That's the anti-cheat boundary.

## Bootstrap — zero local install, all Cloudflare + GitHub

### 1. Create the D1 database (CF Dashboard, once)

[Workers & Pages → D1](https://dash.cloudflare.com/?to=/:account/workers/d1)
→ **Create database** → name: `pokebells-indexer`. Copy the **Database ID**
shown (UUID format).

### 2. Paste the Database ID (GitHub web editor, once)

Edit `game/indexer/wrangler.toml` directly on github.com, replace
`REPLACE_ME_AFTER_wrangler_d1_create` with the UUID from step 1, commit to
`main`. The push triggers the deploy workflow.

### 3. Ensure the CF API token has D1 scope

The existing `CLOUDFLARE_API_TOKEN` secret must include `Account → D1 → Edit`
in addition to `Account → Workers Scripts → Edit` (used by the relay deploy).
If your token was created with Workers-only scopes, edit it in
[dash → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
and add the D1 permission. No redeploy of the token secret needed —
GitHub reads the same value.

### 4. That's it

The workflow (`.github/workflows/indexer.yml`) now:

- `npm ci`
- `npm run check` (syntax only)
- `npm run d1:migrate` → applies `schema.sql` via `wrangler d1 execute --remote`
- `npx wrangler deploy`

First run prints the `*.workers.dev` URL. Hit `/health` to confirm:

```
GET https://pokebells-indexer.<account>.workers.dev/health
→ {"ok": true, "service": "pokebells-indexer", "version": "v1"}
```

## Custom domain (optional, all CF Dashboard)

1. [DNS tab](https://dash.cloudflare.com/?to=/:account/:zone/dns/records)
   for `bellforge.app` → **Add record** → CNAME `indexer` → target
   `<whatever>.workers.dev` → **Proxy status: DNS only** (grey cloud). Save.
2. Edit `game/indexer/wrangler.toml` on github.com — uncomment the
   `[[routes]]` block with `pattern = "indexer.bellforge.app"`. Commit.
3. Next workflow run binds the route. `curl https://indexer.bellforge.app/health`
   confirms.

The companion's `INDEXER_BASE_DEFAULT` already points at
`https://indexer.bellforge.app`, so the Trainer tab and Mint register flow
light up automatically once the DNS + route resolve.

## Dev-time override (no custom domain yet)

Before the custom domain is live, point the companion at the workers.dev URL
from the browser console:

```js
localStorage.setItem("pokebells.indexer_base", "https://pokebells-indexer.<account>.workers.dev")
```

Reload `bellforge.app/pokebells`. Clear the key to revert to the default.

## Resilience — replacing bellforge.app

The game must keep running if the primary companion + indexer hosts ever go
down (domain expiry, operator incapacitated, etc.). Three escape hatches,
in priority order, are baked into both `game/shell.js` (companion URL) and
`companion/pokebells/index.html` (indexer URL):

1. **URL param** — `?companion=https://alt.example.org/pokebells/` or
   `?indexer=https://alt.example.org` overrides for the current load. Shell
   also propagates `?companion=` through to the companion when it opens for
   sign-in / mint handoff.
2. **localStorage** — `pokebells:companion_url` (shell) or
   `pokebells.indexer_base` (companion). Sticky per-browser user override.
3. **Fallback list** — hardcoded array at the top of each file
   (`COMPANION_URL_FALLBACKS`, `INDEXER_BASE_FALLBACKS`). Adding a mirror
   only needs a patch push + new shell inscription (patchable via a new
   `p:pokebells-manifest`, no root re-mint).

The indexer itself is stateless validation — anyone can stand up a clone:

1. Fork the repo, keep `game/indexer/` intact (code is not branded).
2. Set their own `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` secrets.
3. Create a D1 named `pokebells-indexer`, paste the id into `wrangler.toml`.
4. Push — the CI runs migrate + deploy on their account.
5. Their users set `localStorage.pokebells.indexer_base` or append
   `?indexer=<their-worker-url>` to load.

Community indexers can diverge in policy (stricter / looser validation,
different sprite-pack acceptance, etc.); the on-chain capture JSON stays
canonical, any indexer re-validates from the same source of truth.

Future: the `p:pokebells-collection` inscription can declare a canonical
`companion_urls[]` + `indexer_urls[]` list that shell.js fetches and caches
on boot. That moves the fallback list on-chain and removes the need for a
new shell inscription when adding mirrors. Not blocking v1 launch.

## Endpoints (v1.4)

All JSON, all CORS `*`, all read-only except the POST mutation endpoints.

| Method | Path | Notes |
|---|---|---|
| GET  | `/health` | `{ok:true, service, version: "v1.4"}` |
| GET  | `/api/stats` | total / mainnet / testnet / shinies / revealed / trainers / species |
| POST | `/api/captures` | body `{inscription_id, network}` — validates + dedupes + stores |
| POST | `/api/reveals`  | body `{inscription_id, network}` — validates commitment preimage, copies IVs+EVs+shiny onto matching capture row |
| POST | `/api/saves`    | body `{inscription_id, network}` — stores op:"save-snapshot", enforces monotonic save_version per (wallet, rom, network) |
| GET  | `/api/captures/<id>` | single capture by inscription id |
| GET  | `/api/trainer/<addr>` | `?network=&limit=&offset=` — captures owned |
| GET  | `/api/pokedex` | `?species=1..251&network=&limit=&offset=` — list all of one species |
| GET  | `/api/leaderboard` | `?by=iv_total\|count&network=&limit=` |
| GET  | `/api/saves/<wallet>` | `?rom_sha=<hex>&network=` — latest save-snapshot metadata for cross-device restore |

## Validator stages

`src/validator.js` is dependency-free (standard Web APIs only) so it runs
unchanged on the Worker. Order, short-circuit on first failure:

1. **schema** — `p:pokebells`, `op:"capture"` supported at `schema_version`
   `1.3` (legacy, plaintext IVs inline) or `1.4` (commit-reveal, IVs
   hidden until a matching `op:"reveal"`). Species 1..251 (Gen 2), level
   1..100. Under v1.4: `ivs`, `derived_ivs`, `evs`, `shiny`, `ram_snapshot`
   MUST be null; `ivs_commitment` + `ram_snapshot_hash` must be 64-hex.
2. **provenance** — block hash format, session sequence, signed wallet,
   `svbk_at_capture` byte, `attestation_scheme` in
   {`v1`, `v1.1`, `v2`}.
3. **attestation** — recomputed per scheme:
   - **v1.1** `sha256(block_hash + raw_wram8k + svbk + wallet + seq)`
   - **v2**   `sha256(block_hash + ram_snapshot_hash + svbk + wallet + seq + ivs_commitment)`
4. **network** — block hash exists on the claimed network via `/block/<hash>`.
5. **dedupe** (capture only) — `capture_content_sha256` collision elsewhere
   → 422 `content_duplicate`; `ram_snapshot_hash` collision → 422
   `snapshot_replay`.

### Reveal validation (`op:"reveal"`)
- `ref` resolves to a registered capture.
- Decoded `ram_snapshot` bytes (32 KB) sha256 equals `capture.ram_snapshot_hash`.
- `sha256(canonical(ivs) || hex_to_bytes(ivs_salt_hex))` equals `capture.ivs_commitment`.
- On success, the capture row's IV + EV + shiny + `reveal_inscription_id`
  fields are updated via `COALESCE` (first reveal wins; replays no-op).

### Save-snapshot validation (`op:"save-snapshot"`)
- `save_scheme` equals `base64:raw-sram-32k:v1`.
- `sram` decodes to exactly 32 768 bytes.
- `sha256(decoded bytes)` equals `sram_sha256`.
- `save_version` strictly greater than any previously-indexed save for the
  same `(signed_in_wallet, game_rom_sha256, network)` tuple. Downgrades
  return 422 `stale_save_version` with `latest_known` in the response.

Every attempt (ok, duplicate, invalid, error) is logged in
`ingestion_log` keyed by `kind` (`capture` / `reveal` / `save`) with a /24
or /48 IP prefix for abuse detection.

## Schema changes

Edit `schema.sql` and push — the workflow re-runs `wrangler d1 execute
--remote --file=schema.sql` before every deploy. Every `CREATE` is guarded
with `IF NOT EXISTS`, so re-applying is safe. For destructive migrations
(DROP, ALTER) use explicit one-shot SQL files and run them manually from
the D1 Console in the CF Dashboard.

## Future work

- **`op:"update"` + `op:"evolve"` endpoints.** Schema + `buildUpdateRecord`
  / `buildEvolveRecord` + `evolves` table already ship; the worker endpoints
  are blocked on probing Bells `signMessage` format (see
  `memory/nintondo_signmessage_format.md`) — without signature verification
  anyone could spoof updates for any wallet.
- **Wallet-derived AES-GCM encryption of `op:"save-snapshot"` payloads.**
  Currently SRAM is inscribed in plaintext, readable on-chain by anyone.
  v1.5 roadmap: encrypt with a key derived from
  `wallet.signMessage('pokebells-save-v1:<wallet>')` + HKDF. Requires
  signMessage probe too.
- **Chain-scan fallback.** Scheduled trigger (`[triggers] crons`) that
  reconciles against any inscription-listing API Nintondo eventually ships
  (or RSC scraping as a stopgap). Catches captures missed when the
  companion tab crashed between sign + post.
- **On-chain owner verification.** Currently we trust `signed_in_wallet`
  for ownership queries. Adding a lookup against Nintondo's inscription
  detail page lets us correct for secondary transfers.
- **Sprite-match check.** Reject captures whose `nft_metadata.image`
  doesn't equal the canonical sprite for `(species_id, shiny)` once the
  sprite-pack inscription ids are pinned in `p:pokebells-manifest`.
- **Rate limiting.** `ingestion_log.client_ip_prefix` is recorded but not
  enforced; add a per-prefix-per-minute cap at the Worker layer.
- **Encounter table + learnset legality** — reject captures whose
  `(species, map, level)` tuple is not a legal Crystal wild encounter,
  and captures whose moves aren't learnable at their level. Data
  extraction from the pret/pokecrystal disasm remains TODO.

## Bootstrap without GitHub

Everything in this directory (worker.js, validator.js, db.js, schema.sql,
package.json, wrangler.toml, README.md) can be packaged for on-chain
inscription as a recovery path if GitHub ever disappears. Run
`node tools/package-indexer-for-inscription.mjs` from the repo root to
produce `tools/indexer-bundle/` + a manifest JSON ready to inscribe.
See [`OPEN_SOURCE.md`](../../OPEN_SOURCE.md) for the full resilience
model.
