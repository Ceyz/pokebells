// PokeBells indexer — CF Worker entry.
//
// Model: register-on-mint. The companion POSTs { inscription_id, network }
// after a user signs and inscribes a capture. The worker fetches the content
// from bells-*-content.nintondo.io, runs the validator (schema + attestation
// + block-hash existence), and on success writes a row to D1. Reads are
// served from D1 with pagination.
//
// No chain scanning: Nintondo has no public inscription-listing API, and
// captures minted outside the companion flow are by-design excluded from the
// official collection (same anti-cheat policy as the on-chain indexer spec).

import { fetchAndValidateInscription } from "./validator.js";
import {
  insertCapture, logIngestion, captureExists, captureById,
  capturesByOwner, capturesBySpecies,
  leaderboardByIvTotal, leaderboardByCount, networkStats,
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
  // /24 (IPv4) or /48 (IPv6) prefix, used only for coarse rate-limit grouping.
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  if (!ip) return null;
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 3).join(":") + "::";
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : null;
}

async function getOwnerFromInscription(inscriptionId, network, env) {
  // Nintondo's content host returns the inscription content body, not metadata
  // like owner. To get the owner we'd scrape the inscription detail page.
  // Shipping without owner-verification for tonight — the capture JSON's
  // `signed_in_wallet` is used as the owner for query purposes; an on-chain
  // owner cross-check can be added later once we know which API endpoint
  // Nintondo exposes (none found as of 2026-04-20 probe).
  // TODO: fetch /bells/inscriptions/<id> RSC stream to extract on-chain owner.
  return null;
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
    await logIngestion(env, inscriptionId, network, "duplicate", null, ipPrefix);
    return json({ ok: true, status: "duplicate", inscription_id: inscriptionId });
  }

  const result = await fetchAndValidateInscription(inscriptionId, network, env);
  if (!result.ok) {
    await logIngestion(env, inscriptionId, network, "invalid", `${result.stage}: ${result.reason}`, ipPrefix);
    return json(
      { ok: false, error: "validation_failed", stage: result.stage, reason: result.reason },
      { status: 422 },
    );
  }

  const onChainOwner = await getOwnerFromInscription(inscriptionId, network, env);
  const ownerAddress = onChainOwner ?? result.normalized.signed_in_wallet;

  try {
    await insertCapture(env, inscriptionId, ownerAddress, result.normalized, result.raw);
    await logIngestion(env, inscriptionId, network, "ok", null, ipPrefix);
  } catch (e) {
    await logIngestion(env, inscriptionId, network, "error", e.message, ipPrefix);
    return json({ ok: false, error: "db_error", reason: e.message }, { status: 500 });
  }

  return json({
    ok: true,
    status: "registered",
    inscription_id: inscriptionId,
    owner_address: ownerAddress,
    species_id: result.normalized.species_id,
    iv_total: result.normalized.iv_total,
  });
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
  if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > 151) {
    return json({ ok: false, error: "species query param required (1..151)" }, { status: 400 });
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
      return json({ ok: true, service: "pokebells-indexer", version: "v1" });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      return handleGetStats(env);
    }

    if (url.pathname === "/api/captures" && request.method === "POST") {
      return handlePostCapture(request, env);
    }

    if (request.method === "GET") {
      const trainerMatch = url.pathname.match(/^\/api\/trainer\/([^/]+)\/?$/);
      if (trainerMatch) return handleGetTrainer(env, url, trainerMatch[1]);

      if (url.pathname === "/api/pokedex") return handleGetPokedex(env, url);

      if (url.pathname === "/api/leaderboard") return handleGetLeaderboard(env, url);

      const captureMatch = url.pathname.match(/^\/api\/captures\/([^/]+)\/?$/);
      if (captureMatch) return handleGetCapture(env, captureMatch[1]);
    }

    return json({ ok: false, error: "not_found", path: url.pathname }, { status: 404 });
  },
};
