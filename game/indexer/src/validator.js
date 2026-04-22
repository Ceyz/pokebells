// Capture + reveal JSON validator. Runs on the CF Worker, so it stays
// dependency-free (standard Web APIs only: crypto.subtle, fetch, TextEncoder,
// atob). Supports:
//   - schema 1.3 legacy (plaintext IVs inline, attestation v1.1)
//   - schema 1.4 commit-reveal (IVs hidden, attestation v2 over commitments)
//   - op:"reveal" inscriptions that open a prior capture's commitments
//
// Stages (short-circuit on first failure): schema → provenance → attestation
// recomputed → block hash existence on the claimed network.

const BLOCK_HASH_RE = /^[0-9a-f]{64}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;
const WRAM_BYTE_LENGTH = 0x2000;

const ATTESTATION_SCHEME_V1   = "sha256:block_hash+wram+signed_wallet+session_sequence:v1";
const ATTESTATION_SCHEME_V1_1 = "sha256:block_hash+wram8k_bank0_bank1+svbk+signed_wallet+session_sequence:v1.1";
const ATTESTATION_SCHEME_V2   = "sha256:block_hash+ram_snapshot_hash+svbk+signed_wallet+session_sequence+ivs_commitment:v2";
const IVS_COMMITMENT_SCHEME   = "sha256:canonical(ivs)+salt_32b:v1";
const SAVE_SNAPSHOT_SCHEME    = "base64:raw-sram-32k:v1";
const SRAM_EXPECTED_BYTES     = 32768;

// block_hash_at_capture must be within this many blocks of the inscription's
// own block (staleness defense). 144 blocks = ~24h on 10-min blocks.
const BLOCK_STALENESS_LIMIT = 144;

const decodeBase64 = (value) => {
  const binary = atob(String(value ?? ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const encodeUtf8 = (value) => new TextEncoder().encode(String(value ?? ""));

const concatBytes = (parts) => {
  const norm = parts.map((p) => (p instanceof Uint8Array ? p : encodeUtf8(p)));
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

const canonicalIvsBytes = (ivs) => {
  const atk = Number.isInteger(ivs?.atk) ? ivs.atk : 0;
  const def = Number.isInteger(ivs?.def) ? ivs.def : 0;
  const spe = Number.isInteger(ivs?.spe) ? ivs.spe : 0;
  const spd = Number.isInteger(ivs?.spd) ? ivs.spd : (Number.isInteger(ivs?.spc) ? ivs.spc : 0);
  return new TextEncoder().encode(`{"atk":${atk},"def":${def},"spe":${spe},"spd":${spd}}`);
};

const computeIvsCommitment = async (ivs, saltBytes) =>
  sha256Hex([canonicalIvsBytes(ivs), saltBytes]);

const computeRamSnapshotHash = async (bytes) => sha256Hex([bytes]);

const computeAttestationV1_1 = async ({ blockHash, ramBytes, svbk, wallet, seq }) =>
  sha256Hex([
    String(blockHash).toLowerCase(),
    ramBytes,
    new Uint8Array([svbk & 0xff]),
    String(wallet),
    String(seq),
  ]);

const computeAttestationV2 = async ({ blockHash, ramHashHex, svbk, wallet, seq, ivsCommitmentHex }) =>
  sha256Hex([
    String(blockHash).toLowerCase(),
    String(ramHashHex).toLowerCase(),
    new Uint8Array([svbk & 0xff]),
    String(wallet),
    String(seq),
    String(ivsCommitmentHex).toLowerCase(),
  ]);

// Fingerprint used for cross-capture dedupe. Skips fields that vary by run
// (attestation, raw_capture_json) but covers everything semantic — species,
// level, provenance, commitments, wallet, block.
const canonicalCaptureFingerprint = async (parsed) => {
  const parts = [
    "v1",
    String(parsed.schema_version ?? ""),
    String(parsed.species_id ?? parsed.species ?? ""),
    String(parsed.level ?? ""),
    String(parsed.block_hash_at_capture ?? "").toLowerCase(),
    String(parsed.session_sequence_number ?? ""),
    String(parsed.signed_in_wallet ?? ""),
    String(parsed.ram_snapshot_hash ?? parsed.ram_snapshot ?? ""),
    String(parsed.ivs_commitment ?? ""),
  ];
  return sha256Hex([parts.join("|")]);
};

const reject = (stage, reason) => ({ ok: false, stage, reason });

function hexToBytes(hex) {
  const clean = String(hex ?? "").toLowerCase();
  if (!HEX64_RE.test(clean)) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function validateCaptureV1_4(parsed) {
  // Commit-reveal: IVs / EVs / shiny / ram_snapshot must be null. Public
  // fields species/level/catch_rate/moves remain inline.
  if (parsed.ivs != null) {
    return reject("schema", "schema 1.4 must not carry plaintext ivs (use op:reveal)");
  }
  if (parsed.derived_ivs != null) {
    return reject("schema", "schema 1.4 must not carry plaintext derived_ivs");
  }
  if (parsed.evs != null) {
    return reject("schema", "schema 1.4 must not carry plaintext evs (publish via op:reveal)");
  }
  if (parsed.shiny != null) {
    return reject("schema", "schema 1.4 must not carry plaintext shiny (derivable from ivs)");
  }
  if (parsed.ram_snapshot != null) {
    return reject("schema", "schema 1.4 must not carry raw ram_snapshot (use op:reveal)");
  }
  if (!HEX64_RE.test(String(parsed.ivs_commitment ?? ""))) {
    return reject("schema", "ivs_commitment must be 64-char sha256 hex");
  }
  if (!HEX64_RE.test(String(parsed.ram_snapshot_hash ?? ""))) {
    return reject("schema", "ram_snapshot_hash must be 64-char sha256 hex");
  }
  if (parsed.ivs_commitment_scheme && parsed.ivs_commitment_scheme !== IVS_COMMITMENT_SCHEME) {
    return reject("schema", `ivs_commitment_scheme must equal "${IVS_COMMITMENT_SCHEME}"`);
  }
  return { ok: true };
}

export async function validateCapture(parsed, env) {
  // Stage 1 — schema
  if (!parsed || typeof parsed !== "object") {
    return reject("schema", "capture is not an object");
  }
  if (parsed.p !== "pokebells") return reject("schema", 'field "p" must equal "pokebells"');
  if (parsed.op !== "capture") return reject("schema", 'field "op" must equal "capture"');

  const schemaVersion = String(parsed.schema_version ?? "");
  if (schemaVersion !== "1.3" && schemaVersion !== "1.4") {
    return reject("schema", `unsupported schema_version "${schemaVersion}"`);
  }

  const speciesId = Number.isInteger(parsed.species_id) ? parsed.species_id : parsed.species;
  if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > 251) {
    return reject("schema", "species_id must be integer in [1..251]");
  }
  if (parsed.species !== undefined && parsed.species_id !== undefined
      && parsed.species !== parsed.species_id) {
    return reject("schema", "species and species_id must match when both present");
  }
  if (!Number.isInteger(parsed.level) || parsed.level < 1 || parsed.level > 100) {
    return reject("schema", "level must be integer in [1..100]");
  }

  let schemaV14Normalized = null;
  if (schemaVersion === "1.4") {
    const v14Check = await validateCaptureV1_4(parsed);
    if (!v14Check.ok) return v14Check;
    schemaV14Normalized = {
      ivs_commitment: String(parsed.ivs_commitment).toLowerCase(),
      ram_snapshot_hash: String(parsed.ram_snapshot_hash).toLowerCase(),
    };
  } else {
    // v1.3 validation (legacy path)
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
  }

  // Stage 2 — provenance
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
  const attestation = String(parsed.attestation ?? "").trim().toLowerCase();
  if (!BLOCK_HASH_RE.test(attestation)) {
    return reject("provenance", "attestation must be 64-char hex");
  }

  const svbk = Number.isInteger(parsed.svbk_at_capture)
    ? parsed.svbk_at_capture & 0xff
    : 0;

  // Stage 3 — attestation recompute
  if (schemaVersion === "1.4") {
    if (parsed.attestation_scheme && parsed.attestation_scheme !== ATTESTATION_SCHEME_V2) {
      return reject("provenance", `schema 1.4 requires attestation_scheme ${ATTESTATION_SCHEME_V2}`);
    }
    const expected = await computeAttestationV2({
      blockHash,
      ramHashHex: schemaV14Normalized.ram_snapshot_hash,
      svbk,
      wallet: parsed.signed_in_wallet,
      seq: parsed.session_sequence_number,
      ivsCommitmentHex: schemaV14Normalized.ivs_commitment,
    });
    if (attestation !== expected) {
      return reject("attestation", "v2 attestation does not match recomputed commitments");
    }
  } else {
    // v1.3: recompute v1.1 attestation (requires raw ram_snapshot)
    if ((parsed.ram_snapshot_encoding ?? "base64") !== "base64") {
      return reject("provenance", 'ram_snapshot_encoding must equal "base64"');
    }
    if (parsed.attestation_scheme
        && parsed.attestation_scheme !== ATTESTATION_SCHEME_V1
        && parsed.attestation_scheme !== ATTESTATION_SCHEME_V1_1) {
      return reject("provenance", `attestation_scheme not recognized: ${parsed.attestation_scheme}`);
    }
    let ramBytes;
    try { ramBytes = decodeBase64(parsed.ram_snapshot ?? ""); }
    catch (e) { return reject("provenance", `ram_snapshot base64 decode failed: ${e.message}`); }
    if (ramBytes.byteLength !== WRAM_BYTE_LENGTH) {
      return reject("provenance", `ram_snapshot must decode to ${WRAM_BYTE_LENGTH} bytes`);
    }
    const expected = await computeAttestationV1_1({
      blockHash, ramBytes, svbk,
      wallet: parsed.signed_in_wallet,
      seq: parsed.session_sequence_number,
    });
    if (attestation !== expected) {
      return reject("attestation", "v1.1 attestation does not match recomputed provenance");
    }
  }

  // Stage 4 — block hash exists on claimed network
  const network = String(parsed.capture_network ?? "").trim();
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return reject("network", "capture_network must be bells-mainnet or bells-testnet");
  }
  const electrsBase = network === "bells-mainnet"
    ? env.ELECTRS_BASE_MAINNET
    : env.ELECTRS_BASE_TESTNET;
  let blockHeight = null;
  try {
    const r = await fetch(`${electrsBase}/block/${blockHash}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return reject("network", `block hash not found on ${network} (${r.status})`);
    try {
      const blockMeta = await r.json();
      if (Number.isInteger(blockMeta?.height)) blockHeight = blockMeta.height;
    } catch { /* height stays null — non-fatal */ }
  } catch (e) {
    return reject("network", `block lookup failed: ${e.message}`);
  }

  const fingerprint = await canonicalCaptureFingerprint(parsed);

  return {
    ok: true,
    normalized: {
      schema_version: schemaVersion,
      species_id: speciesId,
      species_name: typeof parsed.species_name === "string" ? parsed.species_name : null,
      level: parsed.level,
      catch_rate: Number.isInteger(parsed.catch_rate) ? parsed.catch_rate : null,
      held_item: Number.isInteger(parsed.held_item) ? parsed.held_item : null,
      friendship: Number.isInteger(parsed.friendship) ? parsed.friendship : null,
      pokerus: Number.isInteger(parsed.pokerus) ? parsed.pokerus : null,
      status: typeof parsed.status === "string" ? parsed.status : null,
      moves_json: JSON.stringify(Array.isArray(parsed.moves) ? parsed.moves : []),
      pp_json: JSON.stringify(Array.isArray(parsed.pp) ? parsed.pp : []),
      // Pre-reveal: IVs + EVs + shiny stay null. v1.3 records have them
      // inline and we copy through for indexer leaderboards.
      iv_atk: schemaVersion === "1.3" ? parsed.ivs.atk : null,
      iv_def: schemaVersion === "1.3" ? parsed.ivs.def : null,
      iv_spe: schemaVersion === "1.3" ? parsed.ivs.spe : null,
      iv_special: schemaVersion === "1.3"
        ? (Number.isInteger(parsed.ivs.spc) ? parsed.ivs.spc : parsed.ivs.spd)
        : null,
      iv_total: schemaVersion === "1.3"
        ? parsed.ivs.atk + parsed.ivs.def + parsed.ivs.spe
          + (Number.isInteger(parsed.ivs.spc) ? parsed.ivs.spc : parsed.ivs.spd)
        : null,
      shiny: schemaVersion === "1.3" ? (parsed.shiny ? 1 : 0) : null,
      ev_hp: null, ev_atk: null, ev_def: null, ev_spe: null, ev_spc: null,

      attestation_scheme: parsed.attestation_scheme ?? null,
      attestation,
      ivs_commitment: schemaV14Normalized?.ivs_commitment ?? null,
      ram_snapshot_hash: schemaV14Normalized?.ram_snapshot_hash ?? null,
      svbk_at_capture: svbk,
      capture_content_sha256: fingerprint,

      network,
      block_height_at_capture: blockHeight,
      block_hash_at_capture: blockHash,
      signed_in_wallet: parsed.signed_in_wallet,
      session_sequence_number: parsed.session_sequence_number,
    },
  };
}

export async function fetchAndValidateInscription(inscriptionId, network, env) {
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return reject("network", "network must be bells-mainnet or bells-testnet");
  }
  const base = network === "bells-mainnet"
    ? env.CONTENT_BASE_MAINNET
    : env.CONTENT_BASE_TESTNET;
  const url = `${base}${encodeURIComponent(inscriptionId)}`;

  let response;
  try { response = await fetch(url, { cf: { cacheTtl: 60 } }); }
  catch (e) { return reject("fetch", `content fetch failed: ${e.message}`); }
  if (!response.ok) return reject("fetch", `content endpoint returned ${response.status}`);

  const raw = await response.text();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { return reject("schema", `content is not valid JSON: ${e.message}`); }

  if (parsed?.op === "reveal") {
    return { ok: true, kind: "reveal", parsed, raw };
  }
  if (parsed?.op === "save-snapshot") {
    return { ok: true, kind: "save-snapshot", parsed, raw };
  }
  const result = await validateCapture(parsed, env);
  if (!result.ok) return result;
  return { ok: true, kind: "capture", normalized: result.normalized, raw, parsed };
}

// Validate an op:"save-snapshot" inscription. Does NOT validate signature
// (blocked on Bells signMessage probe); caller decides the policy. The
// indexer still enforces schema + sha256 integrity + save_version monotonic
// (via db.js findLatestSaveVersion).
export async function validateSaveSnapshot(parsed, env) {
  if (!parsed || typeof parsed !== "object") return reject("schema", "save is not an object");
  if (parsed.p !== "pokebells") return reject("schema", 'p must equal "pokebells"');
  if (parsed.op !== "save-snapshot") return reject("schema", 'op must equal "save-snapshot"');
  if (parsed.sram_encoding !== "base64") return reject("schema", 'sram_encoding must equal "base64"');
  if (parsed.save_scheme !== SAVE_SNAPSHOT_SCHEME) {
    return reject("schema", `save_scheme must equal ${SAVE_SNAPSHOT_SCHEME}`);
  }
  const wallet = typeof parsed.signed_in_wallet === "string" ? parsed.signed_in_wallet.trim() : "";
  if (!wallet) return reject("schema", "signed_in_wallet required");
  if (!Number.isInteger(parsed.save_version) || parsed.save_version < 1) {
    return reject("schema", "save_version must be positive integer");
  }
  const romSha = String(parsed.game_rom_sha256 ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(romSha)) return reject("schema", "game_rom_sha256 must be 64-char hex");
  const sramSha = String(parsed.sram_sha256 ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sramSha)) return reject("schema", "sram_sha256 must be 64-char hex");

  let bytes;
  try { bytes = decodeBase64(parsed.sram ?? ""); }
  catch (e) { return reject("schema", `sram base64 decode failed: ${e.message}`); }
  if (bytes.byteLength !== SRAM_EXPECTED_BYTES) {
    return reject("schema", `sram must decode to ${SRAM_EXPECTED_BYTES} bytes`);
  }
  const actualSha = await sha256Hex([bytes]);
  if (actualSha !== sramSha) {
    return reject("integrity", "sram_sha256 does not match decoded bytes");
  }

  const network = String(parsed.capture_network ?? "").trim();
  if (network !== "bells-mainnet" && network !== "bells-testnet") {
    return reject("network", "capture_network must be bells-mainnet or bells-testnet");
  }

  return {
    ok: true,
    normalized: {
      signed_in_wallet: wallet,
      game_rom: typeof parsed.game_rom === "string" ? parsed.game_rom : null,
      game_rom_sha256: romSha,
      network,
      save_version: parsed.save_version,
      sram_sha256: sramSha,
      sram_byte_length: SRAM_EXPECTED_BYTES,
      save_scheme: parsed.save_scheme,
      signature_scheme: parsed.signature_scheme ?? null,
      signature: parsed.signature ?? null,
      block_hash_at_save: parsed.block_hash_at_save ?? null,
    },
  };
}

// Verify a reveal inscription body against a previously-registered capture.
// Pass capture as the row returned by db.captureById (needs ivs_commitment +
// ram_snapshot_hash + attestation).
export async function validateReveal(revealParsed, captureRow, env) {
  if (!revealParsed || revealParsed.p !== "pokebells" || revealParsed.op !== "reveal") {
    return reject("schema", "reveal must have p:pokebells op:reveal");
  }
  if (String(revealParsed.schema_version ?? "") !== "1.4") {
    return reject("schema", "reveal schema_version must equal 1.4");
  }
  if (!captureRow) {
    return reject("reference", "capture row not found — register the capture first");
  }
  if (!captureRow.ivs_commitment || !captureRow.ram_snapshot_hash) {
    return reject("reference", "capture has no commitment (schema 1.3 captures cannot be revealed)");
  }

  const ivs = revealParsed.ivs ?? {};
  for (const key of ["atk", "def", "spe", "spd"]) {
    if (!Number.isInteger(ivs[key]) || ivs[key] < 0 || ivs[key] > 15) {
      return reject("schema", `reveal IV ${key} must be integer in [0..15]`);
    }
  }
  const saltHex = String(revealParsed.ivs_salt_hex ?? "").toLowerCase();
  const saltBytes = hexToBytes(saltHex);
  if (!saltBytes) return reject("schema", "ivs_salt_hex must be 64-char hex (32 bytes)");

  const expectedCommitment = await computeIvsCommitment(ivs, saltBytes);
  if (expectedCommitment !== String(captureRow.ivs_commitment).toLowerCase()) {
    return reject("commitment", "ivs_commitment preimage does not match capture commitment");
  }

  let ramBytes;
  try { ramBytes = decodeBase64(revealParsed.ram_snapshot ?? ""); }
  catch (e) { return reject("schema", `ram_snapshot base64 decode failed: ${e.message}`); }
  if (ramBytes.byteLength !== WRAM_BYTE_LENGTH) {
    return reject("schema", `ram_snapshot must decode to ${WRAM_BYTE_LENGTH} bytes`);
  }
  const expectedRamHash = await computeRamSnapshotHash(ramBytes);
  if (expectedRamHash !== String(captureRow.ram_snapshot_hash).toLowerCase()) {
    return reject("commitment", "ram_snapshot_hash does not match capture commitment");
  }

  const evs = revealParsed.evs ?? null;
  return {
    ok: true,
    normalized: {
      capture_inscription_id: captureRow.inscription_id,
      ivs_salt_hex: saltHex,
      iv_atk: ivs.atk,
      iv_def: ivs.def,
      iv_spe: ivs.spe,
      iv_special: ivs.spd,
      iv_total: ivs.atk + ivs.def + ivs.spe + ivs.spd,
      shiny: revealParsed.shiny ? 1 : 0,
      ev_hp: Number.isInteger(evs?.hp) ? evs.hp : null,
      ev_atk: Number.isInteger(evs?.atk) ? evs.atk : null,
      ev_def: Number.isInteger(evs?.def) ? evs.def : null,
      ev_spe: Number.isInteger(evs?.spe) ? evs.spe : null,
      ev_spc: Number.isInteger(evs?.spc) ? evs.spc : null,
    },
  };
}
