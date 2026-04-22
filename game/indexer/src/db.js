// D1 access helpers. All reads cap at LIMIT 500 to protect the Worker's
// subrequest + memory budget; clients must paginate via ?offset=.
//
// Schema 1.4 commit-reveal additions:
//   - captures table gained ivs_commitment, ram_snapshot_hash, schema_version,
//     attestation_scheme, svbk_at_capture, capture_content_sha256, reveal_*,
//     current_species_id, evolve_count, plus per-field columns for catch_rate,
//     held_item, friendship, pokerus, status, moves_json, pp_json, ev_*.
//   - new reveals + evolves tables.
//   - insertCapture accepts v1.3 (inline IVs) and v1.4 (commitments only).

const MAX_ROWS = 500;

export async function insertCapture(env, inscriptionId, ownerAddress, n, raw) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO captures (
      inscription_id, owner_address,
      species_id, species_name, level, catch_rate, held_item, friendship, pokerus,
      moves_json, pp_json, status,
      network, block_height_at_capture, block_hash_at_capture,
      signed_in_wallet, session_sequence_number,
      schema_version, attestation_scheme, attestation,
      ivs_commitment, ram_snapshot_hash, svbk_at_capture, capture_content_sha256,
      iv_atk, iv_def, iv_spe, iv_special, iv_total, shiny,
      current_species_id, current_level, evolve_count,
      raw_capture_json, valid, registered_at
    ) VALUES (
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, 0,
      ?, 1, ?
    )
  `).bind(
    inscriptionId, ownerAddress,
    n.species_id, n.species_name, n.level, n.catch_rate, n.held_item, n.friendship, n.pokerus,
    n.moves_json, n.pp_json, n.status,
    n.network, n.block_height_at_capture, n.block_hash_at_capture,
    n.signed_in_wallet, n.session_sequence_number,
    n.schema_version, n.attestation_scheme, n.attestation,
    n.ivs_commitment, n.ram_snapshot_hash, n.svbk_at_capture, n.capture_content_sha256,
    n.iv_atk, n.iv_def, n.iv_spe, n.iv_special, n.iv_total, n.shiny,
    n.species_id, n.level, // current_species_id, current_level start equal to base
    raw, now,
  ).run();
}

export async function insertReveal(env, revealInscriptionId, network, revealNormalized, rawJson) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO reveals (
      reveal_inscription_id, capture_inscription_id, network,
      ivs_salt_hex, iv_atk, iv_def, iv_spe, iv_special, shiny,
      ev_hp, ev_atk, ev_def, ev_spe, ev_spc,
      raw_reveal_json, registered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    revealInscriptionId, revealNormalized.capture_inscription_id, network,
    revealNormalized.ivs_salt_hex,
    revealNormalized.iv_atk, revealNormalized.iv_def, revealNormalized.iv_spe, revealNormalized.iv_special, revealNormalized.shiny,
    revealNormalized.ev_hp, revealNormalized.ev_atk, revealNormalized.ev_def, revealNormalized.ev_spe, revealNormalized.ev_spc,
    rawJson, now,
  ).run();
}

// Apply a validated reveal to its capture row: copy IVs + shiny + EVs over so
// Pokedex / leaderboard queries light up with the revealed stats. Idempotent:
// if the capture already has IVs, no-op (first reveal wins).
export async function applyRevealToCapture(env, revealInscriptionId, n) {
  const now = Math.floor(Date.now() / 1000);
  const iv_total = n.iv_atk + n.iv_def + n.iv_spe + n.iv_special;
  await env.DB.prepare(`
    UPDATE captures SET
      iv_atk = COALESCE(iv_atk, ?),
      iv_def = COALESCE(iv_def, ?),
      iv_spe = COALESCE(iv_spe, ?),
      iv_special = COALESCE(iv_special, ?),
      iv_total = COALESCE(iv_total, ?),
      shiny = COALESCE(shiny, ?),
      ev_hp = COALESCE(ev_hp, ?),
      ev_atk = COALESCE(ev_atk, ?),
      ev_def = COALESCE(ev_def, ?),
      ev_spe = COALESCE(ev_spe, ?),
      ev_spc = COALESCE(ev_spc, ?),
      reveal_inscription_id = COALESCE(reveal_inscription_id, ?),
      reveal_registered_at = COALESCE(reveal_registered_at, ?)
    WHERE inscription_id = ?
  `).bind(
    n.iv_atk, n.iv_def, n.iv_spe, n.iv_special, iv_total,
    n.shiny,
    n.ev_hp, n.ev_atk, n.ev_def, n.ev_spe, n.ev_spc,
    revealInscriptionId, now,
    n.capture_inscription_id,
  ).run();
}

export async function logIngestion(env, inscriptionId, kind, network, result, rejectReason, clientIpPrefix) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO ingestion_log (
      inscription_id, kind, network, result, reject_reason, ingested_at, client_ip_prefix
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(inscriptionId, kind, network, result, rejectReason ?? null, now, clientIpPrefix ?? null).run();
}

export async function captureExists(env, inscriptionId) {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM captures WHERE inscription_id = ? LIMIT 1"
  ).bind(inscriptionId).first();
  return !!row;
}

export async function revealExists(env, revealInscriptionId) {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM reveals WHERE reveal_inscription_id = ? LIMIT 1"
  ).bind(revealInscriptionId).first();
  return !!row;
}

// Dedupe checks: both return { duplicate, conflictingInscriptionId } so the
// worker can return 422 with a clear reason. Content hash dedupe catches
// repost attacks where the same capture body is inscribed by different
// wallets; ram_snapshot_hash dedupe catches save-state replay attacks where
// the attacker bumps session_sequence_number but reuses emulator state.
export async function findContentSha256Conflict(env, contentSha256, newInscriptionId) {
  if (!contentSha256) return null;
  const row = await env.DB.prepare(`
    SELECT inscription_id FROM captures
    WHERE capture_content_sha256 = ? AND inscription_id != ?
    LIMIT 1
  `).bind(contentSha256, newInscriptionId).first();
  return row?.inscription_id ?? null;
}

export async function findRamSnapshotHashConflict(env, ramSnapshotHash, newInscriptionId) {
  if (!ramSnapshotHash) return null;
  const row = await env.DB.prepare(`
    SELECT inscription_id FROM captures
    WHERE ram_snapshot_hash = ? AND inscription_id != ?
    LIMIT 1
  `).bind(ramSnapshotHash, newInscriptionId).first();
  return row?.inscription_id ?? null;
}

export async function captureById(env, inscriptionId) {
  return env.DB.prepare(`
    SELECT inscription_id, owner_address, species_id, species_name, level,
           catch_rate, held_item, friendship, pokerus, status,
           iv_atk, iv_def, iv_spe, iv_special, iv_total, shiny,
           ev_hp, ev_atk, ev_def, ev_spe, ev_spc,
           network, block_height_at_capture, block_hash_at_capture,
           signed_in_wallet, session_sequence_number,
           schema_version, attestation_scheme, attestation,
           ivs_commitment, ram_snapshot_hash, svbk_at_capture,
           reveal_inscription_id, reveal_registered_at,
           current_species_id, current_level, evolve_count,
           registered_at
    FROM captures
    WHERE inscription_id = ? AND valid = 1
  `).bind(inscriptionId).first();
}

export async function capturesByOwner(env, ownerAddress, network, limit, offset) {
  const cappedLimit = Math.min(Math.max(1, limit ?? 100), MAX_ROWS);
  const cappedOffset = Math.max(0, offset ?? 0);
  const rows = network
    ? await env.DB.prepare(`
        SELECT inscription_id, species_id, species_name, level, iv_atk, iv_def,
               iv_spe, iv_special, iv_total, shiny, network, block_height_at_capture,
               schema_version, reveal_inscription_id, current_species_id, evolve_count,
               registered_at
        FROM captures
        WHERE owner_address = ? AND network = ? AND valid = 1
        ORDER BY registered_at DESC
        LIMIT ? OFFSET ?
      `).bind(ownerAddress, network, cappedLimit, cappedOffset).all()
    : await env.DB.prepare(`
        SELECT inscription_id, species_id, species_name, level, iv_atk, iv_def,
               iv_spe, iv_special, iv_total, shiny, network, block_height_at_capture,
               schema_version, reveal_inscription_id, current_species_id, evolve_count,
               registered_at
        FROM captures
        WHERE owner_address = ? AND valid = 1
        ORDER BY registered_at DESC
        LIMIT ? OFFSET ?
      `).bind(ownerAddress, cappedLimit, cappedOffset).all();
  return rows.results ?? [];
}

export async function capturesBySpecies(env, speciesId, network, limit, offset) {
  const cappedLimit = Math.min(Math.max(1, limit ?? 50), MAX_ROWS);
  const cappedOffset = Math.max(0, offset ?? 0);
  const rows = await env.DB.prepare(`
    SELECT inscription_id, owner_address, species_id, species_name, level,
           iv_atk, iv_def, iv_spe, iv_special, iv_total, shiny, network,
           schema_version, reveal_inscription_id, registered_at
    FROM captures
    WHERE species_id = ?
      AND (? IS NULL OR network = ?)
      AND valid = 1
    ORDER BY iv_total DESC NULLS LAST, registered_at ASC
    LIMIT ? OFFSET ?
  `).bind(speciesId, network, network, cappedLimit, cappedOffset).all();
  return rows.results ?? [];
}

export async function leaderboardByIvTotal(env, network, limit) {
  const cappedLimit = Math.min(Math.max(1, limit ?? 25), 100);
  const rows = await env.DB.prepare(`
    SELECT inscription_id, owner_address, species_id, species_name, level,
           iv_total, shiny, network
    FROM captures
    WHERE (? IS NULL OR network = ?) AND valid = 1 AND iv_total IS NOT NULL
    ORDER BY iv_total DESC, registered_at ASC
    LIMIT ?
  `).bind(network, network, cappedLimit).all();
  return rows.results ?? [];
}

export async function leaderboardByCount(env, network, limit) {
  const cappedLimit = Math.min(Math.max(1, limit ?? 25), 100);
  const rows = await env.DB.prepare(`
    SELECT owner_address, COUNT(*) AS captures_count,
           COALESCE(SUM(shiny), 0) AS shiny_count,
           MAX(iv_total) AS best_iv_total
    FROM captures
    WHERE (? IS NULL OR network = ?) AND valid = 1
    GROUP BY owner_address
    ORDER BY captures_count DESC, best_iv_total DESC
    LIMIT ?
  `).bind(network, network, cappedLimit).all();
  return rows.results ?? [];
}

// ---- Saves (op:"save-snapshot") ----

export async function insertSave(env, saveInscriptionId, n, raw) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO saves (
      save_inscription_id, signed_in_wallet,
      game_rom, game_rom_sha256, network,
      save_version, sram_sha256, sram_byte_length,
      save_scheme, signature_scheme, signature,
      block_hash_at_save, raw_save_json, registered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    saveInscriptionId, n.signed_in_wallet,
    n.game_rom, n.game_rom_sha256, n.network,
    n.save_version, n.sram_sha256, n.sram_byte_length,
    n.save_scheme, n.signature_scheme, n.signature,
    n.block_hash_at_save, raw, now,
  ).run();
}

export async function saveExists(env, saveInscriptionId) {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM saves WHERE save_inscription_id = ? LIMIT 1"
  ).bind(saveInscriptionId).first();
  return !!row;
}

// Find the highest save_version that the indexer has seen for a given
// (wallet, rom, network). Used to reject stale inscriptions (replays or
// intentional downgrades).
export async function findLatestSaveVersion(env, wallet, romSha, network) {
  const row = await env.DB.prepare(`
    SELECT MAX(save_version) AS latest
    FROM saves
    WHERE signed_in_wallet = ? AND game_rom_sha256 = ? AND network = ?
  `).bind(wallet, romSha, network).first();
  return row?.latest ?? 0;
}

// Return the latest save metadata (no sram bytes — caller fetches content
// via Nintondo if it needs the payload). Used by GET /api/saves/<wallet>.
export async function latestSaveByWallet(env, wallet, romSha, network) {
  const row = await env.DB.prepare(`
    SELECT save_inscription_id, signed_in_wallet, game_rom, game_rom_sha256,
           network, save_version, sram_sha256, sram_byte_length, save_scheme,
           signature_scheme, block_hash_at_save, registered_at
    FROM saves
    WHERE signed_in_wallet = ? AND game_rom_sha256 = ? AND network = ?
    ORDER BY save_version DESC
    LIMIT 1
  `).bind(wallet, romSha, network).first();
  return row ?? null;
}

export async function networkStats(env) {
  const row = await env.DB.prepare(`
    SELECT
      COUNT(*)                                                        AS total,
      COALESCE(SUM(CASE WHEN network='bells-mainnet' THEN 1 ELSE 0 END), 0) AS mainnet,
      COALESCE(SUM(CASE WHEN network='bells-testnet' THEN 1 ELSE 0 END), 0) AS testnet,
      COALESCE(SUM(CASE WHEN shiny = 1 THEN 1 ELSE 0 END), 0)         AS shinies,
      COALESCE(SUM(CASE WHEN reveal_inscription_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS revealed,
      COUNT(DISTINCT owner_address)                                   AS unique_trainers,
      COUNT(DISTINCT species_id)                                      AS unique_species
    FROM captures
    WHERE valid = 1
  `).first();
  return row ?? {};
}
