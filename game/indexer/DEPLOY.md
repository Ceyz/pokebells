# PokeBells Indexer — Deploy guide (v1.4 commit-reveal)

## Pre-deploy state

The indexer at `pokebells-indexer.ceyzcrypto.workers.dev` is live on v1.2 schema
(Gen 1, species 1..151, attestation v1, no reveal support). This upgrade
brings it to v1.4: Gen 2 species 1..251, commit-reveal captures, op:"reveal"
endpoint, dedupe defenses (content sha256 + ram_snapshot_hash), op:"evolve"
and op:"update" table shapes prepared (endpoints to follow once wallet
signMessage is probed).

**The schema change is NOT backward-compatible**: new columns on `captures`,
new tables `reveals` + `evolves`, relaxed CHECKs (species to 251, IVs
nullable). Testnet captures from the Gen 1 era won't translate cleanly into
the Gen 2 schema, but there are no real mainnet rows yet, so we DROP +
re-apply.

## Steps

```bash
cd Z:/PokeBells/game/indexer
npm install   # installs wrangler 4.84.x (already done)

# 1. Auth with Cloudflare (one-time; opens browser)
npx wrangler login

# 2. Drop existing captures + apply v1.4 schema. Run against the live D1
#    database whose id lives in wrangler.toml (bindings.database_id).
#    On testnet this is safe — no mainnet data to preserve.
npx wrangler d1 execute pokebells-indexer --remote --command "DROP TABLE IF EXISTS captures; DROP TABLE IF EXISTS reveals; DROP TABLE IF EXISTS evolves; DROP TABLE IF EXISTS ingestion_log;"
npx wrangler d1 execute pokebells-indexer --remote --file=schema.sql

# 3. Deploy the Worker
npx wrangler deploy

# 4. Verify health
curl https://pokebells-indexer.ceyzcrypto.workers.dev/health
# → { "ok": true, "service": "pokebells-indexer", "version": "v1.4" }

# 5. Verify stats endpoint
curl https://pokebells-indexer.ceyzcrypto.workers.dev/api/stats
# → { "ok": true, "stats": { "total": 0, ... } }
```

## Smoke test after deploy

Inscribe a test capture on bells-testnet (or construct a fake valid one via
`buildCapturedPokemonRecord` + a real testnet block hash), then:

```bash
# Register capture
curl -X POST https://pokebells-indexer.ceyzcrypto.workers.dev/api/captures \
  -H "content-type: application/json" \
  -d '{"inscription_id":"<your capture id>","network":"bells-testnet"}'

# Register reveal (after inscribing op:reveal)
curl -X POST https://pokebells-indexer.ceyzcrypto.workers.dev/api/reveals \
  -H "content-type: application/json" \
  -d '{"inscription_id":"<your reveal id>","network":"bells-testnet"}'

# Lookup
curl https://pokebells-indexer.ceyzcrypto.workers.dev/api/captures/<capture id>
# should show { ..., iv_total, shiny, reveal_inscription_id, ... }
```

## Rollback

Re-apply the v1.2 schema from git history if something goes sideways:

```bash
git show HEAD~N:game/indexer/schema.sql > /tmp/legacy-schema.sql
npx wrangler d1 execute pokebells-indexer --remote --command "DROP TABLE captures; DROP TABLE ingestion_log; DROP TABLE reveals; DROP TABLE evolves;"
npx wrangler d1 execute pokebells-indexer --remote --file=/tmp/legacy-schema.sql
```

## Endpoints added in v1.4

- `POST /api/reveals` — register an op:"reveal" inscription. Validates its
  commitment preimages against the matching capture's
  `ivs_commitment` + `ram_snapshot_hash`. On success, the `reveals` row is
  inserted AND the capture row gets iv_atk/def/spe/special/iv_total/shiny +
  EVs filled (idempotent via `COALESCE`).
- `POST /api/captures` now enforces two dedupe checks:
  - `capture_content_sha256` collision (same capture body re-inscribed from
    another wallet) → 422 `content_duplicate`
  - `ram_snapshot_hash` collision (same emulator state replayed) → 422
    `snapshot_replay`
- Species range widened 1..151 → 1..251 at `/api/pokedex`.

## Not yet implemented (require wallet signMessage)

- `POST /api/updates` — level / EVs / moves deltas. Table + builder ready;
  sig verification stub. Blocked on nintondo_signmessage_format probe.
- `POST /api/evolves` — species transitions. Same blocker.
