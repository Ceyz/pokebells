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
// No chain scanning: Nintondo has no public inscription-listing API. Captures
// minted outside the companion flow are by-design excluded from the official
// collection (same policy as the on-chain spec).

import { fetchAndValidateInscription, validateReveal, validateSaveSnapshot } from "./validator.js";
import {
  insertCapture, insertReveal, applyRevealToCapture, logIngestion,
  captureExists, revealExists, captureById,
  findContentSha256Conflict, findRamSnapshotHashConflict,
  capturesByOwner, capturesBySpecies,
  leaderboardByIvTotal, leaderboardByCount, networkStats,
  insertSave, saveExists, findLatestSaveVersion, latestSaveByWallet,
} from "./db.js";

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

  if (await captureExists(env, inscriptionId)) {
    await logIngestion(env, inscriptionId, "capture", network, "duplicate", null, ipPrefix);
    return json({ ok: true, status: "duplicate", inscription_id: inscriptionId });
  }

  const result = await fetchAndValidateInscription(inscriptionId, network, env);
  if (!result.ok) {
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

// Off-chain reveal: the user publishes the IV+salt+ram_snapshot preimages
// directly to the indexer instead of inscribing a second ordinal. Security
// model: the capture's ivs_commitment + ram_snapshot_hash on-chain are the
// cryptographic anchor. Anyone can independently verify that these preimages
// match those commitments; the indexer just stores + serves them. A future
// on-chain op:"reveal" inscription would override (see COALESCE in
// applyRevealToCapture), so off-chain is strictly additive — no lock-in.
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

async function handleGetTrainer(env, url, pathOwner) {
  const owner = decodeURIComponent(pathOwner);
  if (!owner || owner.length > 128) {
    return json({ ok: false, error: "bad_address" }, { status: 400 });
  }
  const network = url.searchParams.get("network");
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const captures = await capturesByOwner(env, owner, network, limit, offset);
  return json({ ok: true, owner, network: network ?? "any", count: captures.length, captures });
}

async function handleGetPokedex(env, url) {
  const speciesId = Number.parseInt(url.searchParams.get("species") ?? "", 10);
  if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > 251) {
    return json({ ok: false, error: "species query param required (1..251)" }, { status: 400 });
  }
  const network = url.searchParams.get("network");
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const captures = await capturesBySpecies(env, speciesId, network, limit, offset);
  return json({ ok: true, species_id: speciesId, count: captures.length, captures });
}

async function handleGetLeaderboard(env, url) {
  const by = url.searchParams.get("by") ?? "iv_total";
  const network = url.searchParams.get("network");
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "25", 10);
  if (by === "iv_total") {
    const rows = await leaderboardByIvTotal(env, network, limit);
    return json({ ok: true, by, network: network ?? "any", rows });
  }
  if (by === "count") {
    const rows = await leaderboardByCount(env, network, limit);
    return json({ ok: true, by, network: network ?? "any", rows });
  }
  return json({ ok: false, error: "unknown_metric", allowed: ["iv_total", "count"] }, { status: 400 });
}

async function handleGetCapture(env, pathId) {
  const inscriptionId = decodeURIComponent(pathId);
  if (!INSCRIPTION_ID_RE.test(inscriptionId)) {
    return json({ ok: false, error: "bad_inscription_id" }, { status: 400 });
  }
  const row = await captureById(env, inscriptionId);
  if (!row) return json({ ok: false, error: "not_found" }, { status: 404 });
  return json({ ok: true, capture: row });
}

async function handleGetStats(env) {
  const stats = await networkStats(env);
  return json({ ok: true, stats });
}

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "pokebells-indexer", version: "v1.4" });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      return handleGetStats(env);
    }

    if (url.pathname === "/api/captures" && request.method === "POST") {
      return handlePostCapture(request, env);
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

    if (request.method === "GET") {
      const trainerMatch = url.pathname.match(/^\/api\/trainer\/([^/]+)\/?$/);
      if (trainerMatch) return handleGetTrainer(env, url, trainerMatch[1]);

      if (url.pathname === "/api/pokedex") return handleGetPokedex(env, url);

      if (url.pathname === "/api/leaderboard") return handleGetLeaderboard(env, url);

      const saveMatch = url.pathname.match(/^\/api\/saves\/([^/]+)\/?$/);
      if (saveMatch) return handleGetSave(env, url, saveMatch[1]);

      const captureMatch = url.pathname.match(/^\/api\/captures\/([^/]+)\/?$/);
      if (captureMatch) return handleGetCapture(env, captureMatch[1]);
    }

    return json({ ok: false, error: "not_found", path: url.pathname }, { status: 404 });
  },
};
