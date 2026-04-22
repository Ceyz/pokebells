-- PokeBells indexer D1 schema (v1.4 commit-reveal ready).
-- Apply via: npm run d1:migrate  (reads this file and executes against the DB
-- bound in wrangler.toml). Idempotent: CREATE IF NOT EXISTS on every table.
--
-- Migration from v1 (Gen 1, pre-commit-reveal) to v2 (Gen 2, v1.4):
-- the old `captures` table had NOT NULL CHECK constraints on IVs (species
-- range 1..151) which block Gen 2 records and v1.4 captures where IVs are
-- null pre-reveal. A one-shot migration block at the bottom of this file
-- renames the legacy table (if it exists and hasn't been migrated yet) and
-- recreates it in the new shape. No data is lost: the legacy rows copy into
-- the new table with reveal_* columns set to null.

CREATE TABLE IF NOT EXISTS captures (
  inscription_id            TEXT PRIMARY KEY,
  owner_address             TEXT NOT NULL,

  -- Always-public (visible pre-reveal):
  species_id                INTEGER NOT NULL,
  species_name              TEXT,
  level                     INTEGER NOT NULL,
  catch_rate                INTEGER,
  held_item                 INTEGER,
  friendship                INTEGER,
  pokerus                   INTEGER,
  moves_json                TEXT,           -- JSON array[4] of move ids
  pp_json                   TEXT,
  status                    TEXT,
  network                   TEXT NOT NULL,
  block_height_at_capture   INTEGER,
  block_hash_at_capture     TEXT NOT NULL,
  signed_in_wallet          TEXT NOT NULL,
  session_sequence_number   INTEGER NOT NULL,

  -- Schema 1.4 commit-reveal (populated for v1.4 captures; null for v1.3):
  schema_version            TEXT NOT NULL DEFAULT '1.3',
  attestation_scheme        TEXT,
  attestation               TEXT NOT NULL,
  ivs_commitment            TEXT,
  ram_snapshot_hash         TEXT,
  svbk_at_capture           INTEGER,

  -- Dedupe fingerprint (sha256 over normalized capture fields; collisions
  -- block a second mint of the same capture from any wallet).
  capture_content_sha256    TEXT,

  -- Revealed values (populated when a matching op:"reveal" is registered):
  reveal_inscription_id     TEXT,
  reveal_registered_at      INTEGER,
  iv_atk                    INTEGER,
  iv_def                    INTEGER,
  iv_spe                    INTEGER,
  iv_special                INTEGER,
  iv_total                  INTEGER,
  shiny                     INTEGER,
  ev_hp                     INTEGER,
  ev_atk                    INTEGER,
  ev_def                    INTEGER,
  ev_spe                    INTEGER,
  ev_spc                    INTEGER,

  -- Evolution tracking (computed by applying op:"evolve" records in block
  -- order; populated incrementally):
  current_species_id        INTEGER,
  current_level             INTEGER,
  evolve_count              INTEGER NOT NULL DEFAULT 0,

  raw_capture_json          TEXT NOT NULL,
  valid                     INTEGER NOT NULL DEFAULT 1,
  reject_reason             TEXT,
  registered_at             INTEGER NOT NULL,

  CHECK (network IN ('bells-mainnet', 'bells-testnet')),
  CHECK (species_id BETWEEN 1 AND 251),
  CHECK (level BETWEEN 1 AND 100),
  CHECK (shiny IS NULL OR shiny IN (0, 1)),
  CHECK (valid IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_captures_owner_valid
  ON captures(owner_address, valid);

CREATE INDEX IF NOT EXISTS idx_captures_species_valid
  ON captures(species_id, valid);

CREATE INDEX IF NOT EXISTS idx_captures_iv_total
  ON captures(iv_total DESC) WHERE valid = 1 AND iv_total IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_captures_network
  ON captures(network, valid);

CREATE INDEX IF NOT EXISTS idx_captures_content_sha256
  ON captures(capture_content_sha256) WHERE capture_content_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_captures_ram_snapshot_hash
  ON captures(ram_snapshot_hash) WHERE ram_snapshot_hash IS NOT NULL;

-- Reveal inscriptions: one per capture, keyed by the capture inscription id.
-- Indexer accepts a reveal only if its ivs_commitment preimage matches the
-- capture's commitment AND sha256(ram_snapshot) matches the capture's
-- ram_snapshot_hash. On success the matching captures row is updated with
-- iv_atk/def/spe/special + ev_* + shiny (see db.js applyReveal).
CREATE TABLE IF NOT EXISTS reveals (
  reveal_inscription_id     TEXT PRIMARY KEY,
  capture_inscription_id    TEXT NOT NULL,
  network                   TEXT NOT NULL,
  ivs_salt_hex              TEXT NOT NULL,
  iv_atk                    INTEGER NOT NULL,
  iv_def                    INTEGER NOT NULL,
  iv_spe                    INTEGER NOT NULL,
  iv_special                INTEGER NOT NULL,
  shiny                     INTEGER NOT NULL,
  ev_hp                     INTEGER,
  ev_atk                    INTEGER,
  ev_def                    INTEGER,
  ev_spe                    INTEGER,
  ev_spc                    INTEGER,
  raw_reveal_json           TEXT NOT NULL,
  registered_at             INTEGER NOT NULL,
  CHECK (network IN ('bells-mainnet', 'bells-testnet')),
  CHECK (iv_atk BETWEEN 0 AND 15),
  CHECK (iv_def BETWEEN 0 AND 15),
  CHECK (iv_spe BETWEEN 0 AND 15),
  CHECK (iv_special BETWEEN 0 AND 15),
  CHECK (shiny IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_reveals_capture
  ON reveals(capture_inscription_id);

-- Evolution log: one row per op:"evolve" inscription. Applied to captures in
-- block order to compute current_species_id + evolve_count.
CREATE TABLE IF NOT EXISTS evolves (
  evolve_inscription_id     TEXT PRIMARY KEY,
  capture_inscription_id    TEXT NOT NULL,
  from_species_id           INTEGER NOT NULL,
  to_species_id             INTEGER NOT NULL,
  evolved_at_block          INTEGER NOT NULL,
  evolve_reason             TEXT,
  level_at_evolve           INTEGER,
  new_moves_json            TEXT,
  signed_in_wallet          TEXT NOT NULL,
  signature                 TEXT NOT NULL,
  raw_evolve_json           TEXT NOT NULL,
  registered_at             INTEGER NOT NULL,
  CHECK (from_species_id BETWEEN 1 AND 251),
  CHECK (to_species_id BETWEEN 1 AND 251)
);

CREATE INDEX IF NOT EXISTS idx_evolves_capture_block
  ON evolves(capture_inscription_id, evolved_at_block);

-- On-chain save snapshots. One row per op:"save-snapshot" inscription.
-- The latest save-version per (wallet, game_rom_sha256, network) is the
-- canonical "cloud save". Older versions stay on-chain (immutable) but
-- are not served by GET /api/saves. Sram blob is NOT stored in D1 (too
-- large for inexpensive queries); worker fetches the full content from
-- Nintondo's content host on demand via /api/saves/.../content or by
-- following save_inscription_id.
CREATE TABLE IF NOT EXISTS saves (
  save_inscription_id       TEXT PRIMARY KEY,
  signed_in_wallet          TEXT NOT NULL,
  game_rom                  TEXT,
  game_rom_sha256           TEXT NOT NULL,
  network                   TEXT NOT NULL,
  save_version              INTEGER NOT NULL,
  sram_sha256               TEXT NOT NULL,
  sram_byte_length          INTEGER NOT NULL,
  save_scheme               TEXT,
  signature_scheme          TEXT,
  signature                 TEXT,
  block_hash_at_save        TEXT,
  raw_save_json             TEXT NOT NULL,
  registered_at             INTEGER NOT NULL,
  CHECK (network IN ('bells-mainnet', 'bells-testnet')),
  CHECK (save_version > 0)
);

CREATE INDEX IF NOT EXISTS idx_saves_wallet_rom
  ON saves(signed_in_wallet, game_rom_sha256, network, save_version DESC);

CREATE INDEX IF NOT EXISTS idx_saves_wallet_version
  ON saves(signed_in_wallet, save_version DESC);

-- Ingestion log (unchanged from v1).
CREATE TABLE IF NOT EXISTS ingestion_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  inscription_id    TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'capture', -- 'capture' | 'reveal' | 'evolve'
  network           TEXT NOT NULL,
  result            TEXT NOT NULL,    -- 'ok' | 'duplicate' | 'invalid' | 'error'
  reject_reason     TEXT,
  ingested_at       INTEGER NOT NULL,
  client_ip_prefix  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_inscription
  ON ingestion_log(inscription_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_time
  ON ingestion_log(ingested_at DESC);
