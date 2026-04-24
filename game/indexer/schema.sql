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

-- =====================================================================
-- Schema v1.5 — capture_commit + mint (see SCHEMA-v1.5.md)
-- =====================================================================

-- capture_commit: opaque receipt, NOT in marketplace collection.
-- Mirrors the on-chain inscription's body verbatim. Mint references
-- this row via ref_capture_commit.
CREATE TABLE IF NOT EXISTS commits (
  inscription_id            TEXT PRIMARY KEY,
  network                   TEXT NOT NULL,
  signed_in_wallet          TEXT NOT NULL,
  session_sequence_number   INTEGER NOT NULL,
  block_height_at_inscribe  INTEGER,
  block_hash_at_capture     TEXT NOT NULL,
  game_rom_sha256           TEXT NOT NULL,
  party_slot_index          INTEGER NOT NULL,
  ivs_commitment            TEXT NOT NULL,
  ivs_commitment_scheme     TEXT NOT NULL,
  ram_snapshot_hash         TEXT NOT NULL,
  ram_commitment_scheme     TEXT NOT NULL,
  svbk_at_capture           INTEGER NOT NULL,
  attestation               TEXT NOT NULL,
  attestation_scheme        TEXT NOT NULL,
  raw_commit_json           TEXT NOT NULL,
  registered_at             INTEGER NOT NULL,
  valid                     INTEGER NOT NULL DEFAULT 1,
  reject_reason             TEXT,
  CHECK (network IN ('bells-mainnet', 'bells-testnet')),
  CHECK (party_slot_index BETWEEN 1 AND 6),
  CHECK (svbk_at_capture = 1),
  CHECK (valid IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_commits_wallet
  ON commits(signed_in_wallet, valid);
CREATE INDEX IF NOT EXISTS idx_commits_ram_hash
  ON commits(ram_snapshot_hash) WHERE valid = 1;
CREATE INDEX IF NOT EXISTS idx_commits_ivs_commitment
  ON commits(ivs_commitment) WHERE valid = 1;

-- pokemon: the canonical NFT collection. One row per validated mint.
-- ref_capture_commit is UNIQUE — enforces "first valid mint per commit"
-- (check #12 in SCHEMA-v1.5.md).
CREATE TABLE IF NOT EXISTS pokemon (
  mint_inscription_id        TEXT PRIMARY KEY,
  ref_capture_commit         TEXT NOT NULL UNIQUE,
  network                    TEXT NOT NULL,
  signed_in_wallet           TEXT NOT NULL,
  party_slot_index           INTEGER NOT NULL,
  species_id                 INTEGER NOT NULL,
  species_name               TEXT NOT NULL,
  level                      INTEGER NOT NULL,
  shiny                      INTEGER NOT NULL,
  iv_atk                     INTEGER NOT NULL,
  iv_def                     INTEGER NOT NULL,
  iv_spe                     INTEGER NOT NULL,
  iv_special                 INTEGER NOT NULL,
  iv_hp                      INTEGER NOT NULL,
  iv_total                   INTEGER NOT NULL,
  ev_hp                      INTEGER,
  ev_atk                     INTEGER,
  ev_def                     INTEGER,
  ev_spe                     INTEGER,
  ev_spc                     INTEGER,
  status                     TEXT,
  held_item                  INTEGER,
  friendship                 INTEGER,
  pokerus                    INTEGER,
  catch_rate                 INTEGER,
  moves_json                 TEXT,
  pp_json                    TEXT,
  name                       TEXT NOT NULL,
  description                TEXT,
  image                      TEXT NOT NULL,
  attributes_json            TEXT NOT NULL,
  raw_mint_json              TEXT NOT NULL,
  registered_at              INTEGER NOT NULL,
  -- 1 iff this mint was the FIRST mint ever registered for
  -- signed_in_wallet. Set server-side at INSERT time, immutable
  -- afterwards. Prevents "starter spam": a wallet can inscribe as many
  -- captures as they want, but only the first one carries the starter
  -- flag — the rest are regular catches. The flag is public-read via
  -- GET /api/pokemon/:id + GET /api/trainer/:owner.
  is_starter                 INTEGER NOT NULL DEFAULT 0,
  CHECK (network IN ('bells-mainnet', 'bells-testnet')),
  CHECK (species_id BETWEEN 1 AND 251),
  CHECK (level BETWEEN 1 AND 100),
  CHECK (shiny IN (0, 1)),
  CHECK (is_starter IN (0, 1)),
  CHECK (party_slot_index BETWEEN 1 AND 6),
  CHECK (iv_atk BETWEEN 0 AND 15),
  CHECK (iv_def BETWEEN 0 AND 15),
  CHECK (iv_spe BETWEEN 0 AND 15),
  CHECK (iv_special BETWEEN 0 AND 15),
  CHECK (iv_hp BETWEEN 0 AND 15)
);

CREATE INDEX IF NOT EXISTS idx_pokemon_owner
  ON pokemon(signed_in_wallet);

-- Partial unique index: at most ONE is_starter=1 per wallet. D1 enforces
-- this at INSERT so even a concurrent double-write (two tabs firing in
-- the same millisecond) is safe — second one gets a CONSTRAINT fail
-- and falls through to is_starter=0 in the retry path.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_starter_unique
  ON pokemon(signed_in_wallet) WHERE is_starter = 1;

-- Migration for databases deployed before v1.5.1 (is_starter column
-- added). ALTER TABLE ADD COLUMN isn't idempotent in SQLite; the
-- second run fails with "duplicate column name". Use
-- tools/apply-d1-schema.mjs --skip-errors (which GHA does via
-- package.json d1:migrate) to continue past that error. Fresh deploys
-- skip this statement because the CREATE TABLE above already includes
-- the column.
ALTER TABLE pokemon ADD COLUMN is_starter INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_pokemon_species
  ON pokemon(species_id);
CREATE INDEX IF NOT EXISTS idx_pokemon_iv_total
  ON pokemon(iv_total DESC);
CREATE INDEX IF NOT EXISTS idx_pokemon_shiny
  ON pokemon(shiny) WHERE shiny = 1;
CREATE INDEX IF NOT EXISTS idx_pokemon_network
  ON pokemon(network);

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

-- =====================================================================
-- Async ingestion queue + chain scan cursor
-- =====================================================================
-- The Nintondo content host is eventually-consistent — txs confirm in
-- a block, but the /content/<id> endpoint can take minutes to hours
-- to index them. Rather than making the client side poll forever and
-- lose state on tab close, the indexer itself keeps a retry queue.
--
-- POST /api/captures + /api/mints enqueue the id if content is 404,
-- return 202 "queued" instead of 422. A scheduled Cron Trigger drains
-- the queue every few minutes: fetch content, if 200 run through the
-- full validator pipeline, remove from queue on success or after
-- max_attempts.
CREATE TABLE IF NOT EXISTS ingestion_queue (
  inscription_id    TEXT NOT NULL,
  kind              TEXT NOT NULL,       -- 'capture' | 'mint' | 'reveal' | 'capture_commit'
  network           TEXT NOT NULL,
  enqueued_at       INTEGER NOT NULL,
  retry_after       INTEGER NOT NULL,    -- Unix seconds; cron skips entries where retry_after > now
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  PRIMARY KEY (inscription_id, kind),
  CHECK (network IN ('bells-mainnet', 'bells-testnet'))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_retry
  ON ingestion_queue(retry_after);

-- Cursor for autonomous chain scan (niveau 2). Stores the last
-- "block_height+tx_index" seen by the Nintondo RSC scrape so the cron
-- doesn't re-enumerate everything every tick. Singleton row keyed by
-- (network, scheme) — scheme lets us roll the scanner format without
-- losing the old cursor.
CREATE TABLE IF NOT EXISTS scan_cursor (
  network           TEXT NOT NULL,
  scheme            TEXT NOT NULL,       -- e.g. 'nintondo_rsc:v1'
  cursor_value      TEXT,                -- opaque, scheme-specific
  last_scanned_at   INTEGER NOT NULL,
  last_inscriptions_found INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (network, scheme),
  CHECK (network IN ('bells-mainnet', 'bells-testnet'))
);

-- =====================================================================
-- Phase B: p:pokebells-collection + op:"collection_update" tracking
-- =====================================================================
-- Authority model is sat-spend-v1: a collection_update inscription is
-- accepted iff its commit tx spent the UTXO currently holding the
-- collection root sat. No signature required. See
-- game/ROOT-APP-DESIGN.md and game/schemas/pokebells-collection.schema.md.

-- Known collection root inscriptions. Phase B ingests this when the
-- operator registers the collection via POST /api/collections. body_json
-- is the raw JSON of the initial p:pokebells-collection inscription.
-- initial_reveal_txid is the reveal tx of the collection root itself —
-- the sat's location before any collection_update has been accepted.
CREATE TABLE IF NOT EXISTS collections (
  inscription_id       TEXT NOT NULL,
  network              TEXT NOT NULL,
  body_json            TEXT NOT NULL,
  initial_reveal_txid  TEXT NOT NULL,
  registered_at        INTEGER NOT NULL,
  PRIMARY KEY (inscription_id, network),
  CHECK (network IN ('bells-mainnet', 'bells-testnet'))
);

-- Append-only log of accepted op:"collection_update" inscriptions.
-- update_sequence is strictly monotonic per (collection, network); a
-- UNIQUE constraint rejects replays / out-of-order sequences. After
-- each accepted update the collection root sat has moved to
-- (reveal_txid, 0), which becomes the satpoint the NEXT update must
-- spend.
CREATE TABLE IF NOT EXISTS collection_updates (
  inscription_id            TEXT NOT NULL,
  collection_inscription_id TEXT NOT NULL,
  network                   TEXT NOT NULL,
  update_sequence           INTEGER NOT NULL,
  set_json                  TEXT NOT NULL,     -- *_prepend keys only
  commit_txid               TEXT NOT NULL,
  reveal_txid               TEXT NOT NULL,     -- new satpoint = (reveal_txid, 0)
  accepted_at               INTEGER NOT NULL,
  PRIMARY KEY (inscription_id, network),
  UNIQUE (collection_inscription_id, network, update_sequence),
  CHECK (network IN ('bells-mainnet', 'bells-testnet')),
  CHECK (update_sequence >= 1)
);

CREATE INDEX IF NOT EXISTS idx_collection_updates_by_collection
  ON collection_updates(collection_inscription_id, network, update_sequence);

-- Audit trail for invalid updates. Never affects aggregated state.
-- Kept separately so the /api/collection/latest endpoint is purely the
-- accepted view while operators can still inspect why a specific
-- inscription was rejected.
CREATE TABLE IF NOT EXISTS rejected_updates (
  inscription_id            TEXT NOT NULL,
  collection_inscription_id TEXT,              -- may be null if schema broke before reference resolved
  network                   TEXT NOT NULL,
  reason                    TEXT NOT NULL,     -- e.g. 'schema', 'sequence_replay', 'authority_mismatch'
  raw_body_json             TEXT,
  rejected_at               INTEGER NOT NULL,
  PRIMARY KEY (inscription_id, network),
  CHECK (network IN ('bells-mainnet', 'bells-testnet'))
);

CREATE INDEX IF NOT EXISTS idx_rejected_updates_by_collection
  ON rejected_updates(collection_inscription_id, network, rejected_at);
