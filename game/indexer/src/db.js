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

// =====================================================================
// Schema v1.5 — commits + pokemon
// =====================================================================

export async function insertCommit(env, inscriptionId, normalized, rawJson) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO commits (
      inscription_id, network, signed_in_wallet, session_sequence_number,
      block_hash_at_capture, game_rom_sha256, party_slot_index,
      ivs_commitment, ivs_commitment_scheme,
      ram_snapshot_hash, ram_commitment_scheme, svbk_at_capture,
      attestation, attestation_scheme,
      raw_commit_json, registered_at, valid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(
    inscriptionId,
    normalized.network,
    normalized.signed_in_wallet,
    normalized.session_sequence_number,
    normalized.block_hash_at_capture,
    normalized.game_rom_sha256,
    normalized.party_slot_index,
    normalized.ivs_commitment,
    normalized.ivs_commitment_scheme,
    normalized.ram_snapshot_hash,
    normalized.ram_commitment_scheme,
    normalized.svbk_at_capture,
    normalized.attestation,
    normalized.attestation_scheme,
    rawJson,
    now,
  ).run();
}

export async function commitExists(env, inscriptionId) {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM commits WHERE inscription_id = ? LIMIT 1"
  ).bind(inscriptionId).first();
  return !!row;
}

export async function commitById(env, inscriptionId) {
  const row = await env.DB.prepare(
    "SELECT * FROM commits WHERE inscription_id = ? LIMIT 1"
  ).bind(inscriptionId).first();
  return row ?? null;
}

export async function pokemonExists(env, mintInscriptionId) {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM pokemon WHERE mint_inscription_id = ? LIMIT 1"
  ).bind(mintInscriptionId).first();
  return !!row;
}

export async function pokemonByCommit(env, refCaptureCommit) {
  const row = await env.DB.prepare(
    "SELECT * FROM pokemon WHERE ref_capture_commit = ? LIMIT 1"
  ).bind(refCaptureCommit).first();
  return row ?? null;
}

export async function insertPokemon(env, mintInscriptionId, normalized, rawJson) {
  const now = Math.floor(Date.now() / 1000);

  // Compute is_starter: the wallet's FIRST mint gets the starter flag.
  // We count existing pokemon for this wallet on this network. Race-safe
  // because schema.sql has a UNIQUE partial index on (signed_in_wallet)
  // WHERE is_starter = 1 — if two concurrent inserts both try to set
  // is_starter=1, SQLite rejects the second with a constraint failure
  // and we retry with is_starter=0 (see retry branch below).
  const existingCount = await env.DB.prepare(`
    SELECT COUNT(*) AS n FROM pokemon WHERE signed_in_wallet = ? AND network = ?
  `).bind(normalized.signed_in_wallet, normalized.network).first();
  const isStarter = (existingCount?.n ?? 0) === 0 ? 1 : 0;

  const doInsert = async (starterFlag) => env.DB.prepare(`
    INSERT INTO pokemon (
      mint_inscription_id, ref_capture_commit, network, signed_in_wallet,
      party_slot_index, species_id, species_name, level, shiny,
      iv_atk, iv_def, iv_spe, iv_special, iv_hp, iv_total,
      ev_hp, ev_atk, ev_def, ev_spe, ev_spc,
      status, held_item, friendship, pokerus, catch_rate,
      moves_json, pp_json, name, description, image, attributes_json,
      raw_mint_json, registered_at, is_starter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    mintInscriptionId,
    normalized.ref_capture_commit,
    normalized.network,
    normalized.signed_in_wallet,
    normalized.party_slot_index,
    normalized.species_id,
    normalized.species_name,
    normalized.level,
    normalized.shiny,
    normalized.iv_atk, normalized.iv_def, normalized.iv_spe, normalized.iv_special,
    normalized.iv_hp, normalized.iv_total,
    normalized.ev_hp, normalized.ev_atk, normalized.ev_def, normalized.ev_spe, normalized.ev_spc,
    normalized.status, normalized.held_item, normalized.friendship, normalized.pokerus,
    normalized.catch_rate,
    normalized.moves_json, normalized.pp_json,
    normalized.name, normalized.description, normalized.image, normalized.attributes_json,
    rawJson, now, starterFlag,
  ).run();

  try {
    await doInsert(isStarter);
  } catch (e) {
    // UNIQUE constraint on idx_pokemon_starter_unique partial index lost
    // the race — another concurrent mint for this wallet already grabbed
    // the starter slot. Retry as a non-starter row.
    //
    // Match on the specific index name (not just "UNIQUE constraint") so
    // a different UNIQUE violation — e.g. pokemon.mint_inscription_id PK
    // on a replayed POST — does not trigger a spurious non-starter retry.
    if (isStarter === 1 && isStarterRaceError(e)) {
      await doInsert(0);
      return;
    }
    throw e;
  }
}

// Detects the D1 error raised when two concurrent inserts both try to
// grab is_starter=1 and the partial UNIQUE INDEX idx_pokemon_starter_unique
// rejects the second. Inspects e.message AND e.cause.message because D1
// sometimes wraps the SQLite error inside a cause chain.
export function isStarterRaceError(e) {
  const msg = String(e?.message ?? "");
  const causeMsg = String(e?.cause?.message ?? "");
  const combined = `${msg} ${causeMsg}`;
  return /UNIQUE constraint failed/i.test(combined)
      && /idx_pokemon_starter_unique/i.test(combined);
}

// =====================================================================
// Phase B: collection + op:"collection_update" DB helpers
// =====================================================================
// Authority model = sat-spend-v1 (see game/ROOT-APP-DESIGN.md). The
// helpers below do NOT verify sat-spend authority — that is the caller's
// responsibility via verifyCollectionUpdateAuthority. These helpers only
// persist + read rows; authority must pass before insertAccepted* is
// called.

export async function registerCollectionRoot(env, {
  inscriptionId, network, bodyJson, initialRevealTxid,
}) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO collections (
      inscription_id, network, body_json, initial_reveal_txid, registered_at
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(inscriptionId, network, bodyJson, initialRevealTxid, now).run();
}

export async function getCollectionRoot(env, inscriptionId, network) {
  const row = await env.DB.prepare(`
    SELECT * FROM collections WHERE inscription_id = ? AND network = ?
  `).bind(inscriptionId, network).first();
  return row ?? null;
}

// Insert an accepted collection_update. The UNIQUE (collection, network,
// update_sequence) constraint rejects replays and out-of-order sequences
// at the storage layer; the caller catches the error + records via
// recordRejectedUpdate for audit. Caller is responsible for calling
// verifyCollectionUpdateAuthority BEFORE reaching this function.
export async function insertAcceptedCollectionUpdate(env, {
  inscriptionId, collectionInscriptionId, network,
  updateSequence, setJson, commitTxid, revealTxid,
}) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO collection_updates (
      inscription_id, collection_inscription_id, network, update_sequence,
      set_json, commit_txid, reveal_txid, accepted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    inscriptionId, collectionInscriptionId, network, updateSequence,
    setJson, commitTxid, revealTxid, now,
  ).run();
}

// Audit trail. INSERT OR IGNORE so a retried POST of an already-rejected
// inscription doesn't spam the table.
export async function recordRejectedUpdate(env, {
  inscriptionId, collectionInscriptionId, network, reason, rawBodyJson,
}) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO rejected_updates (
      inscription_id, collection_inscription_id, network,
      reason, raw_body_json, rejected_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    inscriptionId, collectionInscriptionId ?? null, network,
    reason, rawBodyJson ?? null, now,
  ).run();
}

// Returns the satpoint the NEXT collection_update's commit tx must spend,
// derived deterministically from the accepted update chain:
//   - no updates yet -> (collection.initial_reveal_txid, 0)
//   - N updates      -> (latest_update.reveal_txid, 0)
// Returns null if the collection root is not registered.
export async function currentCollectionSatpoint(env, collectionInscriptionId, network) {
  const latest = await env.DB.prepare(`
    SELECT reveal_txid, update_sequence FROM collection_updates
    WHERE collection_inscription_id = ? AND network = ?
    ORDER BY update_sequence DESC
    LIMIT 1
  `).bind(collectionInscriptionId, network).first();
  if (latest?.reveal_txid) {
    return {
      revealTxid: latest.reveal_txid,
      vout: 0,
      lastSequence: latest.update_sequence,
    };
  }
  const root = await getCollectionRoot(env, collectionInscriptionId, network);
  if (!root) return null;
  return {
    revealTxid: root.initial_reveal_txid,
    vout: 0,
    lastSequence: 0,
  };
}

// Returns the aggregated collection view: the root body with all accepted
// *_prepend updates applied in sequence order (newest prepended to the
// front). The result is what /api/collection/latest returns.
export async function aggregatedCollectionLatest(env, collectionInscriptionId, network) {
  const root = await getCollectionRoot(env, collectionInscriptionId, network);
  if (!root) return null;

  let body;
  try {
    body = JSON.parse(root.body_json);
  } catch (e) {
    throw new Error(`collection ${collectionInscriptionId} has invalid body_json: ${e.message}`);
  }

  const rows = await env.DB.prepare(`
    SELECT inscription_id, update_sequence, set_json, reveal_txid, accepted_at
    FROM collection_updates
    WHERE collection_inscription_id = ? AND network = ?
    ORDER BY update_sequence ASC
  `).bind(collectionInscriptionId, network).all();
  const updates = (rows?.results ?? []).map((u) => ({
    ...u,
    set: JSON.parse(u.set_json),
  }));

  // Clone the root body so we never mutate the stored row's parsed copy.
  const aggregated = JSON.parse(JSON.stringify(body));
  const stats = { applied_updates: 0, prepended: {} };
  for (const u of updates) {
    for (const key of Object.keys(u.set)) {
      const targetKey = key.endsWith("_prepend")
        ? key.slice(0, -"_prepend".length)
        : key;
      if (!Array.isArray(aggregated[targetKey])) continue;
      aggregated[targetKey] = [...u.set[key], ...aggregated[targetKey]];
      stats.prepended[targetKey] = (stats.prepended[targetKey] ?? 0) + u.set[key].length;
    }
    stats.applied_updates += 1;
  }

  return {
    collection_inscription_id: root.inscription_id,
    network: root.network,
    registered_at: root.registered_at,
    aggregated,
    stats,
    current_satpoint: {
      reveal_txid: updates.length > 0
        ? updates[updates.length - 1].reveal_txid
        : root.initial_reveal_txid,
      vout: 0,
      last_sequence: updates.length > 0
        ? updates[updates.length - 1].update_sequence
        : 0,
    },
  };
}

export async function pokemonByOwner(env, ownerAddress, network, limit = 50, offset = 0) {
  const rows = await env.DB.prepare(`
    SELECT * FROM pokemon
    WHERE signed_in_wallet = ? AND network = ?
    ORDER BY registered_at DESC
    LIMIT ? OFFSET ?
  `).bind(ownerAddress, network, limit, offset).all();
  return rows?.results ?? [];
}

export async function pokemonBySpecies(env, speciesId, network, limit = 50, offset = 0) {
  const rows = await env.DB.prepare(`
    SELECT * FROM pokemon
    WHERE species_id = ? AND network = ?
    ORDER BY iv_total DESC, registered_at ASC
    LIMIT ? OFFSET ?
  `).bind(speciesId, network, limit, offset).all();
  return rows?.results ?? [];
}

// =====================================================================
// Async ingestion queue — niveau 1
// =====================================================================
// Drain target for POST /api/captures + /api/mints that hit a 404 on
// the Nintondo content host (eventually-consistent lag). A Cron
// Trigger on the worker scans rows where retry_after <= now and
// replays the fetch + validate pipeline. Max 24 attempts with
// exponential-ish backoff handled in worker.js.

export async function enqueueForIngestion(env, inscriptionId, kind, network, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const retryAfter = options.retryAfter ?? now + 60;  // default: retry in 1 min
  await env.DB.prepare(`
    INSERT INTO ingestion_queue (inscription_id, kind, network, enqueued_at, retry_after, attempts, last_error)
    VALUES (?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(inscription_id, kind) DO UPDATE SET
      retry_after = excluded.retry_after,
      last_error = excluded.last_error
  `).bind(
    inscriptionId, kind, network, now, retryAfter, options.lastError ?? null,
  ).run();
}

export async function dequeueIngestion(env, inscriptionId, kind) {
  await env.DB.prepare(
    "DELETE FROM ingestion_queue WHERE inscription_id = ? AND kind = ?",
  ).bind(inscriptionId, kind).run();
}

export async function bumpIngestionRetry(env, inscriptionId, kind, nextRetryAfter, error) {
  await env.DB.prepare(`
    UPDATE ingestion_queue SET
      attempts = attempts + 1,
      retry_after = ?,
      last_error = ?
    WHERE inscription_id = ? AND kind = ?
  `).bind(nextRetryAfter, error ?? null, inscriptionId, kind).run();
}

export async function claimDueQueueEntries(env, limit = 25) {
  const now = Math.floor(Date.now() / 1000);
  const rows = await env.DB.prepare(`
    SELECT inscription_id, kind, network, enqueued_at, retry_after, attempts, last_error
    FROM ingestion_queue
    WHERE retry_after <= ?
    ORDER BY retry_after ASC
    LIMIT ?
  `).bind(now, limit).all();
  return rows?.results ?? [];
}

// Give up after this many failed attempts. 24 with backoff ~doubling
// from 1min covers a real-world 24h window before abandoning.
export const INGESTION_QUEUE_MAX_ATTEMPTS = 24;

// =====================================================================
// Chain scan cursor — niveau 2
// =====================================================================

export async function readScanCursor(env, network, scheme) {
  const row = await env.DB.prepare(
    "SELECT cursor_value, last_scanned_at, last_inscriptions_found FROM scan_cursor WHERE network = ? AND scheme = ?",
  ).bind(network, scheme).first();
  return row ?? null;
}

export async function writeScanCursor(env, network, scheme, cursorValue, inscriptionsFound = 0) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO scan_cursor (network, scheme, cursor_value, last_scanned_at, last_inscriptions_found)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(network, scheme) DO UPDATE SET
      cursor_value = excluded.cursor_value,
      last_scanned_at = excluded.last_scanned_at,
      last_inscriptions_found = excluded.last_inscriptions_found
  `).bind(network, scheme, cursorValue, now, inscriptionsFound).run();
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
