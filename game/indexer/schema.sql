-- PokeBells indexer D1 schema.
-- Apply via: npm run d1:migrate  (reads this file and executes against the DB
-- bound in wrangler.toml).
--
-- Idempotent — safe to re-run. Every CREATE is guarded with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS captures (
  inscription_id           TEXT PRIMARY KEY,
  owner_address            TEXT NOT NULL,
  species_id               INTEGER NOT NULL,
  species_name             TEXT,
  level                    INTEGER NOT NULL,
  iv_atk                   INTEGER NOT NULL,
  iv_def                   INTEGER NOT NULL,
  iv_spe                   INTEGER NOT NULL,
  iv_special               INTEGER NOT NULL,
  iv_total                 INTEGER NOT NULL,
  shiny                    INTEGER NOT NULL DEFAULT 0,
  network                  TEXT NOT NULL,
  block_height_at_capture  INTEGER,
  block_hash_at_capture    TEXT,
  attestation              TEXT,
  signed_in_wallet         TEXT,
  session_sequence_number  INTEGER,
  raw_capture_json         TEXT NOT NULL,
  valid                    INTEGER NOT NULL DEFAULT 1,
  reject_reason            TEXT,
  registered_at            INTEGER NOT NULL,
  CHECK (network IN ('bells-mainnet', 'bells-testnet')),
  CHECK (species_id BETWEEN 1 AND 151),
  CHECK (level BETWEEN 1 AND 100),
  CHECK (iv_atk BETWEEN 0 AND 15),
  CHECK (iv_def BETWEEN 0 AND 15),
  CHECK (iv_spe BETWEEN 0 AND 15),
  CHECK (iv_special BETWEEN 0 AND 15),
  CHECK (shiny IN (0, 1)),
  CHECK (valid IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_captures_owner_valid
  ON captures(owner_address, valid);

CREATE INDEX IF NOT EXISTS idx_captures_species_valid
  ON captures(species_id, valid);

CREATE INDEX IF NOT EXISTS idx_captures_iv_total
  ON captures(iv_total DESC) WHERE valid = 1;

CREATE INDEX IF NOT EXISTS idx_captures_network
  ON captures(network, valid);

-- Ingestion log — every POST /api/captures attempt, success or failure.
-- Helps debug rejected captures and detect abuse patterns.
CREATE TABLE IF NOT EXISTS ingestion_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id    TEXT NOT NULL,
  network           TEXT NOT NULL,
  result            TEXT NOT NULL,    -- 'ok' | 'duplicate' | 'invalid' | 'error'
  reject_reason     TEXT,
  ingested_at       INTEGER NOT NULL,
  client_ip_prefix  TEXT              -- /24 or /48 prefix for rate limit grouping
);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_inscription
  ON ingestion_log(inscription_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_time
  ON ingestion_log(ingested_at DESC);
