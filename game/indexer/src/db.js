// D1 access helpers. All reads cap at LIMIT 500 to protect the Worker's
// subrequest + memory budget; clients must paginate via ?offset=.

const MAX_ROWS = 500;

export async function insertCapture(env, inscriptionId, ownerAddress, normalized, raw) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO captures (
      inscription_id, owner_address, species_id, species_name, level,
      iv_atk, iv_def, iv_spe, iv_special, iv_total, shiny, network,
      block_height_at_capture, block_hash_at_capture, attestation,
      signed_in_wallet, session_sequence_number, raw_capture_json,
      valid, registered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(
    inscriptionId,
    ownerAddress,
    normalized.species_id,
    normalized.species_name,
    normalized.level,
    normalized.iv_atk,
    normalized.iv_def,
    normalized.iv_spe,
    normalized.iv_special,
    normalized.iv_total,
    normalized.shiny,
    normalized.network,
    normalized.block_height_at_capture,
    normalized.block_hash_at_capture,
    normalized.attestation,
    normalized.signed_in_wallet,
    normalized.session_sequence_number,
    raw,
    now,
  ).run();
}

export async function logIngestion(env, inscriptionId, network, result, rejectReason, clientIpPrefix) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO ingestion_log (
      inscription_id, network, result, reject_reason, ingested_at, client_ip_prefix
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(inscriptionId, network, result, rejectReason ?? null, now, clientIpPrefix ?? null).run();
}

export async function captureExists(env, inscriptionId) {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM captures WHERE inscription_id = ? LIMIT 1"
  ).bind(inscriptionId).first();
  return !!row;
}

export async function captureById(env, inscriptionId) {
  return env.DB.prepare(`
    SELECT inscription_id, owner_address, species_id, species_name, level,
           iv_atk, iv_def, iv_spe, iv_special, iv_total, shiny, network,
           block_height_at_capture, block_hash_at_capture, signed_in_wallet,
           session_sequence_number, registered_at
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
               registered_at
        FROM captures
        WHERE owner_address = ? AND network = ? AND valid = 1
        ORDER BY registered_at DESC
        LIMIT ? OFFSET ?
      `).bind(ownerAddress, network, cappedLimit, cappedOffset).all()
    : await env.DB.prepare(`
        SELECT inscription_id, species_id, species_name, level, iv_atk, iv_def,
               iv_spe, iv_special, iv_total, shiny, network, block_height_at_capture,
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
           iv_atk, iv_def, iv_spe, iv_special, iv_total, shiny, network, registered_at
    FROM captures
    WHERE species_id = ?
      AND (? IS NULL OR network = ?)
      AND valid = 1
    ORDER BY iv_total DESC, registered_at ASC
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
    WHERE (? IS NULL OR network = ?) AND valid = 1
    ORDER BY iv_total DESC, registered_at ASC
    LIMIT ?
  `).bind(network, network, cappedLimit).all();
  return rows.results ?? [];
}

export async function leaderboardByCount(env, network, limit) {
  const cappedLimit = Math.min(Math.max(1, limit ?? 25), 100);
  const rows = await env.DB.prepare(`
    SELECT owner_address, COUNT(*) AS captures_count, SUM(shiny) AS shiny_count,
           MAX(iv_total) AS best_iv_total
    FROM captures
    WHERE (? IS NULL OR network = ?) AND valid = 1
    GROUP BY owner_address
    ORDER BY captures_count DESC, best_iv_total DESC
    LIMIT ?
  `).bind(network, network, cappedLimit).all();
  return rows.results ?? [];
}

export async function networkStats(env) {
  const row = await env.DB.prepare(`
    SELECT
      COUNT(*)                                               AS total,
      SUM(CASE WHEN network='bells-mainnet' THEN 1 ELSE 0 END) AS mainnet,
      SUM(CASE WHEN network='bells-testnet' THEN 1 ELSE 0 END) AS testnet,
      SUM(shiny)                                             AS shinies,
      COUNT(DISTINCT owner_address)                          AS unique_trainers,
      COUNT(DISTINCT species_id)                             AS unique_species
    FROM captures
    WHERE valid = 1
  `).first();
  return row ?? {};
}
