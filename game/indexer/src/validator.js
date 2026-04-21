// Capture JSON validator. Runs on the CF Worker, so it must stay dependency-free
// (standard Web APIs only — crypto.subtle, fetch, TextEncoder, atob).
//
// Validation stages (short-circuit on first failure):
//   1. JSON shape + pokebells schema v1.2 fields
//   2. Integer ranges (species 1..151, level 1..100, IVs 0..15)
//   3. Attestation recomputed from provenance fields matches on-chain
//   4. Block hash exists on the claimed network (electrs lookup)
//
// Returns { ok: true, normalized } on success or { ok: false, reason, stage }
// on failure. `normalized` has integer fields coerced and IV `spc` vs `spd`
// collapsed into `iv_special` so the DB row is unambiguous.

const BLOCK_HASH_RE = /^[0-9a-f]{64}$/i;
const WRAM_BYTE_LENGTH = 0x2000;
const ATTESTATION_SCHEME = "sha256:block_hash+wram+signed_wallet+session_sequence:v1";

const decodeBase64 = (value) => {
  const binary = atob(String(value ?? ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const encodeUtf8 = (value) => new TextEncoder().encode(String(value ?? ""));

const concatBytes = (parts) => {
  const norm = parts.map((p) => p instanceof Uint8Array ? p : encodeUtf8(p));
  const total = norm.reduce((s, p) => s + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of norm) { out.set(p, offset); offset += p.byteLength; }
  return out;
};

const bytesToHex = (bytes) =>
  Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (parts) => {
  const digest = await crypto.subtle.digest("SHA-256", concatBytes(parts));
  return bytesToHex(new Uint8Array(digest));
};

const reject = (stage, reason) => ({ ok: false, stage, reason });

export async function validateCapture(parsed, env) {
  // Stage 1 — schema
  if (!parsed || typeof parsed !== "object") {
    return reject("schema", "capture is not an object");
  }
  if (parsed.p !== "pokebells") return reject("schema", 'field "p" must equal "pokebells"');
  if (parsed.op !== "capture") return reject("schema", 'field "op" must equal "capture"');

  const speciesId = Number.isInteger(parsed.species_id) ? parsed.species_id : parsed.species;
  if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > 151) {
    return reject("schema", "species_id must be integer in [1..151]");
  }
  if (parsed.species !== undefined && parsed.species_id !== undefined
      && parsed.species !== parsed.species_id) {
    return reject("schema", "species and species_id must match when both present");
  }
  if (!Number.isInteger(parsed.level) || parsed.level < 1 || parsed.level > 100) {
    return reject("schema", "level must be integer in [1..100]");
  }

  const ivs = parsed.ivs ?? {};
  for (const key of ["atk", "def", "spe"]) {
    if (!Number.isInteger(ivs[key]) || ivs[key] < 0 || ivs[key] > 15) {
      return reject("schema", `IV ${key} must be integer in [0..15]`);
    }
  }
  const ivSpecial = Number.isInteger(ivs.spc) ? ivs.spc : ivs.spd;
  if (!Number.isInteger(ivSpecial) || ivSpecial < 0 || ivSpecial > 15) {
    return reject("schema", "IV spc/spd must be integer in [0..15]");
  }

  // Stage 2 — provenance fields
  const blockHash = String(parsed.block_hash_at_capture ?? "").trim().toLowerCase();
  if (!BLOCK_HASH_RE.test(blockHash)) {
    return reject("provenance", "block_hash_at_capture must be 64-char hex");
  }
  if (!Number.isInteger(parsed.session_sequence_number) || parsed.session_sequence_number < 1) {
    return reject("provenance", "session_sequence_number must be positive integer");
  }
  if (typeof parsed.signed_in_wallet !== "string" || !parsed.signed_in_wallet.trim()) {
    return reject("provenance", "signed_in_wallet must be present and non-empty");
  }
  if ((parsed.ram_snapshot_encoding ?? "base64") !== "base64") {
    return reject("provenance", 'ram_snapshot_encoding must equal "base64"');
  }
  if (parsed.attestation_scheme && parsed.attestation_scheme !== ATTESTATION_SCHEME) {
    return reject("provenance", `attestation_scheme must equal "${ATTESTATION_SCHEME}"`);
  }
  const attestation = String(parsed.attestation ?? "").trim().toLowerCase();
  if (!BLOCK_HASH_RE.test(attestation)) {
    return reject("provenance", "attestation must be 64-char hex");
  }

  let ramBytes;
  try { ramBytes = decodeBase64(parsed.ram_snapshot ?? ""); }
  catch (e) { return reject("provenance", `ram_snapshot base64 decode failed: ${e.message}`); }
  if (ramBytes.byteLength !== WRAM_BYTE_LENGTH) {
    return reject("provenance", `ram_snapshot must decode to ${WRAM_BYTE_LENGTH} bytes`);
  }

  // Stage 3 — attestation recomputation
  const expected = await sha256Hex([
    blockHash,
    ramBytes,
    String(parsed.signed_in_wallet),
    String(parsed.session_sequence_number),
  ]);
  if (attestation !== expected) {
    return reject("attestation", "attestation hash does not match recomputed provenance");
  }

  // Stage 4 — block hash existence on the claimed network
  const network = String(parsed.capture_network ?? "").trim();
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return reject("network", "capture_network must be bells-mainnet or bells-testnet");
  }
  const electrsBase = network === "bells-mainnet"
    ? env.ELECTRS_BASE_MAINNET
    : env.ELECTRS_BASE_TESTNET;
  try {
    const r = await fetch(`${electrsBase}/block/${blockHash}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return reject("network", `block hash not found on ${network} (${r.status})`);
  } catch (e) {
    return reject("network", `block lookup failed: ${e.message}`);
  }

  return {
    ok: true,
    normalized: {
      species_id: speciesId,
      species_name: typeof parsed.species_name === "string" ? parsed.species_name : null,
      level: parsed.level,
      iv_atk: ivs.atk,
      iv_def: ivs.def,
      iv_spe: ivs.spe,
      iv_special: ivSpecial,
      iv_total: ivs.atk + ivs.def + ivs.spe + ivSpecial,
      shiny: parsed.shiny ? 1 : 0,
      network,
      block_height_at_capture: Number.isInteger(parsed.block_height_at_capture)
        ? parsed.block_height_at_capture : null,
      block_hash_at_capture: blockHash,
      attestation,
      signed_in_wallet: parsed.signed_in_wallet,
      session_sequence_number: parsed.session_sequence_number,
    },
  };
}

// Fetch the inscription content from the Nintondo content host, parse as JSON,
// and hand off to validateCapture. Also returns the raw text so the caller can
// store it in raw_capture_json for audit.
export async function fetchAndValidateInscription(inscriptionId, network, env) {
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return reject("network", "network must be bells-mainnet or bells-testnet");
  }
  const base = network === "bells-mainnet"
    ? env.CONTENT_BASE_MAINNET
    : env.CONTENT_BASE_TESTNET;
  const url = `${base}${encodeURIComponent(inscriptionId)}`;

  let response;
  try {
    response = await fetch(url, { cf: { cacheTtl: 60 } });
  } catch (e) {
    return reject("fetch", `content fetch failed: ${e.message}`);
  }
  if (!response.ok) {
    return reject("fetch", `content endpoint returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json") && !contentType.includes("text")) {
    return reject("schema", `content-type ${contentType} is not JSON/text`);
  }

  const raw = await response.text();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { return reject("schema", `content is not valid JSON: ${e.message}`); }

  const result = await validateCapture(parsed, env);
  if (!result.ok) return result;
  return { ok: true, normalized: result.normalized, raw };
}
