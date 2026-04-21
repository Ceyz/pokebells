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

Captures minted outside this flow (e.g. manually via the Nintondo Inscriber
with tampered JSON) never reach the indexer and therefore never appear in
the official collection UI. That's the anti-cheat boundary.

## One-time setup

```bash
cd game/indexer
npm install
npx wrangler login                        # if not already authed locally
npx wrangler d1 create pokebells-indexer  # prints a database_id
# paste the printed database_id into wrangler.toml
npm run d1:migrate                        # applies schema.sql against the DB
npm run deploy                            # first deploy to *.workers.dev
```

Custom domain (optional, once the worker is live):

1. Uncomment the `[[routes]]` block in `wrangler.toml` with the target
   hostname (e.g. `indexer.bellforge.app`).
2. Ensure the Cloudflare zone for that domain belongs to the same account.
3. `npm run deploy` again.

## CI

`.github/workflows/indexer.yml` runs `wrangler deploy` on every push to
`main` that touches `game/indexer/**`. Uses the same
`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` secrets as the relay
workflow.

The schema migration is **not** automated — re-run `npm run d1:migrate`
manually after editing `schema.sql`. D1 schema changes can drop data if
done wrong; keep migrations explicit.

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

## Client usage (companion)

```js
await fetch("https://indexer.bellforge.app/api/captures", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    inscription_id: "<id_from_inscriber>i0",
    network: "bells-mainnet",  // or bells-testnet
  }),
});
```

```js
const r = await fetch(`https://indexer.bellforge.app/api/trainer/${addr}?network=bells-mainnet`);
const { captures } = await r.json();
```

## Future work

- **Chain-scan fallback.** A scheduled trigger (`[triggers] crons = ["*/5 * * * *"]`)
  that reconciles against any inscription-listing API Nintondo eventually
  ships, or RSC scraping as a stopgap. Catches captures missed when the
  companion tab crashed between sign + post.
- **On-chain owner verification.** Currently we trust `signed_in_wallet`
  for ownership queries. Adding a lookup against Nintondo's inscription
  detail page lets us correct for secondary transfers.
- **Sprite-match check.** Once the sprite pack inscription ids are known,
  reject captures whose `nft_metadata.image` doesn't equal the canonical
  sprite for `(species_id, shiny)`.
- **Rate limiting.** `ingestion_log.client_ip_prefix` is recorded but not
  enforced; add a per-prefix-per-minute cap at the Worker layer.
