// PokeBells indexer — CF Worker entry.
//
// Model: register-on-mint. The companion POSTs { inscription_id, network }
// after a user signs and inscribes a capture (or reveal). The worker fetches
// the content from bells-*-content.nintondo.io, runs the validator (schema +
// attestation + block-hash existence + dedupe), and on success writes a row
// to D1.
//
// Supported ops:
//   POST /api/captures  { inscription_id, network }  — register a capture
//   POST /api/reveals   { inscription_id, network }  — register an on-chain
//     reveal inscription; validator cross-checks commitments against the
//     capture and copies revealed IVs/EVs/shiny onto the capture row.
//   POST /api/reveals/offchain { capture_inscription_id, network,
//       ivs, ivs_salt_hex, ram_snapshot, shiny?, evs? } — reveal by
//     preimage without a second inscription. Same commitment checks as the
//     on-chain reveal. Stored under the sentinel reveal_inscription_id
//     "offchain:<capture_inscription_id>" so onchain reveals still win
//     (COALESCE semantics in applyRevealToCapture).
//   GET  /api/captures/:id  — lookup
//   GET  /api/trainer/:owner
//   GET  /api/pokedex?species=N
//   GET  /api/leaderboard?by=iv_total|count
//   GET  /api/stats
//
// Dedupe defenses on POST /api/captures:
//   - inscription_id already in captures         → 200 {status:duplicate}
//   - capture_content_sha256 collision elsewhere → 422 content_duplicate
//   - ram_snapshot_hash collision elsewhere      → 422 snapshot_replay
//
// Async pipeline: POST endpoints enqueue on content-404 (Nintondo content host
// lag after block confirmation). A Cron Trigger (see wrangler.toml) drains
// `ingestion_queue` every few minutes + retries the fetch + validate chain.
// Clients no longer need to retry client-side or poll — POST once, the
// indexer owns the delivery. Chain scan cron (niveau 2) enumerates
// `p:pokebells` inscriptions via Nintondo's RSC API so mints done outside
// our companion still land in the collection.

import {
  fetchAndValidateInscription, validateReveal, validateSaveSnapshot,
  validateMintV1_5, verifyMintOwner,
  validateCollection, validateCollectionUpdate, verifyCollectionUpdateAuthority,
} from "./validator.js";
import {
  insertCapture, insertReveal, applyRevealToCapture, logIngestion,
  captureExists, revealExists, captureById,
  findContentSha256Conflict, findRamSnapshotHashConflict,
  capturesByOwner, capturesBySpecies,
  leaderboardByIvTotal, leaderboardByCount, networkStats,
  insertSave, saveExists, findLatestSaveVersion, latestSaveByWallet,
  insertCommit, commitExists, commitById,
  insertPokemon, pokemonExists, pokemonByCommit,
  pokemonByOwner, pokemonBySpecies,
  enqueueForIngestion, dequeueIngestion, bumpIngestionRetry,
  claimDueQueueEntries, INGESTION_QUEUE_MAX_ATTEMPTS,
  readScanCursor, writeScanCursor,
  registerCollectionRoot, getCollectionRoot,
  insertAcceptedCollectionUpdate, recordRejectedUpdate,
  currentCollectionSatpoint, aggregatedCollectionLatest,
} from "./db.js";

// Exponential-ish backoff for queue retries: 1m, 2m, 5m, 10m, 20m,
// capped at 30m. At 24 attempts that's roughly 11-12h total wait
// before the queue gives up.
function nextQueueRetrySeconds(attempts) {
  const base = Math.min(60 * Math.pow(1.8, Math.max(0, attempts)), 1800);
  return Math.floor(Date.now() / 1000) + Math.floor(base);
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

function json(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

function clientIpPrefix(request) {
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  if (!ip) return null;
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 3).join(":") + "::";
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : null;
}

async function handlePostCapture(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const inscriptionId = typeof body?.inscription_id === "string"
    ? body.inscription_id.trim() : "";
  const network = typeof body?.network === "string" ? body.network.trim() : "";

  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  const ipPrefix = clientIpPrefix(request);

  // v1.5: capture_commit lives in the `commits` table (separate from
  // legacy v1.3/v1.4 captures). Same endpoint dispatches based on op so
  // companion + game can keep the single POST /api/captures URL.
  if (await commitExists(env, inscriptionId)) {
    await logIngestion(env, inscriptionId, "capture_commit", network, "duplicate", null, ipPrefix);
    return json({ ok: true, status: "duplicate", kind: "capture_commit", inscription_id: inscriptionId });
  }
  if (await captureExists(env, inscriptionId)) {
    await logIngestion(env, inscriptionId, "capture", network, "duplicate", null, ipPrefix);
    return json({ ok: true, status: "duplicate", inscription_id: inscriptionId });
  }

  const result = await fetchAndValidateInscription(inscriptionId, network, env);
  if (!result.ok) {
    // Content host lag: the tx confirmed but Nintondo's ord index hasn't
    // served it yet. Enqueue + return 202 so the client can consider the
    // call "delivered" and forget about it. The scheduled drain
    // (wrangler.toml cron) replays this same endpoint every few minutes
    // until the content catches up.
    if (result.stage === "fetch" && /404/.test(String(result.reason ?? ""))) {
      await enqueueForIngestion(env, inscriptionId, "capture", network, {
        lastError: result.reason,
      });
      await logIngestion(env, inscriptionId, "capture", network, "queued", result.reason, ipPrefix);
      return json(
        { ok: true, status: "queued", reason: "content host not ready, queued for retry", inscription_id: inscriptionId },
        { status: 202 },
      );
    }
    await logIngestion(env, inscriptionId, "capture", network, "invalid", `${result.stage}: ${result.reason}`, ipPrefix);
    return json(
      { ok: false, error: "validation_failed", stage: result.stage, reason: result.reason },
      { status: 422 },
    );
  }

  if (result.kind === "reveal") {
    await logIngestion(env, inscriptionId, "capture", network, "invalid", "wrong_op_use_reveals_endpoint", ipPrefix);
    return json(
      { ok: false, error: "wrong_op", reason: "inscription is op:reveal — POST /api/reveals instead" },
      { status: 422 },
    );
  }
  if (result.kind === "mint") {
    await logIngestion(env, inscriptionId, "capture", network, "invalid", "wrong_op_use_mints_endpoint", ipPrefix);
    return json(
      { ok: false, error: "wrong_op", reason: "inscription is op:mint — POST /api/mints instead" },
      { status: 422 },
    );
  }

  // v1.5 capture_commit branch — separate table, no species/level needed.
  if (result.kind === "capture_commit") {
    const cn = result.normalized;
    cn.inscription_id = inscriptionId;
    if (cn.network !== network) {
      await logIngestion(env, inscriptionId, "capture_commit", network, "invalid",
        "network mismatch between request and capture_commit body", ipPrefix);
      return json({ ok: false, error: "network_mismatch" }, { status: 422 });
    }
    try {
      await insertCommit(env, inscriptionId, cn, result.raw);
      await logIngestion(env, inscriptionId, "capture_commit", network, "ok", null, ipPrefix);
    } catch (e) {
      await logIngestion(env, inscriptionId, "capture_commit", network, "error", e.message, ipPrefix);
      return json({ ok: false, error: "db_error", reason: e.message }, { status: 500 });
    }
    return json({
      ok: true,
      status: "registered",
      kind: "capture_commit",
      inscription_id: inscriptionId,
      schema_version: "1.5",
      needs_mint: true,
    });
  }

  const n = result.normalized;

  // Dedupe checks run after validation so we don't index cheat attempts:
  //   content_sha256 dupe = same capture body re-inscribed (money print)
  //   ram_snapshot_hash dupe = same emulator state re-used (save replay)
  const contentConflict = await findContentSha256Conflict(env, n.capture_content_sha256, inscriptionId);
  if (contentConflict) {
    await logIngestion(env, inscriptionId, "capture", network, "invalid",
      `content_duplicate of ${contentConflict}`, ipPrefix);
    return json(
      { ok: false, error: "content_duplicate", conflicts_with: contentConflict },
      { status: 422 },
    );
  }
  const snapshotConflict = await findRamSnapshotHashConflict(env, n.ram_snapshot_hash, inscriptionId);
  if (snapshotConflict) {
    await logIngestion(env, inscriptionId, "capture", network, "invalid",
      `snapshot_replay of ${snapshotConflict}`, ipPrefix);
    return json(
      { ok: false, error: "snapshot_replay", conflicts_with: snapshotConflict },
      { status: 422 },
    );
  }

  const ownerAddress = n.signed_in_wallet;

  try {
    await insertCapture(env, inscriptionId, ownerAddress, n, result.raw);
    await logIngestion(env, inscriptionId, "capture", network, "ok", null, ipPrefix);
  } catch (e) {
    await logIngestion(env, inscriptionId, "capture", network, "error", e.message, ipPrefix);
    return json({ ok: false, error: "db_error", reason: e.message }, { status: 500 });
  }

  return json({
    ok: true,
    status: "registered",
    kind: "capture",
    inscription_id: inscriptionId,
    owner_address: ownerAddress,
    species_id: n.species_id,
    schema_version: n.schema_version,
    needs_reveal: n.schema_version === "1.4",
  });
}

async function handlePostReveal(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const inscriptionId = typeof body?.inscription_id === "string"
    ? body.inscription_id.trim() : "";
  const network = typeof body?.network === "string" ? body.network.trim() : "";

  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  const ipPrefix = clientIpPrefix(request);

  if (await revealExists(env, inscriptionId)) {
    await logIngestion(env, inscriptionId, "reveal", network, "duplicate", null, ipPrefix);
    return json({ ok: true, status: "duplicate", inscription_id: inscriptionId });
  }

  const fetched = await fetchAndValidateInscription(inscriptionId, network, env);
  if (!fetched.ok) {
    if (fetched.stage === "fetch" && /404/.test(String(fetched.reason ?? ""))) {
      await enqueueForIngestion(env, inscriptionId, "reveal", network, { lastError: fetched.reason });
      await logIngestion(env, inscriptionId, "reveal", network, "queued", fetched.reason, ipPrefix);
      return json(
        { ok: true, status: "queued", inscription_id: inscriptionId },
        { status: 202 },
      );
    }
    await logIngestion(env, inscriptionId, "reveal", network, "invalid", `${fetched.stage}: ${fetched.reason}`, ipPrefix);
    return json(
      { ok: false, error: "validation_failed", stage: fetched.stage, reason: fetched.reason },
      { status: 422 },
    );
  }
  if (fetched.kind !== "reveal") {
    await logIngestion(env, inscriptionId, "reveal", network, "invalid", "wrong_op_expected_reveal", ipPrefix);
    return json(
      { ok: false, error: "wrong_op", reason: `expected op:reveal, got op:${fetched.parsed?.op}` },
      { status: 422 },
    );
  }

  const revealParsed = fetched.parsed;
  const captureRefId = typeof revealParsed.ref === "string" ? revealParsed.ref.trim() : "";
  if (!INSCRIPTION_ID_RE.test(captureRefId)) {
    await logIngestion(env, inscriptionId, "reveal", network, "invalid", "bad_ref", ipPrefix);
    return json(
      { ok: false, error: "bad_ref", reason: "reveal.ref must be the capture inscription id" },
      { status: 422 },
    );
  }

  const captureRow = await captureById(env, captureRefId);
  if (!captureRow) {
    await logIngestion(env, inscriptionId, "reveal", network, "invalid", "capture_not_registered", ipPrefix);
    return json(
      { ok: false, error: "capture_not_registered", reason: "register the capture inscription first" },
      { status: 422 },
    );
  }

  const check = await validateReveal(revealParsed, captureRow, env);
  if (!check.ok) {
    await logIngestion(env, inscriptionId, "reveal", network, "invalid", `${check.stage}: ${check.reason}`, ipPrefix);
    return json(
      { ok: false, error: "reveal_invalid", stage: check.stage, reason: check.reason },
      { status: 422 },
    );
  }

  try {
    await insertReveal(env, inscriptionId, network, check.normalized, fetched.raw);
    await applyRevealToCapture(env, inscriptionId, check.normalized);
    await logIngestion(env, inscriptionId, "reveal", network, "ok", null, ipPrefix);
  } catch (e) {
    await logIngestion(env, inscriptionId, "reveal", network, "error", e.message, ipPrefix);
    return json({ ok: false, error: "db_error", reason: e.message }, { status: 500 });
  }

  return json({
    ok: true,
    status: "revealed",
    kind: "reveal",
    inscription_id: inscriptionId,
    capture_inscription_id: captureRefId,
    iv_total: check.normalized.iv_total,
    shiny: check.normalized.shiny,
  });
}

// v1.5 mint registration. Validates the mint inscription against its
// referenced commit (all 22 SCHEMA-v1.5.md checks where applicable),
// performs the electrs vout[0] owner check (#11), enforces uniqueness via
// the pokemon table's UNIQUE(ref_capture_commit) constraint (#12), and
// inserts the canonical pokemon row.
async function handlePostMint(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const inscriptionId = typeof body?.inscription_id === "string"
    ? body.inscription_id.trim() : "";
  const network = typeof body?.network === "string" ? body.network.trim() : "";

  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  const ipPrefix = clientIpPrefix(request);

  if (await pokemonExists(env, inscriptionId)) {
    await logIngestion(env, inscriptionId, "mint", network, "duplicate", null, ipPrefix);
    return json({ ok: true, status: "duplicate", inscription_id: inscriptionId });
  }

  const fetched = await fetchAndValidateInscription(inscriptionId, network, env);
  if (!fetched.ok) {
    if (fetched.stage === "fetch" && /404/.test(String(fetched.reason ?? ""))) {
      await enqueueForIngestion(env, inscriptionId, "mint", network, { lastError: fetched.reason });
      await logIngestion(env, inscriptionId, "mint", network, "queued", fetched.reason, ipPrefix);
      return json(
        { ok: true, status: "queued", inscription_id: inscriptionId },
        { status: 202 },
      );
    }
    await logIngestion(env, inscriptionId, "mint", network, "invalid", `${fetched.stage}: ${fetched.reason}`, ipPrefix);
    return json(
      { ok: false, error: "validation_failed", stage: fetched.stage, reason: fetched.reason },
      { status: 422 },
    );
  }
  if (fetched.kind !== "mint") {
    await logIngestion(env, inscriptionId, "mint", network, "invalid", `wrong_op_expected_mint_got_${fetched.kind}`, ipPrefix);
    return json(
      { ok: false, error: "wrong_op", reason: `expected op:mint, got op:${fetched.parsed?.op}` },
      { status: 422 },
    );
  }

  const mintParsed = fetched.parsed;
  const refCommitId = typeof mintParsed.ref_capture_commit === "string"
    ? mintParsed.ref_capture_commit.trim() : "";
  if (!INSCRIPTION_ID_RE.test(refCommitId)) {
    await logIngestion(env, inscriptionId, "mint", network, "invalid", "bad_ref_capture_commit", ipPrefix);
    return json(
      { ok: false, error: "bad_ref_capture_commit", reason: "mint.ref_capture_commit must be a valid inscription id" },
      { status: 422 },
    );
  }

  const commitRow = await commitById(env, refCommitId);
  if (!commitRow) {
    await logIngestion(env, inscriptionId, "mint", network, "invalid", "commit_not_registered", ipPrefix);
    return json(
      { ok: false, error: "commit_not_registered", reason: "register the capture_commit inscription first" },
      { status: 422 },
    );
  }
  if (commitRow.network !== network) {
    await logIngestion(env, inscriptionId, "mint", network, "invalid", "network_mismatch_with_commit", ipPrefix);
    return json({ ok: false, error: "network_mismatch_with_commit" }, { status: 422 });
  }

  // First-valid-per-commit (check #12). Race-safe via the UNIQUE
  // constraint on insert below, but checked early here for a friendlier
  // error.
  const existingPokemon = await pokemonByCommit(env, refCommitId);
  if (existingPokemon) {
    await logIngestion(env, inscriptionId, "mint", network, "invalid",
      `commit_already_minted_by_${existingPokemon.mint_inscription_id}`, ipPrefix);
    return json({
      ok: false,
      error: "commit_already_minted",
      conflicts_with: existingPokemon.mint_inscription_id,
    }, { status: 422 });
  }

  // Cryptographic + RAM cross-checks (checks 1-10m).
  const check = await validateMintV1_5(mintParsed, commitRow, env);
  if (!check.ok) {
    await logIngestion(env, inscriptionId, "mint", network, "invalid", `${check.stage}: ${check.reason}`, ipPrefix);
    return json(
      { ok: false, error: "mint_invalid", stage: check.stage, reason: check.reason },
      { status: 422 },
    );
  }

  // Owner check (check #11). Skipped silently on testnet if env not
  // configured; mainnet deployment MUST set ELECTRS_BASE_MAINNET.
  const ownerCheck = await verifyMintOwner(inscriptionId, mintParsed.signed_in_wallet, env, network);
  if (!ownerCheck.ok) {
    await logIngestion(env, inscriptionId, "mint", network, "invalid", `${ownerCheck.stage}: ${ownerCheck.reason}`, ipPrefix);
    return json(
      { ok: false, error: "owner_check_failed", stage: ownerCheck.stage, reason: ownerCheck.reason },
      { status: 422 },
    );
  }

  const n = check.normalized;
  n.mint_inscription_id = inscriptionId;

  try {
    await insertPokemon(env, inscriptionId, n, fetched.raw);
    await logIngestion(env, inscriptionId, "mint", network, "ok",
      ownerCheck.skipped ? "owner_check_skipped" : null, ipPrefix);
  } catch (e) {
    // UNIQUE(ref_capture_commit) violation = race lost
    if (/UNIQUE/.test(e.message ?? "")) {
      await logIngestion(env, inscriptionId, "mint", network, "invalid", "race_lost", ipPrefix);
      return json({ ok: false, error: "commit_already_minted_race" }, { status: 422 });
    }
    await logIngestion(env, inscriptionId, "mint", network, "error", e.message, ipPrefix);
    return json({ ok: false, error: "db_error", reason: e.message }, { status: 500 });
  }

  return json({
    ok: true,
    status: "minted",
    kind: "mint",
    inscription_id: inscriptionId,
    ref_capture_commit: refCommitId,
    species_id: n.species_id,
    species_name: n.species_name,
    level: n.level,
    shiny: n.shiny,
    iv_total: n.iv_total,
    owner_check_skipped: Boolean(ownerCheck.skipped),
  });
}

// Off-chain reveal: the user publishes the IV+salt+ram_snapshot preimages
// directly to the indexer instead of inscribing a second ordinal. Security
// model: the capture's ivs_commitment + ram_snapshot_hash on-chain are the
// cryptographic anchor. Anyone can independently verify that these preimages
// match those commitments; the indexer just stores + serves them. A future
// on-chain op:"reveal" inscription would override (see COALESCE in
// applyRevealToCapture), so off-chain is strictly additive — no lock-in.
//
// DEPRECATED in v1.5: kept for legacy v1.4 testnet records. New mints use
// op:"mint" via POST /api/mints. The companion / game UI no longer
// exposes this endpoint.
async function handlePostRevealOffchain(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const captureId = typeof body?.capture_inscription_id === "string"
    ? body.capture_inscription_id.trim() : "";
  const network = typeof body?.network === "string" ? body.network.trim() : "";

  if (!INSCRIPTION_ID_RE.test(captureId)) {
    return json({ ok: false, error: "bad_capture_inscription_id" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  const ipPrefix = clientIpPrefix(request);
  const offchainId = `offchain:${captureId}`;

  const captureRow = await captureById(env, captureId);
  if (!captureRow) {
    await logIngestion(env, offchainId, "reveal", network, "invalid", "capture_not_registered", ipPrefix);
    return json(
      { ok: false, error: "capture_not_registered", reason: "register the capture inscription first" },
      { status: 422 },
    );
  }
  if (captureRow.reveal_inscription_id) {
    return json({
      ok: true,
      status: "already_revealed",
      transport: captureRow.reveal_inscription_id.startsWith("offchain:") ? "offchain" : "onchain",
      capture_inscription_id: captureId,
      reveal_inscription_id: captureRow.reveal_inscription_id,
    });
  }

  // Build a reveal-shaped record the existing validateReveal understands.
  // The ref + schema_version + p/op fields let us reuse the same commitment
  // verifier that on-chain reveals go through.
  const revealParsed = {
    p: "pokebells",
    op: "reveal",
    schema_version: "1.4",
    reveal_transport: "offchain",
    ref: captureId,
    ivs: body.ivs,
    ivs_salt_hex: typeof body.ivs_salt_hex === "string" ? body.ivs_salt_hex : "",
    ram_snapshot: typeof body.ram_snapshot === "string" ? body.ram_snapshot : "",
    shiny: Boolean(body.shiny),
    evs: body.evs ?? null,
  };

  const check = await validateReveal(revealParsed, captureRow, env);
  if (!check.ok) {
    await logIngestion(env, offchainId, "reveal", network, "invalid", `${check.stage}: ${check.reason}`, ipPrefix);
    return json(
      { ok: false, error: "reveal_invalid", stage: check.stage, reason: check.reason },
      { status: 422 },
    );
  }

  try {
    await insertReveal(env, offchainId, network, check.normalized, JSON.stringify(revealParsed));
    await applyRevealToCapture(env, offchainId, check.normalized);
    await logIngestion(env, offchainId, "reveal", network, "ok", "offchain", ipPrefix);
  } catch (e) {
    await logIngestion(env, offchainId, "reveal", network, "error", e.message, ipPrefix);
    return json({ ok: false, error: "db_error", reason: e.message }, { status: 500 });
  }

  return json({
    ok: true,
    status: "revealed",
    transport: "offchain",
    capture_inscription_id: captureId,
    reveal_inscription_id: offchainId,
    iv_total: check.normalized.iv_total,
    shiny: check.normalized.shiny,
  });
}

async function handlePostSave(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const inscriptionId = typeof body?.inscription_id === "string"
    ? body.inscription_id.trim() : "";
  const network = typeof body?.network === "string" ? body.network.trim() : "";

  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  const ipPrefix = clientIpPrefix(request);

  if (await saveExists(env, inscriptionId)) {
    await logIngestion(env, inscriptionId, "save", network, "duplicate", null, ipPrefix);
    return json({ ok: true, status: "duplicate", inscription_id: inscriptionId });
  }

  const fetched = await fetchAndValidateInscription(inscriptionId, network, env);
  if (!fetched.ok) {
    await logIngestion(env, inscriptionId, "save", network, "invalid", `${fetched.stage}: ${fetched.reason}`, ipPrefix);
    return json(
      { ok: false, error: "validation_failed", stage: fetched.stage, reason: fetched.reason },
      { status: 422 },
    );
  }
  if (fetched.kind !== "save-snapshot") {
    await logIngestion(env, inscriptionId, "save", network, "invalid", "wrong_op_expected_save_snapshot", ipPrefix);
    return json(
      { ok: false, error: "wrong_op", reason: `expected op:save-snapshot, got op:${fetched.parsed?.op}` },
      { status: 422 },
    );
  }

  const check = await validateSaveSnapshot(fetched.parsed, env);
  if (!check.ok) {
    await logIngestion(env, inscriptionId, "save", network, "invalid", `${check.stage}: ${check.reason}`, ipPrefix);
    return json(
      { ok: false, error: "save_invalid", stage: check.stage, reason: check.reason },
      { status: 422 },
    );
  }

  const n = check.normalized;
  if (n.network !== network) {
    await logIngestion(env, inscriptionId, "save", network, "invalid", "network_mismatch", ipPrefix);
    return json({ ok: false, error: "network_mismatch" }, { status: 422 });
  }

  // Monotonic save_version check: the inscribed save_version must be >
  // the latest seen for this wallet+rom+network. Rejects downgrade
  // attacks where someone re-inscribes an older version to roll back.
  const latest = await findLatestSaveVersion(env, n.signed_in_wallet, n.game_rom_sha256, n.network);
  if (n.save_version <= latest) {
    await logIngestion(env, inscriptionId, "save", network, "invalid",
      `stale_save_version ${n.save_version} <= ${latest}`, ipPrefix);
    return json(
      { ok: false, error: "stale_save_version", latest_known: latest },
      { status: 422 },
    );
  }

  try {
    await insertSave(env, inscriptionId, n, fetched.raw);
    await logIngestion(env, inscriptionId, "save", network, "ok", null, ipPrefix);
  } catch (e) {
    await logIngestion(env, inscriptionId, "save", network, "error", e.message, ipPrefix);
    return json({ ok: false, error: "db_error", reason: e.message }, { status: 500 });
  }

  return json({
    ok: true,
    status: "saved",
    kind: "save-snapshot",
    inscription_id: inscriptionId,
    wallet: n.signed_in_wallet,
    save_version: n.save_version,
  });
}

async function handleGetSave(env, url, pathWallet) {
  const wallet = decodeURIComponent(pathWallet);
  if (!wallet || wallet.length > 128) {
    return json({ ok: false, error: "bad_address" }, { status: 400 });
  }
  const romSha = url.searchParams.get("rom_sha");
  const network = url.searchParams.get("network");
  if (!/^[0-9a-f]{64}$/i.test(romSha ?? "")) {
    return json({ ok: false, error: "rom_sha required (64 hex)" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "network required" }, { status: 400 });
  }
  const save = await latestSaveByWallet(env, wallet, romSha.toLowerCase(), network);
  if (!save) return json({ ok: true, save: null });
  return json({ ok: true, save });
}

// v1.5 collection views read from the `pokemon` table (canonical NFT
// records produced by op:"mint"). The legacy `captures` table still
// exists for v1.3/v1.4 records but is no longer surfaced by these
// endpoints — the collection is op:"mint" only per SCHEMA-v1.5.md.

async function handleGetTrainer(env, url, pathOwner) {
  const owner = decodeURIComponent(pathOwner);
  if (!owner || owner.length > 128) {
    return json({ ok: false, error: "bad_address" }, { status: 400 });
  }
  const network = url.searchParams.get("network") ?? "bells-testnet";
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const rows = await pokemonByOwner(env, owner, network, limit, offset);
  const pokemon = rows.map((r) => ({
    ...r,
    moves: JSON.parse(r.moves_json ?? "[]"),
    pp: JSON.parse(r.pp_json ?? "[]"),
    attributes: JSON.parse(r.attributes_json ?? "[]"),
  }));
  return json({ ok: true, owner, network, count: pokemon.length, pokemon });
}

async function handleGetPokedex(env, url) {
  const speciesId = Number.parseInt(url.searchParams.get("species") ?? "", 10);
  if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > 251) {
    return json({ ok: false, error: "species query param required (1..251)" }, { status: 400 });
  }
  const network = url.searchParams.get("network") ?? "bells-testnet";
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const rows = await pokemonBySpecies(env, speciesId, network, limit, offset);
  const pokemon = rows.map((r) => ({
    ...r,
    moves: JSON.parse(r.moves_json ?? "[]"),
    pp: JSON.parse(r.pp_json ?? "[]"),
    attributes: JSON.parse(r.attributes_json ?? "[]"),
  }));
  return json({ ok: true, species_id: speciesId, network, count: pokemon.length, pokemon });
}

async function handleGetLeaderboard(env, url) {
  const by = url.searchParams.get("by") ?? "iv_total";
  const network = url.searchParams.get("network") ?? "bells-testnet";
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "25", 10);
  if (by === "iv_total") {
    const rows = await env.DB.prepare(`
      SELECT mint_inscription_id, signed_in_wallet, species_id, species_name,
             level, shiny, iv_total, registered_at
      FROM pokemon
      WHERE network = ?
      ORDER BY iv_total DESC, registered_at ASC
      LIMIT ?
    `).bind(network, limit).all();
    return json({ ok: true, by, network, rows: rows?.results ?? [] });
  }
  if (by === "count") {
    const rows = await env.DB.prepare(`
      SELECT signed_in_wallet, COUNT(*) AS pokemon_count,
             SUM(CASE WHEN shiny = 1 THEN 1 ELSE 0 END) AS shinies
      FROM pokemon
      WHERE network = ?
      GROUP BY signed_in_wallet
      ORDER BY pokemon_count DESC, shinies DESC
      LIMIT ?
    `).bind(network, limit).all();
    return json({ ok: true, by, network, rows: rows?.results ?? [] });
  }
  return json({ ok: false, error: "unknown_metric", allowed: ["iv_total", "count"] }, { status: 400 });
}

async function handleGetCapture(env, pathId) {
  const inscriptionId = decodeURIComponent(pathId);
  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  // Legacy v1.3/v1.4 lookup. v1.5 uses GET /api/pokemon/:id which reads
  // the canonical pokemon row + parses JSON fields.
  const row = await captureById(env, inscriptionId);
  if (!row) return json({ ok: false, error: "not_found" }, { status: 404 });
  return json({ ok: true, capture: row });
}

async function handleGetStats(env) {
  // v1.5 stats read pokemon (the canonical collection). Legacy captures
  // table still has its own networkStats() helper but is not exposed here.
  const row = await env.DB.prepare(`
    SELECT
      COUNT(*)                                                        AS total_pokemon,
      COALESCE(SUM(CASE WHEN network='bells-mainnet' THEN 1 ELSE 0 END), 0) AS mainnet,
      COALESCE(SUM(CASE WHEN network='bells-testnet' THEN 1 ELSE 0 END), 0) AS testnet,
      COALESCE(SUM(CASE WHEN shiny = 1 THEN 1 ELSE 0 END), 0)         AS shinies,
      COUNT(DISTINCT signed_in_wallet)                                AS unique_trainers,
      COUNT(DISTINCT species_id)                                      AS unique_species
    FROM pokemon
  `).first();
  const commits = await env.DB.prepare(`
    SELECT COUNT(*) AS total_commits FROM commits WHERE valid = 1
  `).first();
  return json({
    ok: true,
    stats: {
      ...(row ?? {}),
      total_commits: commits?.total_commits ?? 0,
      schema_version: "1.5",
    },
  });
}

// =====================================================================
// Phase B routes — collection root + op:"collection_update"
// =====================================================================
// See game/ROOT-APP-DESIGN.md. Ingestion strict: validateCollection()
// without allowPlaceholders, validateCollectionUpdate schema check,
// strict parsed.network === routeNetwork, sequential update_sequence,
// sat-spend-v1 authority check via electrs. Any failure goes to
// rejected_updates (audit trail, never crashes the worker).

async function fetchInscriptionContent(env, inscriptionId, network) {
  const base = network === "bells-mainnet"
    ? env.CONTENT_BASE_MAINNET
    : env.CONTENT_BASE_TESTNET;
  if (!base) {
    // Deployment / config bug — not a transient blip. Caller treats as
    // permanent so it gets audited + returned to the operator instead
    // of silently queued for retries that will all fail the same way.
    const err = new Error(`CONTENT_BASE_${network === "bells-mainnet" ? "MAINNET" : "TESTNET"} unset`);
    err.permanent = true;
    throw err;
  }
  const url = `${base}${encodeURIComponent(inscriptionId)}`;
  const resp = await fetch(url, { cf: { cacheTtl: 60 } });
  if (!resp.ok) {
    // 404 is the canonical "content host lag" case; 5xx / 429 are
    // retryable infra blips. All HTTP errors are transient — bounded
    // retry via INGESTION_QUEUE_MAX_ATTEMPTS covers the "truly gone"
    // inscription case without polluting rejected_updates.
    const err = new Error(`content_host_${resp.status}`);
    err.httpStatus = resp.status;
    throw err;
  }
  const raw = await resp.text();
  try {
    const parsed = JSON.parse(raw);
    return { raw, parsed };
  } catch (e) {
    // Inscription bytes are immutable — bad JSON now means bad JSON
    // forever. Permanent failure; audit + drop.
    const err = new Error(`content_not_json: ${e.message}`);
    err.permanent = true;
    throw err;
  }
}

// Shared validation + write pipeline for a fetched collection body.
// Called by the POST handler (synchronous ingest) AND by
// processQueueEntry (async drain after a 404 retry). Returns a
// discriminated result so the caller can emit the right HTTP status
// or queue action. `transient: true` ⇒ retry; `transient: false` ⇒
// permanent deterministic failure (log invalid; no rejected_updates
// table exists for collection roots, so just drop from the queue).
async function applyCollectionIngestion(env, inscriptionId, network, raw, parsed) {
  const validation = validateCollection(parsed);
  if (!validation.ok) {
    return {
      ok: false, stage: validation.stage, reason: validation.reason,
      transient: false,
    };
  }
  if (!validation.normalized.networks.includes(network)) {
    return {
      ok: false, stage: "schema",
      reason: `body.networks=${JSON.stringify(validation.normalized.networks)} does not include route network "${network}"`,
      transient: false,
    };
  }
  const initialRevealTxid = inscriptionId.replace(/i\d+$/i, "");
  try {
    await registerCollectionRoot(env, {
      inscriptionId, network,
      bodyJson: raw,
      initialRevealTxid,
    });
  } catch (e) {
    return {
      ok: false, stage: "db", reason: `db_register:${e.message}`,
      transient: true,
    };
  }
  return { ok: true, initialRevealTxid };
}

async function handlePostCollection(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const inscriptionId = typeof body?.inscription_id === "string"
    ? body.inscription_id.trim() : "";
  const network = typeof body?.network === "string" ? body.network.trim() : "";

  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  const ipPrefix = clientIpPrefix(request);

  // Fetch inscription body from content host.
  let raw, parsed;
  try {
    ({ raw, parsed } = await fetchInscriptionContent(env, inscriptionId, network));
  } catch (e) {
    if (!e.permanent) {
      // Transient (404, 5xx, DNS, timeout). Enqueue; the cron drain
      // retries up to INGESTION_QUEUE_MAX_ATTEMPTS with backoff.
      await enqueueForIngestion(env, inscriptionId, "collection", network, {
        lastError: e.message,
      });
      await logIngestion(env, inscriptionId, "collection", network, "queued", e.message, ipPrefix);
      return json(
        { ok: true, status: "queued", reason: `transient fetch failure, queued: ${e.message}` },
        { status: 202 },
      );
    }
    // Permanent fetch failure (non-JSON body, or CONTENT_BASE_* unset).
    await logIngestion(env, inscriptionId, "collection", network, "invalid", e.message, ipPrefix);
    return json(
      { ok: false, error: "fetch_failed", reason: e.message },
      { status: 422 },
    );
  }

  const ingest = await applyCollectionIngestion(env, inscriptionId, network, raw, parsed);
  if (!ingest.ok) {
    if (ingest.transient) {
      // DB hiccup or similar — enqueue so the cron drain retries.
      await enqueueForIngestion(env, inscriptionId, "collection", network, {
        lastError: ingest.reason,
      });
      await logIngestion(env, inscriptionId, "collection", network, "queued", ingest.reason, ipPrefix);
      return json(
        { ok: true, status: "queued", reason: `transient failure, queued: ${ingest.reason}` },
        { status: 202 },
      );
    }
    await logIngestion(
      env, inscriptionId, "collection", network, "invalid",
      `${ingest.stage}:${ingest.reason}`, ipPrefix,
    );
    return json(
      { ok: false, error: "validation_failed", stage: ingest.stage, reason: ingest.reason },
      { status: 422 },
    );
  }

  await logIngestion(env, inscriptionId, "collection", network, "registered", null, ipPrefix);
  return json({
    ok: true,
    status: "registered",
    inscription_id: inscriptionId,
    network,
    initial_reveal_txid: ingest.initialRevealTxid,
  });
}

// Shared validation + authority + insert pipeline for a fetched
// collection_update body. Returns a discriminated result so callers
// can map to HTTP or queue actions. The caller (handler or drain) is
// responsible for:
//   - writing rejected_updates when the failure is PERMANENT
//     (transient:false)
//   - requeueing when the failure is TRANSIENT (transient:true)
// Keeping that policy in the caller prevents stale rejected_updates
// rows for retryable scenarios like "root not yet registered" or
// "electrs blip".
async function applyCollectionUpdateIngestion(env, inscriptionId, routeNetwork, raw, parsed) {
  function fail(reason, collectionId, transient) {
    return {
      ok: false, reason,
      collectionInscriptionId: collectionId ?? null,
      transient: Boolean(transient),
    };
  }

  const validation = validateCollectionUpdate(parsed);
  if (!validation.ok) {
    // Schema is deterministic — inscription bytes are immutable.
    return fail(
      `${validation.stage}:${validation.reason}`,
      parsed?.collection_inscription_id ?? null,
      /*transient*/ false,
    );
  }
  const normalized = validation.normalized;

  if (normalized.network !== routeNetwork) {
    return fail(
      `network_mismatch:body=${normalized.network},route=${routeNetwork}`,
      normalized.collection_inscription_id,
      /*transient*/ false,
    );
  }

  const satpoint = await currentCollectionSatpoint(
    env,
    normalized.collection_inscription_id,
    routeNetwork,
  );
  if (!satpoint) {
    // Retryable: the root may register later in a follow-up POST
    // /api/collections. The drain keeps retrying until max attempts
    // (then abandons). No rejected_updates row — the update isn't
    // really "rejected", it's just early.
    return fail(
      "collection_not_registered",
      normalized.collection_inscription_id,
      /*transient*/ true,
    );
  }

  const expectedSequence = satpoint.lastSequence + 1;
  if (normalized.update_sequence !== expectedSequence) {
    // Chain ordering is fixed — a sequence gap on the inscription
    // cannot fix itself. Permanent.
    return fail(
      `sequence_not_sequential:got=${normalized.update_sequence},expected=${expectedSequence}`,
      normalized.collection_inscription_id,
      /*transient*/ false,
    );
  }

  const auth = await verifyCollectionUpdateAuthority({
    updateInscriptionId: inscriptionId,
    expectedSatpoint: { revealTxid: satpoint.revealTxid, vout: satpoint.vout },
    env,
    network: routeNetwork,
  });
  if (!auth.ok) {
    // authReject propagates transient:true on electrs fetch blips,
    // transient:false on deterministic vin/vout mismatches.
    return fail(
      `${auth.stage}:${auth.reason}`,
      normalized.collection_inscription_id,
      /*transient*/ auth.transient === true,
    );
  }

  try {
    await insertAcceptedCollectionUpdate(env, {
      inscriptionId,
      collectionInscriptionId: normalized.collection_inscription_id,
      network: routeNetwork,
      updateSequence: normalized.update_sequence,
      setJson: JSON.stringify(normalized.set),
      commitTxid: auth.commit_txid,
      revealTxid: auth.reveal_txid,
    });
  } catch (e) {
    // DB errors: UNIQUE violations mean "already accepted by another
    // path" and the drain's pre-check should short-circuit on the
    // next pass. Any other D1 error is likely transient (timeout,
    // cold start). Mark transient so the queue retries.
    return fail(
      `db_insert:${e.message}`,
      normalized.collection_inscription_id,
      /*transient*/ true,
    );
  }

  return {
    ok: true,
    collectionInscriptionId: normalized.collection_inscription_id,
    updateSequence: normalized.update_sequence,
    commitTxid: auth.commit_txid,
    revealTxid: auth.reveal_txid,
    authoritySkipped: auth.skipped === true,
  };
}

async function handlePostCollectionUpdate(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const inscriptionId = typeof body?.inscription_id === "string"
    ? body.inscription_id.trim() : "";
  const routeNetwork = typeof body?.network === "string" ? body.network.trim() : "";

  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  if (routeNetwork !== "bells-mainnet" && routeNetwork !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  const ipPrefix = clientIpPrefix(request);

  let raw, parsed;
  try {
    ({ raw, parsed } = await fetchInscriptionContent(env, inscriptionId, routeNetwork));
  } catch (e) {
    if (!e.permanent) {
      // Transient (404, 5xx, DNS, timeout) — queue + 202.
      await enqueueForIngestion(env, inscriptionId, "collection_update", routeNetwork, {
        lastError: e.message,
      });
      await logIngestion(env, inscriptionId, "collection_update", routeNetwork, "queued", e.message, ipPrefix);
      return json(
        { ok: true, status: "queued", reason: `transient fetch failure, queued: ${e.message}` },
        { status: 202 },
      );
    }
    // Permanent (non-JSON body or CONTENT_BASE_* unset). Audit with
    // null collection_inscription_id since we have no parsed body.
    await recordRejectedUpdate(env, {
      inscriptionId,
      collectionInscriptionId: null,
      network: routeNetwork,
      reason: `fetch:${e.message}`,
      rawBodyJson: null,
    });
    await logIngestion(env, inscriptionId, "collection_update", routeNetwork, "invalid", e.message, ipPrefix);
    return json(
      { ok: false, error: "fetch_failed", reason: e.message },
      { status: 422 },
    );
  }

  const ingest = await applyCollectionUpdateIngestion(env, inscriptionId, routeNetwork, raw, parsed);
  if (!ingest.ok) {
    if (ingest.transient) {
      // Transient (electrs blip, DB hiccup, root not yet registered) —
      // enqueue so the cron drain retries. Do NOT write rejected_updates;
      // the update isn't really rejected, just deferred.
      await enqueueForIngestion(env, inscriptionId, "collection_update", routeNetwork, {
        lastError: ingest.reason,
      });
      await logIngestion(env, inscriptionId, "collection_update", routeNetwork, "queued", ingest.reason, ipPrefix);
      return json(
        { ok: true, status: "queued", reason: `transient failure, queued: ${ingest.reason}` },
        { status: 202 },
      );
    }
    // Permanent (schema / network / sequence / authority mismatch) —
    // audit trail + 422.
    await recordRejectedUpdate(env, {
      inscriptionId,
      collectionInscriptionId: ingest.collectionInscriptionId,
      network: routeNetwork,
      reason: ingest.reason,
      rawBodyJson: raw,
    });
    await logIngestion(env, inscriptionId, "collection_update", routeNetwork, "invalid", ingest.reason, ipPrefix);
    return json(
      { ok: false, error: "update_rejected", reason: ingest.reason },
      { status: 422 },
    );
  }

  await logIngestion(env, inscriptionId, "collection_update", routeNetwork, "accepted", null, ipPrefix);
  return json({
    ok: true,
    status: "accepted",
    inscription_id: inscriptionId,
    update_sequence: ingest.updateSequence,
    commit_txid: ingest.commitTxid,
    reveal_txid: ingest.revealTxid,
    authority_skipped: ingest.authoritySkipped,
  });
}

async function handleGetCollectionLatest(env, url) {
  const collectionId = (url.searchParams.get("id") ?? "").trim();
  const network = (url.searchParams.get("network") ?? "").trim();

  if (!INSCRIPTION_ID_RE.test(collectionId)) {
    return json({ ok: false, error: "bad_id" }, { status: 400 });
  }
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return json({ ok: false, error: "bad_network" }, { status: 400 });
  }

  let agg;
  try { agg = await aggregatedCollectionLatest(env, collectionId, network); }
  catch (e) {
    return json(
      { ok: false, error: "aggregate_failed", reason: e.message },
      { status: 500 },
    );
  }
  if (!agg) {
    return json(
      { ok: false, error: "not_found", reason: "collection root not registered for this network" },
      { status: 404 },
    );
  }

  return json({ ok: true, ...agg });
}

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "pokebells-indexer", version: "v1.5" });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      return handleGetStats(env);
    }

    if (url.pathname === "/api/captures" && request.method === "POST") {
      return handlePostCapture(request, env);
    }
    if (url.pathname === "/api/mints" && request.method === "POST") {
      return handlePostMint(request, env);
    }
    if (url.pathname === "/api/reveals" && request.method === "POST") {
      return handlePostReveal(request, env);
    }
    if (url.pathname === "/api/reveals/offchain" && request.method === "POST") {
      return handlePostRevealOffchain(request, env);
    }
    if (url.pathname === "/api/saves" && request.method === "POST") {
      return handlePostSave(request, env);
    }
    if (url.pathname === "/api/collections" && request.method === "POST") {
      return handlePostCollection(request, env);
    }
    if (url.pathname === "/api/collection-updates" && request.method === "POST") {
      return handlePostCollectionUpdate(request, env);
    }
    if (url.pathname === "/api/collection/latest" && request.method === "GET") {
      return handleGetCollectionLatest(env, url);
    }

    if (request.method === "GET") {
      const trainerMatch = url.pathname.match(/^\/api\/trainer\/([^/]+)\/?$/);
      if (trainerMatch) return handleGetTrainer(env, url, trainerMatch[1]);

      if (url.pathname === "/api/pokedex") return handleGetPokedex(env, url);

      if (url.pathname === "/api/leaderboard") return handleGetLeaderboard(env, url);

      const saveMatch = url.pathname.match(/^\/api\/saves\/([^/]+)\/?$/);
      if (saveMatch) return handleGetSave(env, url, saveMatch[1]);

      const captureMatch = url.pathname.match(/^\/api\/captures\/([^/]+)\/?$/);
      if (captureMatch) return handleGetCapture(env, captureMatch[1]);

      // v1.5 canonical NFT lookup. Returns the pokemon row whose
      // mint_inscription_id matches the path, or 404 if no canonical
      // mint has been registered for that id yet.
      const pokemonMatch = url.pathname.match(/^\/api\/pokemon\/([^/]+)\/?$/);
      if (pokemonMatch) {
        const id = pokemonMatch[1];
        const row = await env.DB.prepare(
          "SELECT * FROM pokemon WHERE mint_inscription_id = ? LIMIT 1"
        ).bind(id).first();
        if (!row) return json({ ok: false, error: "not_found" }, { status: 404 });
        return json({
          ok: true,
          ...row,
          moves: JSON.parse(row.moves_json ?? "[]"),
          pp: JSON.parse(row.pp_json ?? "[]"),
          attributes: JSON.parse(row.attributes_json ?? "[]"),
        });
      }

      // Debug endpoint. Every section is wrapped in try/catch so a
      // single broken query surfaces as a per-section error string
      // instead of a global CF Worker 1101.
      if (url.pathname === "/api/debug") {
        async function tryQuery(label, fn) {
          try { return await fn(); }
          catch (e) { return { __error: `${label}: ${e?.message ?? e}` }; }
        }
        const counts = {};
        for (const t of ["captures", "commits", "pokemon", "reveals", "ingestion_queue", "ingestion_log"]) {
          counts[t] = await tryQuery(t, async () => {
            const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first();
            return row?.n ?? 0;
          });
        }
        const recentLog = await tryQuery("recent_log", async () => {
          const r = await env.DB.prepare(
            "SELECT inscription_id, kind, network, result, reject_reason, ingested_at FROM ingestion_log ORDER BY ingested_at DESC LIMIT 30"
          ).all();
          return r?.results ?? [];
        });
        const queue = await tryQuery("queue", async () => {
          const r = await env.DB.prepare(
            "SELECT inscription_id, kind, network, attempts, retry_after, last_error FROM ingestion_queue ORDER BY retry_after ASC LIMIT 20"
          ).all();
          return r?.results ?? [];
        });
        const recentCommits = await tryQuery("recent_commits", async () => {
          const r = await env.DB.prepare(
            "SELECT inscription_id, signed_in_wallet, network, registered_at FROM commits ORDER BY registered_at DESC LIMIT 10"
          ).all();
          return r?.results ?? [];
        });
        const recentPokemon = await tryQuery("recent_pokemon", async () => {
          // is_starter is best-effort — old databases without the column
          // fall back to SELECT * and the caller can filter.
          const r = await env.DB.prepare(
            "SELECT * FROM pokemon ORDER BY registered_at DESC LIMIT 10"
          ).all();
          return (r?.results ?? []).map((row) => ({
            mint_inscription_id: row.mint_inscription_id,
            ref_capture_commit: row.ref_capture_commit,
            signed_in_wallet: row.signed_in_wallet,
            species_name: row.species_name,
            level: row.level,
            is_starter: row.is_starter ?? null,
            registered_at: row.registered_at,
          }));
        });
        return json({
          ok: true,
          counts,
          recent_log: recentLog,
          queue,
          recent_commits: recentCommits,
          recent_pokemon: recentPokemon,
        });
      }
    }

    return json({ ok: false, error: "not_found", path: url.pathname }, { status: 404 });
  },

  // Cron-triggered entry point. See wrangler.toml [triggers] for cadence.
  // Two jobs run in parallel via waitUntil:
  //   1. drainIngestionQueue — replay POSTs that hit a 404 on first try
  //      (Nintondo content host lag after block confirmation).
  //   2. scanChainForPokebells — niveau 2. Enumerate `p:pokebells`
  //      inscriptions directly from the chain so mints done outside our
  //      companion still land in the collection.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(drainIngestionQueue(env).catch((e) => {
      console.error("[cron] drainIngestionQueue failed:", e?.message ?? e);
    }));
    ctx.waitUntil(scanChainForPokebells(env).catch((e) => {
      console.error("[cron] scanChainForPokebells failed:", e?.message ?? e);
    }));
  },
};

// ======================================================================
// Niveau 1 — async retry queue drain
// ======================================================================

async function drainIngestionQueue(env) {
  const due = await claimDueQueueEntries(env, 25);
  if (!due.length) return { drained: 0 };

  let ok = 0, requeued = 0, dropped = 0;
  for (const entry of due) {
    const outcome = await processQueueEntry(env, entry);
    if (outcome === "ok") ok++;
    else if (outcome === "dropped") dropped++;
    else requeued++;
  }
  return { drained: due.length, ok, requeued, dropped };
}

// Re-runs the same pipeline the POST handler would. On success, removes
// from the queue. On retryable failure (content still 404), bumps
// retry_after. On permanent failure (validator hard-fail, schema
// rejection) or exhausted attempts, drops + logs.
async function processQueueEntry(env, entry) {
  const { inscription_id: id, kind, network, attempts } = entry;

  if (attempts >= INGESTION_QUEUE_MAX_ATTEMPTS) {
    await dequeueIngestion(env, id, kind);
    await logIngestion(env, id, kind, network, "queue_abandoned",
      `attempts=${attempts} ${entry.last_error ?? ""}`, null);
    return "dropped";
  }

  // Short-circuit if something else (manual POST from companion) already
  // registered this id between enqueue and now.
  if (kind === "capture" && await captureExists(env, id)) {
    await dequeueIngestion(env, id, kind); return "ok";
  }
  if (kind === "capture_commit" && await commitExists(env, id)) {
    await dequeueIngestion(env, id, kind); return "ok";
  }
  if (kind === "reveal" && await revealExists(env, id)) {
    await dequeueIngestion(env, id, kind); return "ok";
  }
  if (kind === "mint" && await pokemonExists(env, id)) {
    await dequeueIngestion(env, id, kind); return "ok";
  }
  // Phase B queue kinds — dedicated drain paths. fetchAndValidateInscription
  // does not know about collection / collection_update, so we fetch +
  // validate directly via the shared apply* helpers that the POST
  // handlers also use.
  if (kind === "collection") {
    return await drainCollectionQueueEntry(env, entry);
  }
  if (kind === "collection_update") {
    return await drainCollectionUpdateQueueEntry(env, entry);
  }

  // Re-run the validator. If content is still 404, bump the retry
  // counter. Otherwise drop (permanent fail) or process.
  const result = await fetchAndValidateInscription(id, network, env);
  if (!result.ok) {
    const stillFetchFailure = result.stage === "fetch";
    if (stillFetchFailure) {
      await bumpIngestionRetry(env, id, kind,
        nextQueueRetrySeconds(attempts + 1), result.reason);
      return "requeued";
    }
    await dequeueIngestion(env, id, kind);
    await logIngestion(env, id, kind, network, "invalid_via_queue",
      `${result.stage}: ${result.reason}`, null);
    return "dropped";
  }

  // Content fetched + validated. Route by actual op (may differ from
  // originally enqueued kind if the chain state has since evolved).
  try {
    if (result.kind === "capture_commit") {
      const cn = result.normalized;
      cn.inscription_id = id;
      await insertCommit(env, id, cn, result.raw);
    } else if (result.kind === "capture") {
      const n = result.normalized;
      const contentConflict = await findContentSha256Conflict(env, n.capture_content_sha256, id);
      if (contentConflict) {
        await dequeueIngestion(env, id, kind);
        await logIngestion(env, id, kind, network, "invalid_via_queue",
          `content_duplicate of ${contentConflict}`, null);
        return "dropped";
      }
      const snapshotConflict = await findRamSnapshotHashConflict(env, n.ram_snapshot_hash, id);
      if (snapshotConflict) {
        await dequeueIngestion(env, id, kind);
        await logIngestion(env, id, kind, network, "invalid_via_queue",
          `snapshot_replay of ${snapshotConflict}`, null);
        return "dropped";
      }
      await insertCapture(env, id, n.signed_in_wallet, n, result.raw);
    } else if (result.kind === "mint") {
      // v1.5 mint: match the direct POST path for queued/manual mints.
      const mintParsed = result.parsed;
      const refCommitId = typeof mintParsed?.ref_capture_commit === "string"
        ? mintParsed.ref_capture_commit.trim()
        : "";
      if (!INSCRIPTION_ID_RE.test(refCommitId)) {
        await dequeueIngestion(env, id, kind);
        await logIngestion(env, id, kind, network, "invalid_via_queue",
          "bad_ref_capture_commit", null);
        return "dropped";
      }
      const commitRow = await commitById(env, refCommitId);
      if (!commitRow) {
        // Commit hasn't landed yet — keep waiting.
        await bumpIngestionRetry(env, id, kind,
          nextQueueRetrySeconds(attempts + 1), "commit_not_yet_indexed");
        return "requeued";
      }
      if (commitRow.network !== network) {
        await dequeueIngestion(env, id, kind);
        await logIngestion(env, id, kind, network, "invalid_via_queue",
          "network_mismatch_with_commit", null);
        return "dropped";
      }
      const existingPokemon = await pokemonByCommit(env, refCommitId);
      if (existingPokemon) {
        await dequeueIngestion(env, id, kind);
        await logIngestion(env, id, kind, network, "invalid_via_queue",
          `commit_already_minted_by_${existingPokemon.mint_inscription_id}`, null);
        return "dropped";
      }
      const check = await validateMintV1_5(mintParsed, commitRow, env);
      if (!check.ok) {
        await dequeueIngestion(env, id, kind);
        await logIngestion(env, id, kind, network, "invalid_via_queue",
          `${check.stage}: ${check.reason}`, null);
        return "dropped";
      }
      const ownerCheck = await verifyMintOwner(id, mintParsed.signed_in_wallet, env, network);
      if (!ownerCheck.ok) {
        await dequeueIngestion(env, id, kind);
        await logIngestion(env, id, kind, network, "invalid_via_queue",
          `owner_mismatch: ${ownerCheck.reason}`, null);
        return "dropped";
      }
      const n = check.normalized;
      n.mint_inscription_id = id;
      await insertPokemon(env, id, n, result.raw);
    } else if (result.kind === "reveal") {
      // Reveal: apply to existing capture row.
      await insertReveal(env, id, network, result.normalized, result.raw);
      await applyRevealToCapture(env, id, result.normalized);
    }
    await dequeueIngestion(env, id, kind);
    await logIngestion(env, id, kind, network, "ok_via_queue", null, null);
    return "ok";
  } catch (e) {
    // DB error (or unexpected) — requeue with retry.
    await bumpIngestionRetry(env, id, kind,
      nextQueueRetrySeconds(attempts + 1), e?.message ?? String(e));
    return "requeued";
  }
}

// =====================================================================
// Phase B queue drain — collection + collection_update
// =====================================================================
// Short-circuits: if the row is already present in collections /
// collection_updates, dequeue immediately (another path registered it).
// Otherwise: fetch body, run the shared apply* helper, requeue on
// still-fetching 404, dequeue on success or permanent validation fail.

export async function drainCollectionQueueEntry(env, entry) {
  const { inscription_id: id, network, attempts } = entry;
  if (await getCollectionRoot(env, id, network)) {
    await dequeueIngestion(env, id, "collection");
    return "ok";
  }
  let raw, parsed;
  try {
    ({ raw, parsed } = await fetchInscriptionContent(env, id, network));
  } catch (e) {
    if (!e.permanent) {
      // Transient (404, 5xx, DNS, timeout). Bounded-retry via
      // INGESTION_QUEUE_MAX_ATTEMPTS eventually abandons truly-gone
      // inscriptions.
      await bumpIngestionRetry(env, id, "collection",
        nextQueueRetrySeconds(attempts + 1), e.message);
      return "requeued";
    }
    // Permanent: non-JSON body or config bug. No rejected_updates
    // table for collections, just drop + log.
    await dequeueIngestion(env, id, "collection");
    await logIngestion(env, id, "collection", network, "invalid_via_queue",
      `fetch:${e.message}`, null);
    return "dropped";
  }
  const ingest = await applyCollectionIngestion(env, id, network, raw, parsed);
  if (!ingest.ok) {
    if (ingest.transient) {
      await bumpIngestionRetry(env, id, "collection",
        nextQueueRetrySeconds(attempts + 1), ingest.reason);
      return "requeued";
    }
    // Permanent: no rejected_updates table for collection roots, just
    // drop + log. The ingestion_log tells the operator why.
    await dequeueIngestion(env, id, "collection");
    await logIngestion(env, id, "collection", network, "invalid_via_queue",
      `${ingest.stage}:${ingest.reason}`, null);
    return "dropped";
  }
  await dequeueIngestion(env, id, "collection");
  await logIngestion(env, id, "collection", network, "ok_via_queue", null, null);
  return "ok";
}

export async function drainCollectionUpdateQueueEntry(env, entry) {
  const { inscription_id: id, network, attempts } = entry;
  // Short-circuit if the update has already been accepted via another
  // path. Check collection_updates directly; a row there means we're
  // done regardless of what other paths did.
  const existing = await env.DB.prepare(
    "SELECT 1 FROM collection_updates WHERE inscription_id = ? AND network = ? LIMIT 1",
  ).bind(id, network).first();
  if (existing) {
    await dequeueIngestion(env, id, "collection_update");
    return "ok";
  }

  let raw, parsed;
  try {
    ({ raw, parsed } = await fetchInscriptionContent(env, id, network));
  } catch (e) {
    if (!e.permanent) {
      // Transient (404, 5xx, DNS, timeout). Bounded-retry via
      // INGESTION_QUEUE_MAX_ATTEMPTS eventually abandons truly-gone
      // inscriptions.
      await bumpIngestionRetry(env, id, "collection_update",
        nextQueueRetrySeconds(attempts + 1), e.message);
      return "requeued";
    }
    // Permanent fetch failure (non-JSON content, config bug). Audit +
    // drop — the inscription is deterministically invalid, no retry
    // will help.
    await recordRejectedUpdate(env, {
      inscriptionId: id,
      collectionInscriptionId: null,
      network,
      reason: `fetch_via_queue:${e.message}`,
      rawBodyJson: null,
    });
    await dequeueIngestion(env, id, "collection_update");
    await logIngestion(env, id, "collection_update", network, "invalid_via_queue",
      `fetch:${e.message}`, null);
    return "dropped";
  }

  const ingest = await applyCollectionUpdateIngestion(env, id, network, raw, parsed);
  if (!ingest.ok) {
    if (ingest.transient) {
      // collection_not_registered (root will arrive), electrs blip,
      // DB hiccup — retry. Never writes rejected_updates for these.
      await bumpIngestionRetry(env, id, "collection_update",
        nextQueueRetrySeconds(attempts + 1), ingest.reason);
      return "requeued";
    }
    // Permanent: audit + dequeue.
    await recordRejectedUpdate(env, {
      inscriptionId: id,
      collectionInscriptionId: ingest.collectionInscriptionId,
      network,
      reason: ingest.reason,
      rawBodyJson: raw,
    });
    await dequeueIngestion(env, id, "collection_update");
    await logIngestion(env, id, "collection_update", network, "invalid_via_queue",
      ingest.reason, null);
    return "dropped";
  }
  await dequeueIngestion(env, id, "collection_update");
  await logIngestion(env, id, "collection_update", network, "ok_via_queue", null, null);
  return "ok";
}

// ======================================================================
// Niveau 2 — autonomous chain scan for `p:pokebells` inscriptions
// ======================================================================
//
// Goal: pick up mints, commits, reveals, evolves that were inscribed
// outside our companion (e.g. via a third-party wallet or explorer) so
// the indexer stays the source of truth for the collection.
//
// Strategy: poll Nintondo's ord HTTP API (`GET /inscriptions`, paginated).
// For each returned id, fetch the content, check `p === "pokebells"`,
// then dispatch to the matching POST handler logic (validate +
// persist). Track progress with `scan_cursor` so we don't re-ingest
// everything every tick.
//
// Current status (2026-04-23): `ord.nintondo.io` and
// `ord-testnet.nintondo.io` both return 502 / fail DNS. The
// enumeration API is the only missing piece; `/content/<id>` fetch
// already works. When Nintondo fixes ord hosting (or we self-host
// Nintondo/ord), this function will start succeeding without code
// changes. Until then it is a graceful no-op that logs the probe
// failure every cron tick — no duplicate work, no noise in D1.
//
// ORD_BASE env override lets operators point at a self-hosted
// `Nintondo/ord` instance to enable full chain scan immediately.

function ordBaseFor(env, network) {
  if (network === "bells-mainnet") return env.ORD_BASE_MAINNET || "https://ord.nintondo.io";
  if (network === "bells-testnet") return env.ORD_BASE_TESTNET || "https://ord-testnet.nintondo.io";
  return null;
}

async function scanChainForPokebells(env) {
  const out = { mainnet: null, testnet: null };
  out.mainnet = await scanNetwork(env, "bells-mainnet").catch((e) => ({ ok: false, reason: e?.message ?? String(e) }));
  out.testnet = await scanNetwork(env, "bells-testnet").catch((e) => ({ ok: false, reason: e?.message ?? String(e) }));
  return out;
}

async function scanNetwork(env, network) {
  const ordBase = ordBaseFor(env, network);
  if (!ordBase) return { ok: false, reason: "no_ord_base" };

  // Probe /blockheight first — cheap, diagnostic, avoids long cursor
  // walks when ord is down.
  const probe = await fetch(`${ordBase}/blockheight`, {
    headers: { accept: "text/plain" },
    signal: AbortSignal.timeout(5000),
  }).catch((e) => ({ status: 0, _err: e?.message }));
  if (!probe || probe.status !== 200) {
    return {
      ok: false,
      network,
      reason: `ord_probe_failed status=${probe?.status ?? 0} err=${probe?._err ?? ""}`,
    };
  }

  const cursor = await readScanCursor(env, network, "pokebells");
  const lastSeenId = cursor?.cursor_value ?? null;

  // Fetch page 0 (most recent 100). Stop early if we hit lastSeenId.
  const listResp = await fetch(`${ordBase}/inscriptions`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  }).catch((e) => ({ status: 0, _err: e?.message }));
  if (!listResp || listResp.status !== 200) {
    return {
      ok: false,
      network,
      reason: `ord_list_failed status=${listResp?.status ?? 0} err=${listResp?._err ?? ""}`,
    };
  }

  const listBody = await listResp.json().catch(() => null);
  const ids = Array.isArray(listBody?.ids) ? listBody.ids : [];
  if (!ids.length) {
    await writeScanCursor(env, network, "pokebells", lastSeenId ?? "", 0);
    return { ok: true, network, found: 0, newest: null };
  }

  let found = 0;
  let newestThisPage = ids[0];
  for (const id of ids) {
    if (lastSeenId && id === lastSeenId) break;  // caught up
    if (!INSCRIPTION_ID_RE.test(id)) continue;

    // Skip if already in any table.
    if (
      await captureExists(env, id) ||
      await commitExists(env, id) ||
      await revealExists(env, id) ||
      await pokemonExists(env, id)
    ) continue;

    // Lightweight content probe — fetch + op check. If op matches one
    // of ours, delegate to the same validated path the POST handlers
    // use (via enqueue — keeps a single code path + respects
    // eventually-consistent content host).
    const contentBase = network === "bells-mainnet"
      ? env.CONTENT_BASE_MAINNET : env.CONTENT_BASE_TESTNET;
    const cr = await fetch(`${contentBase}${id}`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!cr || cr.status !== 200) continue;
    const ct = cr.headers.get("content-type") ?? "";
    if (!/application\/json|text\/plain/i.test(ct)) continue;

    const body = await cr.json().catch(() => null);
    if (!body || body.p !== "pokebells") continue;

    const op = body.op;
    let kind = null;
    if (op === "capture_commit") kind = "capture_commit";
    else if (op === "mint") kind = "mint";
    else if (op === "reveal") kind = "reveal";
    else if (op === "capture" || op === "catch") kind = "capture";
    if (!kind) continue;

    await enqueueForIngestion(env, id, kind, network, { retryAfter: Math.floor(Date.now() / 1000) });
    found++;

    // Polite spacing between content fetches — Nintondo host is shared.
    await new Promise((r) => setTimeout(r, 150));
  }

  await writeScanCursor(env, network, "pokebells", newestThisPage, found);
  return { ok: true, network, found, newest: newestThisPage };
}
