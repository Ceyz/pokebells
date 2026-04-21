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

## Endpoints

All JSON, all CORS `*`, all read-only except `POST /api/captures`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ok:true, service, version}` |
| GET | `/api/stats` | total / mainnet / testnet / shinies / trainers / species |
| POST | `/api/captures` | body `{inscription_id, network}` — validates + stores |
| GET | `/api/captures/<id>` | single capture by inscription id |
| GET | `/api/trainer/<addr>` | `?network=&limit=&offset=` — captures owned |
| GET | `/api/pokedex` | `?species=1..151&network=&limit=&offset=` — list all of one species |
| GET | `/api/leaderboard` | `?by=iv_total\|count&network=&limit=` |

## Validator stages

`src/validator.js` is dependency-free (standard Web APIs only) so it runs
unchanged on the Worker. Order, short-circuit on first failure:

1. **schema** — `p:pokebells`, `op:capture`, species 1..151, level 1..100,
   IV fields 0..15, spc vs spd collapsed to `iv_special`.
2. **provenance** — block hash format, session sequence, signed wallet,
   ram_snapshot base64 (decodes to 0x2000 bytes), attestation hex.
3. **attestation** — recomputed `sha256(block_hash + ram + wallet + seq)`
   matches the `attestation` field.
4. **network** — block hash exists on the claimed network via
   `/block/<hash>` on the corresponding electrs base.

Every attempt (ok, duplicate, invalid, error) is logged in
`ingestion_log` with a /24 or /48 IP prefix for abuse detection.

## Schema changes

Edit `schema.sql` and push — the workflow re-runs `wrangler d1 execute
--remote --file=schema.sql` before every deploy. Every `CREATE` is guarded
with `IF NOT EXISTS`, so re-applying is safe. For destructive migrations
(DROP, ALTER) use explicit one-shot SQL files and run them manually from
the D1 Console in the CF Dashboard.

## Future work

- **Chain-scan fallback.** Scheduled trigger (`[triggers] crons`) that
  reconciles against any inscription-listing API Nintondo eventually ships
  (or RSC scraping as a stopgap). Catches captures missed when the
  companion tab crashed between sign + post.
- **On-chain owner verification.** Currently we trust `signed_in_wallet`
  for ownership queries. Adding a lookup against Nintondo's inscription
  detail page lets us correct for secondary transfers.
- **Sprite-match check.** Once the sprite pack inscription ids are known,
  reject captures whose `nft_metadata.image` doesn't equal the canonical
  sprite for `(species_id, shiny)`.
- **Rate limiting.** `ingestion_log.client_ip_prefix` is recorded but not
  enforced; add a per-prefix-per-minute cap at the Worker layer.
