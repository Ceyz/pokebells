export const CAPTURE_FRAMES_REQUIRED = 3;

// ---- WRAM snapshot (anti-cheat attestation) ----
// Gen 1 attestation v1 snapshotted a flat 8 KB window (0xC000..0xDFFF). In
// Crystal (CGB mode), 0xD000..0xDFFF is banked WRAMX - SVBK (0xFF70) chooses
// banks 1..7 and the party section lives in bank 1. A blind read sometimes
// hits the wrong bank and produces non-reproducible attestations.
//
// Attestation v1.1 = snapshot bank 0 (0xC000..0xCFFF, 4 KB) and bank 1
// (0xD000..0xDFFF with SVBK forced to 1, another 4 KB) for a total 8 KB -
// same size as v1, different byte source for the second half. The SVBK
// register itself is appended as the final byte so a verifier can confirm
// which bank was active during the read.
export const WRAM_BANK0_START = 0xc000;
export const WRAM_BANK0_BYTE_LENGTH = 0x1000;
export const WRAM_BANK1_START = 0xd000;
export const WRAM_BANK1_BYTE_LENGTH = 0x1000;
export const WRAM_BYTE_LENGTH = WRAM_BANK0_BYTE_LENGTH + WRAM_BANK1_BYTE_LENGTH; // = 0x2000
// Back-compat: the v1 field name. Equivalent to the bank 0 window start.
export const WRAM_START = WRAM_BANK0_START;
export const SVBK_REGISTER = 0xff70;

// ---- Cart SRAM (save file) layout ----
// Pokemon Crystal uses MBC3 + 32 KB SRAM + RTC + battery. SRAM is mapped at
// 0xA000..0xBFFF in 8 KB banks 0..3, selected via writes to the 0x4000..0x5FFF
// register. RAM enable is controlled by writes of 0x0A to 0x0000..0x1FFF.
// See docs: https://gbdev.io/pandocs/MBC3.html
export const SRAM_BANK_COUNT = 4;
export const SRAM_BANK_BYTE_LENGTH = 0x2000;     // 8 KB
export const SRAM_TOTAL_BYTE_LENGTH = SRAM_BANK_COUNT * SRAM_BANK_BYTE_LENGTH; // = 32 KB
export const SRAM_WINDOW_START = 0xa000;
export const SRAM_RAM_ENABLE_ADDR = 0x0000;      // any write in 0x0000..0x1FFF
export const SRAM_BANK_SELECT_ADDR = 0x4000;     // any write in 0x4000..0x5FFF

export const SAVE_SNAPSHOT_SCHEME = 'base64:raw-sram-32k:v1';
export const SAVE_SNAPSHOT_SIG_SCHEME = 'bells-signmessage:pokebells-save-v1';

export const ATTESTATION_SCHEME_V1 = 'sha256:block_hash+wram+signed_wallet+session_sequence:v1';
export const ATTESTATION_SCHEME_V1_1 = 'sha256:block_hash+wram8k_bank0_bank1+svbk+signed_wallet+session_sequence:v1.1';

// v2 attestation (schema 1.4 commit-reveal): the capture record omits raw
// ram_snapshot bytes and raw IVs. Instead it publishes a SHA-256 commitment
// to each. The reveal inscription (op: "reveal") later publishes the
// preimages, which the indexer verifies against the commitments. Until
// reveal lands, IVs and EVs are cryptographically hidden — impossible to
// trait-snipe by cancelling bad rolls because the user cannot even see
// their own IVs inside the JSON they copy to the inscriber.
export const ATTESTATION_SCHEME_V2 =
  'sha256:block_hash+ram_snapshot_hash+svbk+signed_wallet+session_sequence+ivs_commitment:v2';
export const IVS_COMMITMENT_SCHEME = 'sha256:canonical(ivs)+salt_32b:v1';

// v2.1 attestation (schema 1.5): adds party_slot_index to pin which of the
// six party slots was captured. Without it, a minter could later choose any
// slot from the same RAM snapshot. The slot is exposed as a top-level field
// in the capture_commit AND folded into the attestation hash so tampering is
// cryptographically detectable. See SCHEMA-v1.5.md for the canonical
// preimage encoding.
export const ATTESTATION_SCHEME_V2_1 =
  'sha256:block_hash+ram_snapshot_hash+svbk+signed_wallet+session_sequence+ivs_commitment+party_slot_index:v2.1';

// v1.5 schema constants. The two-inscription protocol stays (capture_commit
// receipt + mint NFT) but ops are renamed for marketplace cleanliness:
//   capture (v1.4) -> capture_commit (v1.5) — opaque receipt, hors collection
//   reveal  (v1.4) -> mint            (v1.5) — canonical NFT, marketplace-ready
export const CAPTURE_COMMIT_OP_V1_5 = 'capture_commit';
export const MINT_OP_V1_5 = 'mint';
export const SCHEMA_VERSION_V1_5 = '1.5';
export const RAM_COMMITMENT_SCHEME_V1 = 'sha256:wram8k:v1';
export const RAM_WITNESS_SCHEME_FULL_V1 = 'full_wram8k:v1';

// Default scheme exported as ATTESTATION_SCHEME for code that references
// "the current one". All NEW captures emit v2.1 under schema 1.5; v2 + v1.1
// constants are retained so legacy records validate.
export const ATTESTATION_SCHEME = ATTESTATION_SCHEME_V2_1;

// Legacy v1.4 schema constants (kept for the deprecated v1.4 builders below
// + indexer legacy reads). New code uses SCHEMA_VERSION_V1_5.
export const CAPTURE_SCHEMA_VERSION = '1.4';
export const REVEAL_SCHEMA_VERSION = '1.4';

export const BLOCK_HASH_HEX_RE = /^[0-9a-f]{64}$/i;

const ELECTRS_BASE_URLS = {
  mainnet: 'https://api.nintondo.io',
  'bells-mainnet': 'https://api.nintondo.io',
  bellsMainnet: 'https://api.nintondo.io',
  testnet: 'https://bells-testnet-api.nintondo.io',
  'bells-testnet': 'https://bells-testnet-api.nintondo.io',
  bellsTestnet: 'https://bells-testnet-api.nintondo.io',
};

// Gen 2 Crystal RAM addresses. Generated from pokecrystal.sym (bank-stripped,
// addresses are WRAMX/WRAM raw). Regenerate with
// `node tools/extract-crystal-ram-addrs.mjs --sym Z:/pokecrystal/pokecrystal.sym`
// after rebuilding pokecrystal. All addresses in 0xD000..0xDFFF require
// SVBK = 1 at read time (banked WRAMX - see WRAM-1 note below + the Crystal
// migration doc).
//
// HP fields point at the HIGH byte (word start) — Pokemon stats are 16-bit
// big-endian. Always consume via readWord(readByte, RAM_ADDRS.enemyHpCurrent).
export const RAM_ADDRS = {
  teamCount: 0xdcd7,         // wPartyCount
  teamSlotBase: 0xdcdf,      // wPartyMon1 (48 B each)
  teamSlotSize: 48,
  otNamesBase: 0xddff,       // wPartyMon1OT (11 B each)
  nicknamesBase: 0xde41,     // wPartyMon1Nickname (11 B each)
  battleStatus: 0xd22d,      // wBattleMode (0=overworld, 1=wild, 2=trainer)
  enemySpecies: 0xd206,      // wEnemyMonSpecies (= wEnemyMon byte 0)
  enemyMonStatus: 0xd214,    // wEnemyMonStatus
  enemyHpCurrent: 0xd216,    // wEnemyMonHP (word, big-endian; readWord)
  enemyHpMax: 0xd218,        // wEnemyMonMaxHP (word)
  enemyCatchRate: 0xd22b,    // wEnemyMonCatchRate
  mapGroup: 0xdcb5,          // wMapGroup
  mapId: 0xdcb6,             // wMapNumber
  hallOfFameFlags: 0xd84c,   // wStatusFlags (bitfield, HoF among flags)
  johtoBadges: 0xd857,       // wJohtoBadges
};

// Gen 2 PARTYMON_STRUCT_LENGTH = 48 bytes. BOXMON prefix = 32 bytes; battle
// stats (status..SDF) live only in the live party, not in PC boxes. Offsets
// mirror constants/pokemon_data_constants.asm MON_* in pokecrystal.
export const PARTY_OFFSETS = {
  species: 0,         // MON_SPECIES
  heldItem: 1,        // MON_ITEM
  moves: 2,           // MON_MOVES (4 bytes)
  originalTrainerId: 6, // MON_OT_ID (2 bytes)
  experience: 8,      // MON_EXP (3 bytes)
  hpExp: 11,          // MON_HP_EXP (2 bytes)
  atkExp: 13,
  defExp: 15,
  speExp: 17,
  spcExp: 19,         // Gen 2 kept combined Special EV for backward compat
  attackDefenseDv: 21, // MON_DVS byte 0 (ATK high nibble, DEF low nibble)
  speedSpecialDv: 22,  // MON_DVS byte 1 (SPD high nibble, SPC low nibble)
  pp: 23,             // MON_PP (4 bytes)
  happiness: 27,      // MON_HAPPINESS (friendship, 0-255)
  pokerus: 28,        // MON_POKERUS
  caughtData: 29,     // MON_CAUGHTDATA (2 bytes: time/level + gender/location)
  level: 31,          // MON_LEVEL (end of BOXMON prefix; BOXMON_STRUCT_LENGTH = 32)
  status: 32,         // MON_STATUS
  currentHp: 34,      // MON_HP (2 bytes)
  maxHp: 36,          // MON_MAXHP (2 bytes)
  attack: 38,         // MON_STATS (ATK/DEF/SPD/SAT/SDF, 2 bytes each)
  defense: 40,
  speed: 42,
  specialAttack: 44,  // Gen 2 split Special into SpAtk/SpDef for battle stats
  specialDefense: 46,
};

export const POKEBELLS_COLLECTION_NAME = 'PokeBells';
export const POKEBELLS_COLLECTION_SLUG = 'pokebells';
export const GEN2_UNSUPPORTED_LABEL = 'N/A (Gen 2)';

function getFetch(fetchImpl) {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (typeof resolved !== 'function') {
    throw new Error('fetch() is not available in this runtime.');
  }
  return resolved;
}

function textEncoder() {
  return new TextEncoder();
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return textEncoder().encode(String(value ?? ''));
}

function concatBytes(parts) {
  const chunks = parts.map((part) => toUint8Array(part));
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function encodeBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

export function decodeBase64(base64Value) {
  if (typeof base64Value !== 'string') {
    throw new Error('Expected a base64 string.');
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64Value, 'base64'));
  }

  const binary = atob(base64Value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sha256Bytes(parts) {
  const input = concatBytes(parts);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
    return new Uint8Array(digest);
  }

  const { createHash } = await import('node:crypto');
  const digest = createHash('sha256').update(Buffer.from(input)).digest();
  return new Uint8Array(digest);
}

export async function sha256Hex(parts) {
  return bytesToHex(await sha256Bytes(parts));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function byteToHex(value) {
  return `0x${(value & 0xff).toString(16).padStart(2, '0').toUpperCase()}`;
}

export function wordToHex(value) {
  return `0x${(value & 0xffff).toString(16).padStart(4, '0').toUpperCase()}`;
}

export function readWord(readByte, address) {
  return ((readByte(address) & 0xff) << 8) | (readByte(address + 1) & 0xff);
}

export function readTripleByte(readByte, address) {
  return (
    ((readByte(address) & 0xff) << 16) |
    ((readByte(address + 1) & 0xff) << 8) |
    (readByte(address + 2) & 0xff)
  );
}

export function statusNameFromByte(statusByte) {
  const value = statusByte & 0xff;
  if (value === 0) {
    return 'none';
  }
  if (value & 0x07) {
    return 'sleep';
  }
  if (value & 0x08) {
    return 'poison';
  }
  if (value & 0x10) {
    return 'burn';
  }
  if (value & 0x20) {
    return 'freeze';
  }
  if (value & 0x40) {
    return 'paralyze';
  }
  return 'unknown';
}

export function statusBonusFor(statusName) {
  if (statusName === 'sleep' || statusName === 'freeze') {
    return 1.5;
  }
  if (statusName === 'paralyze' || statusName === 'burn' || statusName === 'poison') {
    return 1.2;
  }
  return 1;
}

export function computeCatchChance({
  catchRate,
  currentHp,
  maxHp,
  status = 'none',
  ballBonus = 1,
}) {
  if (!Number.isFinite(catchRate) || !Number.isFinite(currentHp) || !Number.isFinite(maxHp)) {
    return null;
  }
  if (catchRate <= 0 || maxHp <= 0) {
    return null;
  }

  const safeCurrentHp = clamp(currentHp, 0, maxHp);
  const raw =
    (catchRate * ((maxHp * 3) - (safeCurrentHp * 2))) / (maxHp * 3) *
    ballBonus *
    statusBonusFor(status);

  return clamp(raw, 0, 255);
}

export function catchChancePercent(chance) {
  if (!Number.isFinite(chance)) {
    return null;
  }
  return clamp((chance / 255) * 100, 0, 100);
}

// Gen 1 / Gen 2 share the same 2-byte DV packing: first byte is ATK|DEF, second
// is SPD|SPC (each 4-bit nibble). The function is named parseGbcDvs because it
// covers the whole GB/GBC pre-IV era, and historical field names (ivs.atk etc.)
// are preserved for schema-v1.2 compatibility.
export function parseGbcDvs(attackDefenseByte, speedSpecialByte) {
  return {
    atk: (attackDefenseByte >> 4) & 0x0f,
    def: attackDefenseByte & 0x0f,
    spe: (speedSpecialByte >> 4) & 0x0f,
    spd: speedSpecialByte & 0x0f,
  };
}

function specialIvFrom(ivs = {}) {
  return ivs.spc ?? ivs.spd ?? null;
}

// HP DV formula unchanged between Gen 1 and Gen 2: LSB of each other DV is
// OR-shifted into a 4-bit result (ATK<<3 | DEF<<2 | SPD<<1 | SPC).
export function deriveGbcHpIv(ivs) {
  const special = specialIvFrom(ivs) ?? 0;
  return (
    ((ivs.atk & 0x01) << 3) |
    ((ivs.def & 0x01) << 2) |
    ((ivs.spe & 0x01) << 1) |
    (special & 0x01)
  );
}

// Gen 2 shiny rule: ATK DV = 10 AND DEF, SPD, SPC DVs each ∈ {2,3,6,7,10,11,
// 14,15}. Source: pokecrystal engine/pokemon/shiny.asm. Odds ~1/8192.
// The "magic" set is DVs with bit 1 set (value & 2 == 2).
export function isGen2Shiny(dvs) {
  const magicSet = (value) => ((value ?? 0) & 0x02) === 0x02;
  return (
    (dvs?.atk ?? 0) === 10 &&
    magicSet(dvs?.def) &&
    magicSet(dvs?.spe) &&
    magicSet(dvs?.spd)
  );
}

// Back-compat re-exports: upstream code (and inscribed modules) referenced the
// Gen 1-prefixed names before the Crystal pivot. Keep them available as
// aliases so the capture record can be read by older tools during the
// schema-v1.2 -> v1.3 transition.
export const parseGen1Dvs = parseGbcDvs;
export const deriveGen1HpIv = deriveGbcHpIv;

export function normalizeNetworkKey(network) {
  const value = String(network ?? '').trim();
  switch (value) {
    case 'mainnet':
    case 'bells-mainnet':
    case 'bellsMainnet':
      return 'bells-mainnet';
    case 'testnet':
    case 'bells-testnet':
    case 'bellsTestnet':
      return 'bells-testnet';
    default:
      return value || 'bells-mainnet';
  }
}

export function resolveElectrsBaseUrl(network) {
  const normalized = normalizeNetworkKey(network);
  return ELECTRS_BASE_URLS[normalized] ?? ELECTRS_BASE_URLS['bells-mainnet'];
}

export function buildBlockTipHashUrl(network) {
  return `${resolveElectrsBaseUrl(network)}/blocks/tip/hash`;
}

export function buildBlockByHashUrl(blockHash, network) {
  return `${resolveElectrsBaseUrl(network)}/block/${blockHash}`;
}

export async function fetchBlockTipHash(options = {}) {
  const response = await getFetch(options.fetchImpl)(buildBlockTipHashUrl(options.network), {
    headers: { accept: 'text/plain,application/json' },
  });
  if (!response.ok) {
    throw new Error(`Block tip hash fetch failed (${response.status}).`);
  }

  const blockHash = (await response.text()).trim();
  if (!BLOCK_HASH_HEX_RE.test(blockHash)) {
    throw new Error(`Unexpected block tip hash response: ${blockHash}`);
  }

  return blockHash.toLowerCase();
}

export async function assertBlockHashExists(blockHash, options = {}) {
  const normalized = String(blockHash ?? '').trim().toLowerCase();
  if (!BLOCK_HASH_HEX_RE.test(normalized)) {
    throw new Error('block_hash_at_capture must be a 64-char hex hash.');
  }

  const response = await getFetch(options.fetchImpl)(buildBlockByHashUrl(normalized, options.network), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Block hash lookup failed (${response.status}).`);
  }

  return true;
}

// Snapshot Crystal WRAM for attestation v1.1. Host the caller supplies:
//   readByte(address) -> byte (required)
//   writeByte(address, value) -> optional; when present, the snapshot forces
//     SVBK=1 before reading the 0xD000..0xDFFF half and restores the prior
//     SVBK value afterwards. This is the production path for Crystal.
// Without writeByte (unit tests / legacy v1 callers), the snapshot reads both
// windows blind and the SVBK byte records whatever the emulator's current
// bank was — verifiers can detect bank-switching issues via a mismatched
// SVBK field.
export function readRamSnapshot(readByte, options = {}) {
  const writeByte = options.writeByte ?? null;
  const bank0Bytes = new Uint8Array(WRAM_BANK0_BYTE_LENGTH);
  for (let i = 0; i < WRAM_BANK0_BYTE_LENGTH; i += 1) {
    bank0Bytes[i] = readByte(WRAM_BANK0_START + i) & 0xff;
  }

  const originalSvbk = readByte(SVBK_REGISTER) & 0xff;
  // SVBK actual bank = value & 0x07; bank 0 selection reads as bank 1 on real
  // hardware, so the effective-bank byte is max(1, value & 7).
  const effectiveBankBefore = Math.max(1, originalSvbk & 0x07);
  let effectiveBankDuringRead = effectiveBankBefore;
  if (typeof writeByte === 'function' && effectiveBankBefore !== 1) {
    writeByte(SVBK_REGISTER, (originalSvbk & ~0x07) | 0x01);
    effectiveBankDuringRead = 1;
  }

  const bank1Bytes = new Uint8Array(WRAM_BANK1_BYTE_LENGTH);
  for (let i = 0; i < WRAM_BANK1_BYTE_LENGTH; i += 1) {
    bank1Bytes[i] = readByte(WRAM_BANK1_START + i) & 0xff;
  }

  if (typeof writeByte === 'function' && effectiveBankBefore !== 1) {
    writeByte(SVBK_REGISTER, originalSvbk);
  }

  const bytes = new Uint8Array(WRAM_BYTE_LENGTH);
  bytes.set(bank0Bytes, 0);
  bytes.set(bank1Bytes, WRAM_BANK0_BYTE_LENGTH);

  return { bytes, svbk: effectiveBankDuringRead & 0xff };
}

// v1.1 attestation (legacy): hashes the full ram_snapshot bytes. Used by
// capture records at schema 1.3. Kept for validator backward-compat.
export async function computeCaptureAttestationV1_1({
  blockHashAtCapture,
  ramSnapshotBytes,
  svbk,
  signedInWallet,
  sessionSequenceNumber,
}) {
  const svbkByte = new Uint8Array([Number(svbk ?? 0) & 0xff]);
  return sha256Hex([
    String(blockHashAtCapture ?? '').trim().toLowerCase(),
    ramSnapshotBytes,
    svbkByte,
    String(signedInWallet ?? ''),
    String(sessionSequenceNumber ?? ''),
  ]);
}

// v2 attestation (commit-reveal): hashes the ram_snapshot HASH (not the raw
// bytes) plus the IV commitment. Allows the capture record to be fully
// verifiable before the reveal is inscribed, without ever carrying raw
// IVs or raw ram_snapshot on-chain.
export async function computeCaptureAttestationV2({
  blockHashAtCapture,
  ramSnapshotHashHex,
  svbk,
  signedInWallet,
  sessionSequenceNumber,
  ivsCommitmentHex,
}) {
  const svbkByte = new Uint8Array([Number(svbk ?? 0) & 0xff]);
  return sha256Hex([
    String(blockHashAtCapture ?? '').trim().toLowerCase(),
    String(ramSnapshotHashHex ?? '').trim().toLowerCase(),
    svbkByte,
    String(signedInWallet ?? ''),
    String(sessionSequenceNumber ?? ''),
    String(ivsCommitmentHex ?? '').trim().toLowerCase(),
  ]);
}

// v2.1 attestation (schema 1.5): identical to v2 plus a trailing
// party_slot_index byte. See SCHEMA-v1.5.md "Attestation v2.1 — canonical
// encoding". Pinning the slot prevents a minter from swapping which of the
// six party slots the mint references after the commit is on-chain.
export async function computeCaptureAttestationV2_1({
  blockHashAtCapture,
  ramSnapshotHashHex,
  svbk,
  signedInWallet,
  sessionSequenceNumber,
  ivsCommitmentHex,
  partySlotIndex,
}) {
  const svbkByte = new Uint8Array([Number(svbk ?? 0) & 0xff]);
  const slotByte = new Uint8Array([Number(partySlotIndex ?? 0) & 0xff]);
  return sha256Hex([
    String(blockHashAtCapture ?? '').trim().toLowerCase(),
    String(ramSnapshotHashHex ?? '').trim().toLowerCase(),
    svbkByte,
    String(signedInWallet ?? ''),
    String(sessionSequenceNumber ?? ''),
    String(ivsCommitmentHex ?? '').trim().toLowerCase(),
    slotByte,
  ]);
}

// Default exported name resolves to the current (v2.1) path.
export const computeCaptureAttestation = computeCaptureAttestationV2_1;

// Canonical JSON for IV commitment is a deterministic ordering - atk, def,
// spe, spd (not spc alias) - so every client + the indexer compute the
// same bytes. Using JSON.stringify with a fixed key order rather than
// Object.entries avoids implementation quirks.
function canonicalIvsBytes(ivs) {
  const atk = Number.isInteger(ivs?.atk) ? ivs.atk : 0;
  const def = Number.isInteger(ivs?.def) ? ivs.def : 0;
  const spe = Number.isInteger(ivs?.spe) ? ivs.spe : 0;
  const spd = Number.isInteger(ivs?.spd) ? ivs.spd : (Number.isInteger(ivs?.spc) ? ivs.spc : 0);
  return new TextEncoder().encode(
    `{"atk":${atk},"def":${def},"spe":${spe},"spd":${spd}}`,
  );
}

export async function computeIvsCommitment(ivs, saltBytes) {
  const salt = saltBytes instanceof Uint8Array ? saltBytes : new Uint8Array(saltBytes ?? []);
  if (salt.byteLength !== 32) {
    throw new Error('ivs commitment salt must be 32 bytes');
  }
  return sha256Hex([canonicalIvsBytes(ivs), salt]);
}

export async function computeRamSnapshotHash(ramSnapshotBytes) {
  const bytes = ramSnapshotBytes instanceof Uint8Array
    ? ramSnapshotBytes
    : new Uint8Array(ramSnapshotBytes ?? []);
  return sha256Hex([bytes]);
}

// Read the full 32 KB cart SRAM by walking the four MBC3 banks. Requires
// BOTH readByte and writeByte because we drive the cart's bank-select +
// ram-enable registers. Restores the cart's prior SRAM bank and RAM-enable
// state on return so the running game keeps its pre-snapshot configuration.
//
// binjgb's _emulator_write_ext_ram has an OOB on Crystal (see
// isCrystalRom short-circuit in shell.js) BUT this helper doesn't touch
// that API — it emulates what the CPU would do and uses only the generic
// read_mem / write_mem interface, which is safe.
export function readSramSnapshot(readByte, writeByte) {
  if (typeof readByte !== 'function' || typeof writeByte !== 'function') {
    throw new Error('readSramSnapshot needs both readByte and writeByte');
  }
  // Record current SRAM bank (MBC3 tracks it internally; best we can do
  // is probe via write-then-read of a sentinel — but Crystal itself doesn't
  // read this register, so reading 0xA000 pre-select is the same across
  // runs). We simply drive to banks 0..3 and restore to bank 0 at the end,
  // which is Crystal's default and what the game uses during gameplay.
  writeByte(SRAM_RAM_ENABLE_ADDR, 0x0a);

  const bytes = new Uint8Array(SRAM_TOTAL_BYTE_LENGTH);
  for (let bank = 0; bank < SRAM_BANK_COUNT; bank += 1) {
    writeByte(SRAM_BANK_SELECT_ADDR, bank & 0x03);
    for (let offset = 0; offset < SRAM_BANK_BYTE_LENGTH; offset += 1) {
      bytes[bank * SRAM_BANK_BYTE_LENGTH + offset] =
        readByte(SRAM_WINDOW_START + offset) & 0xff;
    }
  }

  // Restore safe default (bank 0 selected). Do NOT disable RAM afterwards:
  // Crystal's save code re-enables it on each access, but a few global
  // interrupt handlers expect RAM-enable to stay as the game left it.
  writeByte(SRAM_BANK_SELECT_ADDR, 0x00);

  return bytes;
}

// Inverse of readSramSnapshot: blits a 32 KB SRAM buffer into the cart,
// bank by bank. Used when restoring a save-snapshot fetched from chain.
export function writeSramSnapshot(writeByte, readByte, sramBytes) {
  if (!(sramBytes instanceof Uint8Array) || sramBytes.byteLength !== SRAM_TOTAL_BYTE_LENGTH) {
    throw new Error(`sramBytes must be a ${SRAM_TOTAL_BYTE_LENGTH}-byte Uint8Array`);
  }
  if (typeof writeByte !== 'function') {
    throw new Error('writeSramSnapshot needs writeByte');
  }
  writeByte(SRAM_RAM_ENABLE_ADDR, 0x0a);

  for (let bank = 0; bank < SRAM_BANK_COUNT; bank += 1) {
    writeByte(SRAM_BANK_SELECT_ADDR, bank & 0x03);
    const base = bank * SRAM_BANK_BYTE_LENGTH;
    for (let offset = 0; offset < SRAM_BANK_BYTE_LENGTH; offset += 1) {
      writeByte(SRAM_WINDOW_START + offset, sramBytes[base + offset] & 0xff);
    }
  }

  writeByte(SRAM_BANK_SELECT_ADDR, 0x00);
}

// Build an op:"save-snapshot" inscription body from a captured SRAM buffer.
// The sram blob is base64-encoded raw bytes (MVP). Encryption via wallet-
// derived key is a v1.5 follow-up — for now the save is public, which is
// acceptable for the testnet PoC where the user is the sole operator.
// `save_version` must strictly increase per wallet+rom; the indexer rejects
// replayed or stale versions.
export async function buildSaveSnapshotRecord({
  signedInWallet,
  captureNetwork,
  gameRom,
  gameRomSha256,
  sramBytes,
  saveVersion,
  blockHashAtSave = null,
  signature = null,
  now = new Date().toISOString(),
}) {
  if (!signedInWallet) throw new Error('signedInWallet required');
  if (!gameRomSha256) throw new Error('gameRomSha256 required');
  if (!(sramBytes instanceof Uint8Array)) throw new Error('sramBytes must be Uint8Array');
  if (sramBytes.byteLength !== SRAM_TOTAL_BYTE_LENGTH) {
    throw new Error(`sramBytes must be ${SRAM_TOTAL_BYTE_LENGTH} bytes`);
  }
  if (!Number.isInteger(saveVersion) || saveVersion < 1) {
    throw new Error('saveVersion must be positive integer');
  }
  const sramSha256Hex = await sha256Hex([sramBytes]);
  const network = normalizeNetworkKey(captureNetwork);

  return {
    schema_version: REVEAL_SCHEMA_VERSION,
    p: 'pokebells',
    op: 'save-snapshot',
    signed_in_wallet: signedInWallet,
    capture_network: network,
    game_rom: gameRom ?? null,
    game_rom_sha256: gameRomSha256,
    sram_encoding: 'base64',
    sram_compression: null,       // v1.5: deflate-raw
    sram_encryption: null,        // v1.5: aes-256-gcm via wallet-derived key
    sram: encodeBase64(sramBytes),
    sram_sha256: sramSha256Hex,
    sram_byte_length: SRAM_TOTAL_BYTE_LENGTH,
    save_scheme: SAVE_SNAPSHOT_SCHEME,
    save_version: saveVersion,
    block_hash_at_save: blockHashAtSave,
    signature_scheme: signature ? SAVE_SNAPSHOT_SIG_SCHEME : null,
    signature, // null until Bells signMessage is probed — indexer accepts
               // unsigned saves on testnet but MUST require sig on mainnet.
    saved_at: now,
  };
}

export async function validateSaveSnapshotRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') errors.push('record must be an object');
  else {
    if (record.p !== 'pokebells') errors.push('p must equal "pokebells"');
    if (record.op !== 'save-snapshot') errors.push('op must equal "save-snapshot"');
    if (record.sram_encoding !== 'base64') errors.push('sram_encoding must equal "base64"');
    if (record.save_scheme !== SAVE_SNAPSHOT_SCHEME) {
      errors.push(`save_scheme must equal "${SAVE_SNAPSHOT_SCHEME}"`);
    }
    if (typeof record.signed_in_wallet !== 'string' || !record.signed_in_wallet.trim()) {
      errors.push('signed_in_wallet required');
    }
    if (!Number.isInteger(record.save_version) || record.save_version < 1) {
      errors.push('save_version must be positive integer');
    }
    if (!/^[0-9a-f]{64}$/i.test(String(record.game_rom_sha256 ?? ''))) {
      errors.push('game_rom_sha256 must be 64-char hex');
    }
    if (!/^[0-9a-f]{64}$/i.test(String(record.sram_sha256 ?? ''))) {
      errors.push('sram_sha256 must be 64-char hex');
    }
    // Validate sram bytes match the claimed sha.
    let decoded;
    try { decoded = decodeBase64(record.sram ?? ''); }
    catch (e) { errors.push(`sram base64 decode failed: ${e.message}`); }
    if (decoded) {
      if (decoded.byteLength !== SRAM_TOTAL_BYTE_LENGTH) {
        errors.push(`sram must decode to ${SRAM_TOTAL_BYTE_LENGTH} bytes`);
      } else {
        const actualSha = await sha256Hex([decoded]);
        if (actualSha !== String(record.sram_sha256).toLowerCase()) {
          errors.push('sram_sha256 does not match decoded bytes');
        }
      }
    }
  }
  return { ok: errors.length === 0, errors, error: errors[0] ?? null };
}

export function generateIvSaltBytes() {
  const bytes = new Uint8Array(32);
  (globalThis.crypto ?? globalThis.crypto).getRandomValues(bytes);
  return bytes;
}

// buildCaptureProvenance orchestrates the per-capture provenance fields.
// Under schema 1.4 (commit-reveal) the returned object does NOT contain the
// raw ram_snapshot or raw IVs — only commitments (hashes). The raw bytes
// live in the optional `privateReveal` field for the caller to persist
// locally until the user publishes the reveal inscription.
export async function buildCaptureProvenance(readByte, options = {}) {
  const captureNetwork = normalizeNetworkKey(options.network);
  const sessionSequenceNumber = options.sessionSequenceNumber;
  if (!Number.isInteger(sessionSequenceNumber) || sessionSequenceNumber < 1) {
    throw new Error('sessionSequenceNumber must be a positive integer.');
  }

  // Reveal-mode helpers: caller supplies the already-parsed IVs (read from
  // the party struct before this call) plus an optional pre-generated salt.
  // When absent we generate both. This lets unit tests pin the salt for
  // reproducible attestations.
  const ivs = options.ivs ?? null;
  if (!ivs) {
    throw new Error('buildCaptureProvenance requires options.ivs for schema 1.4');
  }
  const saltBytes = options.ivsSaltBytes ?? generateIvSaltBytes();
  if (!(saltBytes instanceof Uint8Array) || saltBytes.byteLength !== 32) {
    throw new Error('options.ivsSaltBytes must be a 32-byte Uint8Array');
  }
  const ivsCommitmentHex = await computeIvsCommitment(ivs, saltBytes);

  // Snapshot: supports v1-style pre-built buffer (for unit tests) OR a live
  // emulator bridge with bank-switching via writeByte.
  let ramSnapshotBytes;
  let svbkAtCapture;
  if (options.ramSnapshotBytes) {
    ramSnapshotBytes = options.ramSnapshotBytes;
    svbkAtCapture = Number.isInteger(options.svbk) ? options.svbk & 0xff : 0x01;
  } else {
    const snapshot = readRamSnapshot(readByte, {
      ...(options.ramWindow ?? {}),
      writeByte: options.writeByte ?? null,
    });
    ramSnapshotBytes = snapshot.bytes;
    svbkAtCapture = snapshot.svbk;
  }
  const ramSnapshotHashHex = await computeRamSnapshotHash(ramSnapshotBytes);

  const blockHashAtCapture = (options.blockHashAtCapture ?? await fetchBlockTipHash({
    network: captureNetwork,
    fetchImpl: options.fetchImpl,
  })).toLowerCase();

  const attestationHex = await computeCaptureAttestationV2({
    blockHashAtCapture,
    ramSnapshotHashHex,
    svbk: svbkAtCapture,
    signedInWallet: options.signedInWallet ?? '',
    sessionSequenceNumber,
    ivsCommitmentHex,
  });

  // Public record: everything safe to inscribe on-chain.
  const publicRecord = {
    capture_network: captureNetwork,
    block_hash_at_capture: blockHashAtCapture,
    signed_in_wallet: options.signedInWallet ?? null,
    session_sequence_number: sessionSequenceNumber,
    ram_snapshot_encoding: null, // v1.4: snapshot is hashed, not carried
    ram_snapshot: null,
    ram_snapshot_hash: ramSnapshotHashHex,
    svbk_at_capture: svbkAtCapture,
    ivs_commitment: ivsCommitmentHex,
    ivs_commitment_scheme: IVS_COMMITMENT_SCHEME,
    attestation_scheme: ATTESTATION_SCHEME_V2,
    attestation: attestationHex,
  };

  // Private-reveal material: NEVER published with the capture. The caller
  // persists this locally (IndexedDB keyed by attestation) and uses it later
  // to build the op:"reveal" inscription via buildRevealRecord.
  const privateReveal = {
    ivs,
    ivs_salt_hex: bytesToHex(saltBytes),
    ram_snapshot_base64: encodeBase64(ramSnapshotBytes),
  };

  return { ...publicRecord, privateReveal };
}

function normalizeSpeciesName(speciesName, speciesNo) {
  if (speciesName) {
    return speciesName;
  }
  return Number.isFinite(speciesNo) ? `Species ${speciesNo}` : 'Unknown Pokemon';
}

function makeTrait(traitType, value) {
  return { trait_type: traitType, value };
}

function resolveSpriteImageUrl(resolver, speciesNo, shiny) {
  if (typeof resolver !== 'function') {
    return null;
  }
  try {
    const url = resolver(speciesNo, Boolean(shiny));
    return typeof url === 'string' && url.length ? url : null;
  } catch {
    return null;
  }
}

export function buildSpriteImageResolver(spritePackManifest, { contentBaseUrl = '' } = {}) {
  if (!spritePackManifest || spritePackManifest.p !== 'pokebells-sprites' || spritePackManifest.v !== 1) {
    return null;
  }
  const sprites = spritePackManifest.sprites;
  if (!sprites || typeof sprites !== 'object') {
    return null;
  }
  const base = String(contentBaseUrl ?? '');

  return (speciesNo, shiny) => {
    const entry = sprites[String(speciesNo)];
    if (!entry) return null;
    const inscriptionId = shiny ? entry.shiny_inscription_id : entry.normal_inscription_id;
    if (typeof inscriptionId !== 'string' || !inscriptionId || inscriptionId.startsWith('REPLACE_ME_')) {
      return null;
    }
    return base ? `${base.replace(/\/?$/, '/')}${inscriptionId}` : inscriptionId;
  };
}

export function normalizeSpeciesId(record) {
  if (Number.isInteger(record?.species_id)) {
    return record.species_id;
  }
  if (Number.isInteger(record?.species)) {
    return record.species;
  }
  return null;
}

function resolveSpeciesEntry(record, options) {
  const speciesId = normalizeSpeciesId(record);
  if (!Number.isInteger(speciesId)) {
    return null;
  }
  if (typeof options.resolveSpeciesByDexNo === 'function') {
    return options.resolveSpeciesByDexNo(speciesId) ?? null;
  }
  return options.speciesCatalog?.byDexNo?.get?.(speciesId) ?? null;
}

function pushError(errors, message) {
  errors.push(message);
}

export function buildCapturedPokemonRecord(readByte, options = {}) {
  const {
    slotIndex,
    now = new Date().toISOString(),
    romName = null,
    mintContext = {},
    speciesResolver = null,
    captureNetwork = null,
    captureProvenance = null,
    resolveSpriteImage = null,
  } = options;

  const slotBase = RAM_ADDRS.teamSlotBase + ((slotIndex - 1) * RAM_ADDRS.teamSlotSize);
  const statusByte = readByte(slotBase + PARTY_OFFSETS.status);
  const status = statusNameFromByte(statusByte);
  const internalSpeciesId = readByte(slotBase + PARTY_OFFSETS.species);
  const heldItemId = readByte(slotBase + PARTY_OFFSETS.heldItem);
  const friendship = readByte(slotBase + PARTY_OFFSETS.happiness);
  const pokerus = readByte(slotBase + PARTY_OFFSETS.pokerus);
  const caughtDataHi = readByte(slotBase + PARTY_OFFSETS.caughtData);
  const caughtDataLo = readByte(slotBase + PARTY_OFFSETS.caughtData + 1);
  const speciesInfo = typeof speciesResolver === 'function' ? speciesResolver(internalSpeciesId) : null;
  const speciesNo = speciesInfo?.dexNo ?? internalSpeciesId;
  const speciesName = normalizeSpeciesName(speciesInfo?.name, speciesNo);
  const level = readByte(slotBase + PARTY_OFFSETS.level);
  const mintedBy = mintContext.mintedBy ?? null;
  const mintedAtBlock = mintContext.mintedAtBlock ?? null;

  // Schema 1.4: the public record hides IVs / derived_ivs / EVs / shiny
  // behind the commitment in captureProvenance. They are only published via
  // the separate op:"reveal" inscription (see buildRevealRecord). The
  // nft_metadata attributes list shows "Hidden (revealed on chain after
  // capture mint)" so marketplaces that index pre-reveal traits don't
  // mis-display as if they were zero.
  const hiddenLabel = 'Hidden (revealed after mint)';
  const metadataAttributes = [
    makeTrait('Collection', POKEBELLS_COLLECTION_NAME),
    makeTrait('Pokemon', speciesName),
    makeTrait('Dex No', speciesNo),
    makeTrait('Level', level),
    makeTrait('Shiny', hiddenLabel),
    makeTrait('Status', status),
    makeTrait('Friendship', friendship),
    makeTrait('Held Item', heldItemId === 0 ? 'None' : `ITEM_${heldItemId}`),
    makeTrait('Nature', GEN2_UNSUPPORTED_LABEL),
    makeTrait('Ability', GEN2_UNSUPPORTED_LABEL),
    makeTrait('IV HP', hiddenLabel),
    makeTrait('IV Attack', hiddenLabel),
    makeTrait('IV Defense', hiddenLabel),
    makeTrait('IV Speed', hiddenLabel),
    makeTrait('IV Special', hiddenLabel),
    makeTrait('EV HP', hiddenLabel),
    makeTrait('EV Attack', hiddenLabel),
    makeTrait('EV Defense', hiddenLabel),
    makeTrait('EV Speed', hiddenLabel),
    makeTrait('EV Special', hiddenLabel),
  ];

  return {
    schema_version: CAPTURE_SCHEMA_VERSION,
    p: 'pokebells',
    op: 'capture',
    inscription_id: null,
    collection_name: POKEBELLS_COLLECTION_NAME,
    collection_slug: POKEBELLS_COLLECTION_SLUG,
    species: speciesNo,
    species_id: speciesNo,
    species_name: speciesName,
    level,
    // IVs / derived_ivs / EVs / shiny are hidden pre-reveal. The ivs_commitment
    // in provenance binds the capture to the IV values; the reveal inscription
    // proves them.
    ivs: null,
    derived_ivs: null,
    evs: null,
    shiny: null,
    moves: Array.from({ length: 4 }, (_, index) => readByte(slotBase + PARTY_OFFSETS.moves + index)),
    pp: Array.from({ length: 4 }, (_, index) => readByte(slotBase + PARTY_OFFSETS.pp + index) & 0x3f),
    status,
    catch_rate: speciesInfo?.catchRate ?? null,
    held_item: heldItemId,
    friendship,
    pokerus,
    nature: null,
    ability: null,
    active: slotIndex <= 6,
    minted_by: mintedBy,
    minted_at_block: mintedAtBlock,
    game_rom: romName,
    capture_network: captureProvenance?.capture_network ?? captureNetwork ?? null,
    block_hash_at_capture: captureProvenance?.block_hash_at_capture ?? null,
    signed_in_wallet: captureProvenance?.signed_in_wallet ?? null,
    session_sequence_number: captureProvenance?.session_sequence_number ?? null,
    ram_snapshot_encoding: captureProvenance?.ram_snapshot_encoding ?? null,
    ram_snapshot: captureProvenance?.ram_snapshot ?? null,
    ram_snapshot_hash: captureProvenance?.ram_snapshot_hash ?? null,
    svbk_at_capture: captureProvenance?.svbk_at_capture ?? null,
    ivs_commitment: captureProvenance?.ivs_commitment ?? null,
    ivs_commitment_scheme: captureProvenance?.ivs_commitment_scheme ?? null,
    attestation_scheme: captureProvenance?.attestation_scheme ?? null,
    attestation: captureProvenance?.attestation ?? null,
    reveal_inscription_id: null,
    captured_at: now,
    nft_metadata: {
      collection_name: POKEBELLS_COLLECTION_NAME,
      name: speciesName,
      description: `${speciesName} captured in ${romName ?? 'a Gen 2 Crystal ROM'} via PokeBells. IVs and EVs are hidden until the owner publishes the op:"reveal" inscription.`,
      image: resolveSpriteImageUrl(resolveSpriteImage, speciesNo, /* shiny unknown pre-reveal */ null),
      attributes: metadataAttributes,
      unsupported_gen2_fields: {
        nature: GEN2_UNSUPPORTED_LABEL,
        ability: GEN2_UNSUPPORTED_LABEL,
      },
      shiny_state: hiddenLabel,
    },
    context: {
      slot_index: slotIndex,
      slot_base: wordToHex(slotBase),
      hp: {
        current: readWord(readByte, slotBase + PARTY_OFFSETS.currentHp),
        max: readWord(readByte, slotBase + PARTY_OFFSETS.maxHp),
      },
      battle_stats: {
        attack: readWord(readByte, slotBase + PARTY_OFFSETS.attack),
        defense: readWord(readByte, slotBase + PARTY_OFFSETS.defense),
        speed: readWord(readByte, slotBase + PARTY_OFFSETS.speed),
        special_attack: readWord(readByte, slotBase + PARTY_OFFSETS.specialAttack),
        special_defense: readWord(readByte, slotBase + PARTY_OFFSETS.specialDefense),
      },
      caught_data: (caughtDataHi << 8) | caughtDataLo,
      original_trainer_id: readWord(readByte, slotBase + PARTY_OFFSETS.originalTrainerId),
      experience: readTripleByte(readByte, slotBase + PARTY_OFFSETS.experience),
      internal_species_id: internalSpeciesId,
      base_stats: speciesInfo ? {
        hp: speciesInfo.baseHp,
        atk: speciesInfo.baseAtk,
        def: speciesInfo.baseDef,
        spd: speciesInfo.baseSpd,
        sat: speciesInfo.baseSat,
        sdf: speciesInfo.baseSdf,
      } : null,
      type_ids: speciesInfo ? [speciesInfo.type1, speciesInfo.type2] : null,
      map_id: readByte(RAM_ADDRS.mapId),
      hall_of_fame_flags: readByte(RAM_ADDRS.hallOfFameFlags),
      battle_status_raw: readByte(RAM_ADDRS.battleStatus),
    },
  };
}

// Build the op:"reveal" inscription body. Pairs with a capture record that
// carries the matching ivs_commitment + ram_snapshot_hash. The reveal is
// immediately publishable once the capture inscription id is known.
export function buildRevealRecord({
  captureRecord,
  captureInscriptionId,
  privateReveal,
  readByte,
  slotBase,
  now = new Date().toISOString(),
}) {
  if (!captureRecord || captureRecord.op !== 'capture') {
    throw new Error('buildRevealRecord requires the matching capture record.');
  }
  if (!privateReveal?.ivs || !privateReveal.ivs_salt_hex || !privateReveal.ram_snapshot_base64) {
    throw new Error('buildRevealRecord requires privateReveal { ivs, ivs_salt_hex, ram_snapshot_base64 }');
  }

  const ivs = privateReveal.ivs;
  const derivedIvs = { hp: deriveGbcHpIv(ivs) };
  const shiny = isGen2Shiny(ivs);

  // EVs at reveal time reflect current party state if readByte + slotBase
  // are provided (slot may have levelled since capture). Fall back to
  // captured-time EVs cached in privateReveal if not.
  let evs = privateReveal.evs ?? null;
  if (!evs && typeof readByte === 'function' && Number.isInteger(slotBase)) {
    evs = {
      hp: readWord(readByte, slotBase + PARTY_OFFSETS.hpExp),
      atk: readWord(readByte, slotBase + PARTY_OFFSETS.atkExp),
      def: readWord(readByte, slotBase + PARTY_OFFSETS.defExp),
      spe: readWord(readByte, slotBase + PARTY_OFFSETS.speExp),
      spc: readWord(readByte, slotBase + PARTY_OFFSETS.spcExp),
    };
  }

  return {
    schema_version: REVEAL_SCHEMA_VERSION,
    p: 'pokebells',
    op: 'reveal',
    ref: captureInscriptionId ?? null,
    ref_attestation: captureRecord.attestation ?? null,
    signed_in_wallet: captureRecord.signed_in_wallet ?? null,
    ivs,
    derived_ivs: derivedIvs,
    shiny,
    evs,
    ivs_salt_hex: privateReveal.ivs_salt_hex,
    ram_snapshot_encoding: 'base64',
    ram_snapshot: privateReveal.ram_snapshot_base64,
    revealed_at: now,
  };
}

// op:"update" — level / EVs / moves / happiness / pokerus / held-item deltas
// after a capture has been minted. Indexer applies updates in block order;
// state at any point = capture + reveal + Σ(updates) + Σ(evolves).
//
// WARNING: `signature` is a placeholder for now. The Bells wallet signMessage
// format is still unprobed (see nintondo_signmessage_format.md). Until the
// indexer can verify sigs, update records are trusted on-wallet-match only.
// When signMessage is understood, compute `signature = wallet.signMessage(
// sha256(canonical(content_without_signature)))` and the indexer will check
// it matches the signed_in_wallet from the referenced capture.
export function buildUpdateRecord({
  captureRecord,
  captureInscriptionId,
  deltas = {},
  signedInWallet = null,
  signature = null,
  updatedAtBlock = null,
  now = new Date().toISOString(),
}) {
  if (!captureRecord || captureRecord.op !== 'capture') {
    throw new Error('buildUpdateRecord requires the matching capture record');
  }
  if (!captureInscriptionId) {
    throw new Error('buildUpdateRecord requires captureInscriptionId');
  }
  const wallet = signedInWallet ?? captureRecord.signed_in_wallet ?? null;
  if (!wallet) {
    throw new Error('buildUpdateRecord requires a signedInWallet to sign the delta');
  }

  // Filter deltas to a known allowlist. Nothing from the capture's commitment
  // can be overridden via updates — only progression state.
  const allowed = ['level', 'moves', 'pp', 'happiness', 'pokerus', 'held_item', 'status', 'evs'];
  const applied = {};
  for (const key of allowed) {
    if (deltas[key] !== undefined) applied[key] = deltas[key];
  }

  return {
    schema_version: REVEAL_SCHEMA_VERSION,
    p: 'pokebells',
    op: 'update',
    ref: captureInscriptionId,
    ref_attestation: captureRecord.attestation ?? null,
    signed_in_wallet: wallet,
    signature, // null until signMessage is wired; indexer rejects unsigned updates
    updated_at_block: updatedAtBlock,
    updated_at: now,
    ...applied,
  };
}

// op:"evolve" — species change (Cyndaquil → Quilava → Typhlosion).
// from_species_id must match the captured/current species at indexer-evaluate
// time. Indexer tracks current_species_id in the captures row; evolution is
// NOT a burn + re-mint — same inscription identity, new aggregated species.
export function buildEvolveRecord({
  captureRecord,
  captureInscriptionId,
  fromSpeciesId,
  toSpeciesId,
  evolveReason = 'level',           // 'level_N' | 'stone:ITEM_ID' | 'trade' | 'happiness_max'
  levelAtEvolve = null,
  newMovesLearned = [],
  signedInWallet = null,
  signature = null,
  evolvedAtBlock = null,
  now = new Date().toISOString(),
}) {
  if (!captureRecord || captureRecord.op !== 'capture') {
    throw new Error('buildEvolveRecord requires the matching capture record');
  }
  if (!captureInscriptionId) {
    throw new Error('buildEvolveRecord requires captureInscriptionId');
  }
  if (!Number.isInteger(fromSpeciesId) || fromSpeciesId < 1 || fromSpeciesId > 251) {
    throw new Error('fromSpeciesId must be integer 1..251');
  }
  if (!Number.isInteger(toSpeciesId) || toSpeciesId < 1 || toSpeciesId > 251) {
    throw new Error('toSpeciesId must be integer 1..251');
  }
  const wallet = signedInWallet ?? captureRecord.signed_in_wallet ?? null;
  if (!wallet) {
    throw new Error('buildEvolveRecord requires a signedInWallet');
  }

  return {
    schema_version: REVEAL_SCHEMA_VERSION,
    p: 'pokebells',
    op: 'evolve',
    ref: captureInscriptionId,
    ref_attestation: captureRecord.attestation ?? null,
    from_species_id: fromSpeciesId,
    to_species_id: toSpeciesId,
    evolve_reason: evolveReason,
    level_at_evolve: levelAtEvolve,
    new_moves_learned: Array.isArray(newMovesLearned) ? newMovesLearned.slice(0, 4) : [],
    signed_in_wallet: wallet,
    signature, // placeholder — indexer enforces once signMessage is wired
    evolved_at_block: evolvedAtBlock,
    evolved_at: now,
  };
}

// Strict check that a reveal record matches its capture's commitments.
// Returns { ok, errors, ivs, evs, shiny } for the indexer to apply once
// all fields pass.
export async function validateRevealRecord(revealRecord, captureRecord) {
  const errors = [];
  if (!revealRecord || revealRecord.p !== 'pokebells' || revealRecord.op !== 'reveal') {
    errors.push('reveal must have p:pokebells op:reveal');
    return { ok: false, errors };
  }
  if (!captureRecord || captureRecord.op !== 'capture') {
    errors.push('matching capture record is required');
    return { ok: false, errors };
  }
  if (revealRecord.ref_attestation && captureRecord.attestation
      && revealRecord.ref_attestation !== captureRecord.attestation) {
    errors.push('reveal.ref_attestation does not match capture.attestation');
  }

  const ivs = revealRecord.ivs ?? {};
  const saltHex = String(revealRecord.ivs_salt_hex ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(saltHex)) {
    errors.push('ivs_salt_hex must be 64-char hex (32 bytes)');
  }
  if (errors.length === 0) {
    const salt = new Uint8Array(saltHex.length / 2);
    for (let i = 0; i < salt.length; i += 1) {
      salt[i] = Number.parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
    }
    const expectedIvsCommitment = await computeIvsCommitment(ivs, salt);
    if (expectedIvsCommitment !== String(captureRecord.ivs_commitment ?? '').toLowerCase()) {
      errors.push('ivs_commitment does not match (ivs, salt) preimage');
    }
  }

  let ramBytes;
  try {
    ramBytes = decodeBase64(revealRecord.ram_snapshot ?? '');
  } catch (error) {
    errors.push(`ram_snapshot base64 decode failed: ${error.message}`);
  }
  if (ramBytes) {
    if (ramBytes.byteLength !== WRAM_BYTE_LENGTH) {
      errors.push(`ram_snapshot must decode to ${WRAM_BYTE_LENGTH} bytes`);
    } else {
      const ramHash = await computeRamSnapshotHash(ramBytes);
      if (ramHash !== String(captureRecord.ram_snapshot_hash ?? '').toLowerCase()) {
        errors.push('ram_snapshot_hash does not match capture commitment');
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    error: errors[0] ?? null,
    ivs,
    derived_ivs: revealRecord.derived_ivs ?? null,
    shiny: revealRecord.shiny ?? null,
    evs: revealRecord.evs ?? null,
  };
}

export async function validateCapturedPokemonRecord(record, options = {}) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { ok: false, errors: ['record must be an object'], error: 'record must be an object' };
  }

  if (record.p !== 'pokebells') {
    pushError(errors, 'field "p" must equal "pokebells"');
  }
  if (record.op !== 'capture') {
    pushError(errors, 'field "op" must equal "capture"');
  }

  const speciesId = normalizeSpeciesId(record);
  if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > 251) {
    pushError(errors, 'species_id must be an integer in [1..251]');
  }
  if (
    record.species !== undefined &&
    record.species_id !== undefined &&
    record.species !== record.species_id
  ) {
    pushError(errors, 'species and species_id must match when both are present');
  }

  if (!Number.isInteger(record.level) || record.level < 1 || record.level > 100) {
    pushError(errors, 'level must be an integer in [1..100]');
  }

  const isV14 = record.schema_version === '1.4';

  // Schema 1.4 hides IVs behind a commitment. Schema 1.3 (legacy) ships IVs
  // inline and must still validate like before so old inscriptions remain
  // verifiable.
  if (!isV14) {
    const ivs = record.ivs ?? {};
    for (const key of ['atk', 'def', 'spe']) {
      if (!Number.isInteger(ivs[key]) || ivs[key] < 0 || ivs[key] > 15) {
        pushError(errors, `IV ${key} must be an integer in [0..15]`);
      }
    }

    const specialIv = specialIvFrom(ivs);
    if (!Number.isInteger(specialIv) || specialIv < 0 || specialIv > 15) {
      pushError(errors, 'IV spc/spd must be an integer in [0..15]');
    }

    const expectedHpIv = deriveGen1HpIv({
      atk: ivs.atk ?? 0,
      def: ivs.def ?? 0,
      spe: ivs.spe ?? 0,
      spd: specialIv ?? 0,
    });
    if (record.derived_ivs?.hp !== expectedHpIv) {
      pushError(errors, `derived_ivs.hp must equal ${expectedHpIv}`);
    }
  } else {
    if (record.ivs != null) {
      pushError(errors, 'schema 1.4 captures must not carry plaintext ivs (move to op:"reveal")');
    }
    if (record.derived_ivs != null) {
      pushError(errors, 'schema 1.4 captures must not carry plaintext derived_ivs');
    }
    if (record.evs != null) {
      pushError(errors, 'schema 1.4 captures must not carry plaintext evs');
    }
    if (record.shiny != null) {
      pushError(errors, 'schema 1.4 captures must not carry plaintext shiny (derivable from ivs)');
    }
    const commitmentHex = String(record.ivs_commitment ?? '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(commitmentHex)) {
      pushError(errors, 'ivs_commitment must be a 64-char sha256 hex');
    }
    const snapshotHashHex = String(record.ram_snapshot_hash ?? '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(snapshotHashHex)) {
      pushError(errors, 'ram_snapshot_hash must be a 64-char sha256 hex');
    }
    if (record.ram_snapshot != null) {
      pushError(errors, 'schema 1.4 captures must not carry raw ram_snapshot (use op:"reveal")');
    }
  }

  // Gen 2 Crystal has 251 valid move ids; move 0 is the "None" slot.
  if (!Array.isArray(record.moves) || record.moves.length !== 4) {
    pushError(errors, 'moves must be an array of 4 move ids');
  } else {
    for (const moveId of record.moves) {
      if (!Number.isInteger(moveId) || moveId < 0 || moveId > 251) {
        pushError(errors, `illegal move id ${moveId}`);
      }
    }
  }

  const speciesInfo = resolveSpeciesEntry(record, options);
  if ((options.resolveSpeciesByDexNo || options.speciesCatalog) && !speciesInfo) {
    pushError(errors, `species ${speciesId} is missing from the ROM catalog`);
  }

  if (speciesInfo) {
    if (record.catch_rate !== speciesInfo.catchRate) {
      pushError(errors, `catch_rate ${record.catch_rate} does not match ROM value ${speciesInfo.catchRate}`);
    }
    // Learnset legality check is currently disabled: parsing Gen 2 evos_attacks
    // + TM/HM tables into a level-indexed learnset is not yet wired into the
    // static gen2-species catalog. Re-enable once the generator emits learnset
    // data (see tools/generate-gen2-species.mjs TODO).
  }

  const verifyProvenance = Boolean(
    options.verifyProvenance ||
    options.checkBlockHashExists ||
    options.requireSignedWallet,
  );

  if (verifyProvenance) {
    const blockHash = String(record.block_hash_at_capture ?? '').trim().toLowerCase();
    if (!BLOCK_HASH_HEX_RE.test(blockHash)) {
      pushError(errors, 'block_hash_at_capture must be a 64-char hex hash');
    }

    const network = record.capture_network ?? options.network ?? null;
    if (options.checkBlockHashExists && !network) {
      pushError(errors, 'capture_network is required to verify block hash provenance');
    }

    if (!Number.isInteger(record.session_sequence_number) || record.session_sequence_number < 1) {
      pushError(errors, 'session_sequence_number must be a positive integer');
    }

    // v1.4 captures don't carry raw ram_snapshot — only its hash in
    // ram_snapshot_hash. ram_snapshot_encoding is nulled out by design.
    // v1.3 and earlier must carry base64.
    if (!isV14 && (record.ram_snapshot_encoding ?? 'base64') !== 'base64') {
      pushError(errors, 'ram_snapshot_encoding must equal "base64"');
    }

    const recognizedSchemes = new Set([
      ATTESTATION_SCHEME_V1,
      ATTESTATION_SCHEME_V1_1,
      ATTESTATION_SCHEME_V2,
    ]);
    if (record.attestation_scheme && !recognizedSchemes.has(record.attestation_scheme)) {
      pushError(errors, 'attestation_scheme is not recognized');
    }

    if (options.requireSignedWallet && typeof record.signed_in_wallet !== 'string') {
      pushError(errors, 'signed_in_wallet must be present for attested captures');
    }

    const svbkAtCapture = Number.isInteger(record.svbk_at_capture)
      ? record.svbk_at_capture & 0xff
      : 0;

    if (!BLOCK_HASH_HEX_RE.test(String(record.attestation ?? '').trim().toLowerCase())) {
      pushError(errors, 'attestation must be a 64-char hex hash');
    } else if (isV14) {
      // v1.4 attestation hashes commitments — no raw ram_snapshot required.
      const ivsCommitmentHex = String(record.ivs_commitment ?? '').trim().toLowerCase();
      const snapshotHashHex = String(record.ram_snapshot_hash ?? '').trim().toLowerCase();
      const expectedAttestation = await computeCaptureAttestationV2({
        blockHashAtCapture: blockHash,
        ramSnapshotHashHex: snapshotHashHex,
        svbk: svbkAtCapture,
        signedInWallet: record.signed_in_wallet ?? '',
        sessionSequenceNumber: record.session_sequence_number,
        ivsCommitmentHex,
      });
      if (String(record.attestation).toLowerCase() !== expectedAttestation) {
        pushError(errors, 'v2 attestation does not match commitments + provenance fields');
      }
    } else {
      let ramSnapshotBytes = null;
      try {
        ramSnapshotBytes = decodeBase64(record.ram_snapshot ?? '');
        if (ramSnapshotBytes.byteLength !== WRAM_BYTE_LENGTH) {
          pushError(errors, `ram_snapshot must decode to ${WRAM_BYTE_LENGTH} bytes`);
        }
      } catch (error) {
        pushError(errors, `ram_snapshot is not valid base64: ${error.message}`);
      }
      if (ramSnapshotBytes) {
        const expectedAttestation = await computeCaptureAttestationV1_1({
          blockHashAtCapture: blockHash,
          ramSnapshotBytes,
          svbk: svbkAtCapture,
          signedInWallet: record.signed_in_wallet ?? '',
          sessionSequenceNumber: record.session_sequence_number,
        });
        if (String(record.attestation).toLowerCase() !== expectedAttestation) {
          pushError(errors, 'v1.1 attestation does not match provenance fields');
        }
      }
    }

    if (
      options.checkBlockHashExists &&
      BLOCK_HASH_HEX_RE.test(blockHash) &&
      network
    ) {
      try {
        await assertBlockHashExists(blockHash, {
          network,
          fetchImpl: options.fetchImpl,
        });
      } catch (error) {
        pushError(errors, `block_hash_at_capture is not resolvable: ${error.message}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    error: errors[0] ?? null,
    speciesId,
    speciesInfo,
  };
}

// ============================================================================
// SCHEMA v1.5 — capture_commit + mint
// ============================================================================
// See SCHEMA-v1.5.md at the repo root for the full spec. Coexists with the
// v1.4 builders above during the migration window. shell.js + companion +
// indexer migrate to these v1.5 builders in subsequent commits.

function hexToBytesV15(hex) {
  const clean = String(hex ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('hex must be even-length [0-9a-f]');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Parse one Crystal party slot directly out of an 8 KB WRAM bank0+bank1
// snapshot buffer. Used both by buildPokemonMintRecord (to derive species /
// level / DVs / EVs from the on-chain RAM) and validatePokemonMintRecord
// (to cross-check the mint's claimed traits against the snapshot).
//
// snapshot layout (matches readRamSnapshot output):
//   [0x0000..0x1000) = bank 0 (0xC000..0xCFFF)
//   [0x1000..0x2000) = bank 1 (0xD000..0xDFFF, SVBK forced to 1)
// Party slot N (1..6) lives at absolute address
// RAM_ADDRS.teamSlotBase + (N-1) * 48, which is in bank 1 → snapshot offset
// (slotAbsBase - WRAM_BANK0_START).
export function parsePartySlotFromSnapshot(snapshotBytes, slotIndex) {
  if (!(snapshotBytes instanceof Uint8Array)) {
    throw new Error('snapshotBytes must be Uint8Array');
  }
  if (snapshotBytes.byteLength !== WRAM_BYTE_LENGTH) {
    throw new Error(`snapshot must be ${WRAM_BYTE_LENGTH} bytes (got ${snapshotBytes.byteLength})`);
  }
  if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 6) {
    throw new Error(`party_slot_index must be integer 1..6 (got ${slotIndex})`);
  }
  const slotAbsBase = RAM_ADDRS.teamSlotBase + (slotIndex - 1) * RAM_ADDRS.teamSlotSize;
  const slotOffset = slotAbsBase - WRAM_BANK0_START;
  if (slotOffset < 0 || slotOffset + RAM_ADDRS.teamSlotSize > snapshotBytes.byteLength) {
    throw new Error(`slot ${slotIndex} would exit snapshot bounds (offset ${slotOffset})`);
  }
  const at = (off) => snapshotBytes[slotOffset + off] & 0xff;
  const wordAt = (off) => ((snapshotBytes[slotOffset + off] & 0xff) << 8)
                          | (snapshotBytes[slotOffset + off + 1] & 0xff);
  const tripleAt = (off) => ((snapshotBytes[slotOffset + off] & 0xff) << 16)
                            | ((snapshotBytes[slotOffset + off + 1] & 0xff) << 8)
                            | (snapshotBytes[slotOffset + off + 2] & 0xff);

  const internalSpeciesId = at(PARTY_OFFSETS.species);
  const heldItem = at(PARTY_OFFSETS.heldItem);
  const moves = [
    at(PARTY_OFFSETS.moves),
    at(PARTY_OFFSETS.moves + 1),
    at(PARTY_OFFSETS.moves + 2),
    at(PARTY_OFFSETS.moves + 3),
  ];
  const pp = [
    at(PARTY_OFFSETS.pp) & 0x3f,
    at(PARTY_OFFSETS.pp + 1) & 0x3f,
    at(PARTY_OFFSETS.pp + 2) & 0x3f,
    at(PARTY_OFFSETS.pp + 3) & 0x3f,
  ];
  const friendship = at(PARTY_OFFSETS.happiness);
  const pokerus = at(PARTY_OFFSETS.pokerus);
  const level = at(PARTY_OFFSETS.level);
  const statusByte = at(PARTY_OFFSETS.status);
  const atkDefDv = at(PARTY_OFFSETS.attackDefenseDv);
  const spdSpcDv = at(PARTY_OFFSETS.speedSpecialDv);
  const dvs = parseGbcDvs(atkDefDv, spdSpcDv);
  const evs = {
    hp: wordAt(PARTY_OFFSETS.hpExp),
    atk: wordAt(PARTY_OFFSETS.atkExp),
    def: wordAt(PARTY_OFFSETS.defExp),
    spe: wordAt(PARTY_OFFSETS.speExp),
    spc: wordAt(PARTY_OFFSETS.spcExp),
  };

  return {
    internalSpeciesId,
    heldItem,
    moves,
    pp,
    friendship,
    pokerus,
    level,
    statusByte,
    atkDefDv,
    spdSpcDv,
    dvs,
    evs,
    caughtData: ((at(PARTY_OFFSETS.caughtData) & 0xff) << 8) | (at(PARTY_OFFSETS.caughtData + 1) & 0xff),
    originalTrainerId: wordAt(PARTY_OFFSETS.originalTrainerId),
    experience: tripleAt(PARTY_OFFSETS.experience),
  };
}

// Build a v1.5 capture_commit record + accompanying privateReveal cache.
//
// The commit body is the receipt that gets inscribed on-chain. IVs are
// DERIVED FROM THE RAM SNAPSHOT at the given partySlotIndex — the caller
// does NOT supply them as input. This is critical: the commit's
// ivs_commitment would otherwise be decorrelated from the party slot's
// real DVs, letting a malicious minter claim any IVs that match the
// commitment regardless of what the RAM actually contains. Locking
// ivs = slot.dvs at commit time + validatePokemonMintRecord re-checking
// mint.ivs == slot.dvs makes the two bindings inseparable.
//
// The privateReveal cache carries the salt + base64 snapshot so the
// caller (shell + companion) can later build the matching op:"mint"
// record deterministically. Persist to IndexedDB keyed by attestation.
export async function buildCaptureCommitRecord(readByte, options = {}) {
  const captureNetwork = normalizeNetworkKey(options.network);
  const sessionSequenceNumber = options.sessionSequenceNumber;
  const partySlotIndex = options.partySlotIndex;
  const signedInWallet = options.signedInWallet ?? '';
  const romSha256 = options.romSha256 ?? null;

  if (!Number.isInteger(sessionSequenceNumber) || sessionSequenceNumber < 1) {
    throw new Error('sessionSequenceNumber must be a positive integer');
  }
  if (!Number.isInteger(partySlotIndex) || partySlotIndex < 1 || partySlotIndex > 6) {
    throw new Error('partySlotIndex must be integer 1..6');
  }
  if (typeof signedInWallet !== 'string' || !signedInWallet.trim()) {
    throw new Error('signedInWallet required');
  }
  if (typeof romSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(romSha256)) {
    throw new Error('romSha256 must be 64-char hex');
  }

  const saltBytes = options.ivsSaltBytes ?? generateIvSaltBytes();
  if (!(saltBytes instanceof Uint8Array) || saltBytes.byteLength !== 32) {
    throw new Error('ivsSaltBytes must be a 32-byte Uint8Array');
  }

  let ramSnapshotBytes;
  let svbkAtCapture;
  if (options.ramSnapshotBytes) {
    ramSnapshotBytes = options.ramSnapshotBytes;
    svbkAtCapture = Number.isInteger(options.svbk) ? options.svbk & 0xff : 0x01;
  } else {
    const snapshot = readRamSnapshot(readByte, {
      ...(options.ramWindow ?? {}),
      writeByte: options.writeByte ?? null,
    });
    ramSnapshotBytes = snapshot.bytes;
    svbkAtCapture = snapshot.svbk;
  }

  // Derive IVs + EVs canonically from the party slot in the freshly-read
  // snapshot. options.ivs is intentionally ignored — the RAM is the only
  // source of truth for party state. If an attacker controls the client
  // enough to fake RAM bytes, they already control the whole ROM runtime,
  // which the game_rom_sha256 check at mainnet will surface separately.
  const slot = parsePartySlotFromSnapshot(ramSnapshotBytes, partySlotIndex);
  const ivs = slot.dvs;

  const ivsCommitmentHex = await computeIvsCommitment(ivs, saltBytes);
  const ramSnapshotHashHex = await computeRamSnapshotHash(ramSnapshotBytes);

  const blockHashAtCapture = (options.blockHashAtCapture ?? await fetchBlockTipHash({
    network: captureNetwork,
    fetchImpl: options.fetchImpl,
  })).toLowerCase();

  const attestationHex = await computeCaptureAttestationV2_1({
    blockHashAtCapture,
    ramSnapshotHashHex,
    svbk: svbkAtCapture,
    signedInWallet,
    sessionSequenceNumber,
    ivsCommitmentHex,
    partySlotIndex,
  });

  const commitRecord = {
    p: 'pokebells',
    op: CAPTURE_COMMIT_OP_V1_5,
    schema_version: SCHEMA_VERSION_V1_5,
    signed_in_wallet: signedInWallet,
    session_sequence_number: sessionSequenceNumber,
    capture_network: captureNetwork,
    block_hash_at_capture: blockHashAtCapture,
    game_rom_sha256: romSha256.toLowerCase(),
    party_slot_index: partySlotIndex,
    ivs_commitment: ivsCommitmentHex,
    ivs_commitment_scheme: IVS_COMMITMENT_SCHEME,
    ram_snapshot_hash: ramSnapshotHashHex,
    ram_commitment_scheme: RAM_COMMITMENT_SCHEME_V1,
    svbk_at_capture: svbkAtCapture,
    attestation: attestationHex,
    attestation_scheme: ATTESTATION_SCHEME_V2_1,
  };

  // privateReveal carries JUST the salt + raw snapshot. ivs is redundantly
  // cached for UI display convenience; verifiers re-derive from the snapshot.
  const privateReveal = {
    ivs,
    evs: slot.evs,
    ivs_salt_hex: bytesToHex(saltBytes),
    ram_snapshot_base64: encodeBase64(ramSnapshotBytes),
  };

  return { commitRecord, privateReveal };
}

// Build a v1.5 op:"mint" record. Pairs with a previously-inscribed
// capture_commit. EVERY Pokemon trait is derived deterministically from
// the RAM snapshot at commitRecord.party_slot_index + the species catalog
// — the privateReveal input contributes only the salt (external to RAM).
// This lets any verifier reproduce the exact same mint body given just
// (commit, ram_snapshot, salt, catalog), which is what
// validatePokemonMintRecord relies on to catch a malicious minter claiming
// fake IVs / moves / items / etc.
export function buildPokemonMintRecord({
  commitRecord,
  commitInscriptionId,
  privateReveal,
  speciesResolver = null,
  resolveSpriteImage = null,
  now = new Date().toISOString(),
}) {
  if (!commitRecord || commitRecord.op !== CAPTURE_COMMIT_OP_V1_5) {
    throw new Error('buildPokemonMintRecord requires a v1.5 capture_commit record');
  }
  if (!/^[0-9a-f]{64}i\d+$/i.test(String(commitInscriptionId ?? ''))) {
    throw new Error('commitInscriptionId must look like <64hex>i<N>');
  }
  if (!privateReveal?.ivs_salt_hex || !privateReveal.ram_snapshot_base64) {
    throw new Error('privateReveal { ivs_salt_hex, ram_snapshot_base64 } required');
  }

  const ramSnapshot = decodeBase64(privateReveal.ram_snapshot_base64);
  if (ramSnapshot.byteLength !== WRAM_BYTE_LENGTH) {
    throw new Error(`ram_snapshot must decode to ${WRAM_BYTE_LENGTH} bytes`);
  }
  const slot = parsePartySlotFromSnapshot(ramSnapshot, commitRecord.party_slot_index);

  const speciesInfo = typeof speciesResolver === 'function'
    ? speciesResolver(slot.internalSpeciesId)
    : null;
  const dexNo = speciesInfo?.dexNo ?? slot.internalSpeciesId;
  const speciesName = speciesInfo?.name ?? `Species ${dexNo}`;

  // Canonical: IVs + EVs come from the slot, never from the caller. Any
  // mismatch between slot.dvs and the commit's ivs_commitment preimage is
  // caught at mint-validation time (check #6 + the new check
  // mint.ivs === slot.dvs).
  const ivs = slot.dvs;
  const derivedIvs = { hp: deriveGbcHpIv(ivs) };
  const shiny = isGen2Shiny(ivs);
  const ivSpecial = ivs.spd;
  const ivTotal = ivs.atk + ivs.def + ivs.spe + ivSpecial;
  const evs = slot.evs;

  const status = statusNameFromByte(slot.statusByte);
  const image = resolveSpriteImageUrl(resolveSpriteImage, dexNo, shiny);

  const attributes = [
    { trait_type: 'Collection', value: POKEBELLS_COLLECTION_NAME },
    { trait_type: 'Pokemon', value: speciesName },
    { trait_type: 'Dex No', value: dexNo },
    { trait_type: 'Level', value: slot.level },
    { trait_type: 'Shiny', value: shiny ? 'Yes' : 'No' },
    { trait_type: 'IV Total', value: ivTotal },
    { trait_type: 'IV HP', value: derivedIvs.hp },
    { trait_type: 'IV Attack', value: ivs.atk },
    { trait_type: 'IV Defense', value: ivs.def },
    { trait_type: 'IV Speed', value: ivs.spe },
    { trait_type: 'IV Special', value: ivSpecial },
    { trait_type: 'Status', value: status },
    { trait_type: 'Friendship', value: slot.friendship },
    { trait_type: 'Held Item', value: slot.heldItem === 0 ? 'None' : `ITEM_${slot.heldItem}` },
  ];

  return {
    p: 'pokebells',
    op: MINT_OP_V1_5,
    schema_version: SCHEMA_VERSION_V1_5,
    ref_capture_commit: commitInscriptionId,
    party_slot_index: commitRecord.party_slot_index,
    signed_in_wallet: commitRecord.signed_in_wallet,

    species_id: dexNo,
    species_name: speciesName,
    level: slot.level,
    moves: slot.moves,
    pp: slot.pp,
    held_item: slot.heldItem,
    friendship: slot.friendship,
    pokerus: slot.pokerus,
    status,
    catch_rate: speciesInfo?.catchRate ?? null,

    ivs,
    ivs_salt_hex: privateReveal.ivs_salt_hex,
    derived_ivs: derivedIvs,
    evs,
    shiny,

    ram_snapshot: privateReveal.ram_snapshot_base64,
    ram_snapshot_encoding: 'base64',
    ram_witness_scheme: RAM_WITNESS_SCHEME_FULL_V1,

    name: `${speciesName} Lv.${slot.level}`,
    description: `${speciesName} captured in Pokemon Crystal via PokeBells.`,
    image,
    attributes,

    minted_at: now,
  };
}

// Validate a v1.5 capture_commit record standalone (no cross-inscription
// access required). Indexer + companion call this before posting to the chain
// or registering with the indexer. Returns { ok, errors, error }.
export async function validateCaptureCommitRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { ok: false, errors: ['record must be an object'], error: 'record must be an object' };
  }
  if (record.p !== 'pokebells') errors.push('p must equal "pokebells"');
  if (record.op !== CAPTURE_COMMIT_OP_V1_5) errors.push('op must equal "capture_commit"');
  if (record.schema_version !== SCHEMA_VERSION_V1_5) errors.push('schema_version must equal "1.5"');

  if (!Number.isInteger(record.party_slot_index)
      || record.party_slot_index < 1 || record.party_slot_index > 6) {
    errors.push('party_slot_index must be integer 1..6');
  }
  if (!BLOCK_HASH_HEX_RE.test(String(record.ivs_commitment ?? ''))) {
    errors.push('ivs_commitment must be 64-char hex');
  }
  if (record.ivs_commitment_scheme !== IVS_COMMITMENT_SCHEME) {
    errors.push(`ivs_commitment_scheme must equal "${IVS_COMMITMENT_SCHEME}"`);
  }
  if (!BLOCK_HASH_HEX_RE.test(String(record.ram_snapshot_hash ?? ''))) {
    errors.push('ram_snapshot_hash must be 64-char hex');
  }
  if (record.ram_commitment_scheme !== RAM_COMMITMENT_SCHEME_V1) {
    errors.push(`ram_commitment_scheme must equal "${RAM_COMMITMENT_SCHEME_V1}"`);
  }
  if (!BLOCK_HASH_HEX_RE.test(String(record.block_hash_at_capture ?? ''))) {
    errors.push('block_hash_at_capture must be 64-char hex');
  }
  if (!BLOCK_HASH_HEX_RE.test(String(record.game_rom_sha256 ?? ''))) {
    errors.push('game_rom_sha256 must be 64-char hex');
  }
  if (record.svbk_at_capture !== 1) {
    errors.push('svbk_at_capture must equal 1 in v2.1');
  }
  if (typeof record.signed_in_wallet !== 'string' || !record.signed_in_wallet.trim()) {
    errors.push('signed_in_wallet required');
  }
  if (!Number.isInteger(record.session_sequence_number) || record.session_sequence_number < 1) {
    errors.push('session_sequence_number must be positive integer');
  }
  if (record.capture_network !== 'bells-mainnet' && record.capture_network !== 'bells-testnet') {
    errors.push('capture_network must be bells-mainnet or bells-testnet');
  }
  if (record.attestation_scheme !== ATTESTATION_SCHEME_V2_1) {
    errors.push(`attestation_scheme must equal "${ATTESTATION_SCHEME_V2_1}"`);
  }
  if (!BLOCK_HASH_HEX_RE.test(String(record.attestation ?? ''))) {
    errors.push('attestation must be 64-char hex');
  }

  if (errors.length === 0) {
    const recomputed = await computeCaptureAttestationV2_1({
      blockHashAtCapture: record.block_hash_at_capture,
      ramSnapshotHashHex: record.ram_snapshot_hash,
      svbk: record.svbk_at_capture,
      signedInWallet: record.signed_in_wallet,
      sessionSequenceNumber: record.session_sequence_number,
      ivsCommitmentHex: record.ivs_commitment,
      partySlotIndex: record.party_slot_index,
    });
    if (recomputed !== String(record.attestation).toLowerCase()) {
      errors.push('attestation does not match recomputed v2.1 value');
    }
  }

  return { ok: errors.length === 0, errors, error: errors[0] ?? null };
}

// Validate a v1.5 op:"mint" record against its capture_commit. Runs all the
// cross-inscription consistency checks the indexer needs except for #11
// (vout[0] owner match — electrs-side, indexer-only) and #12 (DB unique on
// ref_capture_commit — also indexer-only).
//
// options.speciesResolver: (internalSpeciesId) => { dexNo, name, catchRate, ... }
//   Required to verify mint.species_id matches what the RAM slot encodes.
export async function validatePokemonMintRecord(mintRecord, commitRecord, options = {}) {
  const errors = [];
  if (!mintRecord || mintRecord.p !== 'pokebells' || mintRecord.op !== MINT_OP_V1_5) {
    errors.push('mint must have p:pokebells op:mint');
    return { ok: false, errors, error: errors[0] };
  }
  if (mintRecord.schema_version !== SCHEMA_VERSION_V1_5) {
    errors.push('mint schema_version must equal "1.5"');
  }
  if (!commitRecord || commitRecord.op !== CAPTURE_COMMIT_OP_V1_5) {
    errors.push('matching capture_commit record required');
    return { ok: false, errors, error: errors[0] };
  }

  if (mintRecord.party_slot_index !== commitRecord.party_slot_index) {
    errors.push(`party_slot_index ${mintRecord.party_slot_index} does not match commit (${commitRecord.party_slot_index})`);
  }
  if (mintRecord.signed_in_wallet !== commitRecord.signed_in_wallet) {
    errors.push('signed_in_wallet does not match commit');
  }
  if (mintRecord.ram_witness_scheme !== RAM_WITNESS_SCHEME_FULL_V1) {
    errors.push(`ram_witness_scheme must equal "${RAM_WITNESS_SCHEME_FULL_V1}" in v1.5`);
  }
  if ((mintRecord.ram_snapshot_encoding ?? 'base64') !== 'base64') {
    errors.push('ram_snapshot_encoding must equal "base64"');
  }

  // ivs_commitment preimage check
  const ivs = mintRecord.ivs ?? {};
  for (const key of ['atk', 'def', 'spe']) {
    if (!Number.isInteger(ivs[key]) || ivs[key] < 0 || ivs[key] > 15) {
      errors.push(`mint.ivs.${key} must be integer 0..15`);
    }
  }
  const specialIv = Number.isInteger(ivs.spd) ? ivs.spd : ivs.spc;
  if (!Number.isInteger(specialIv) || specialIv < 0 || specialIv > 15) {
    errors.push('mint.ivs.spd (or spc) must be integer 0..15');
  }
  const saltHex = String(mintRecord.ivs_salt_hex ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(saltHex)) {
    errors.push('ivs_salt_hex must be 64-char hex');
  } else if (errors.length === 0) {
    const saltBytes = hexToBytesV15(saltHex);
    const expectedCommitment = await computeIvsCommitment(ivs, saltBytes);
    if (expectedCommitment !== String(commitRecord.ivs_commitment ?? '').toLowerCase()) {
      errors.push('ivs_commitment preimage does not match commit');
    }
  }

  // ram_snapshot preimage check + full slot cross-check. Every
  // marketplace-visible trait must be derivable from the snapshot +
  // catalog; any divergence = rejection. Catches a malicious minter that
  // inscribes RAM matching the hash but claims fake traits (IVs, moves,
  // items, status, EVs, etc.) in the top-level / attributes.
  let snapshotBytes;
  try {
    snapshotBytes = decodeBase64(mintRecord.ram_snapshot ?? '');
  } catch (e) {
    errors.push(`ram_snapshot base64 decode failed: ${e.message}`);
  }
  if (snapshotBytes) {
    if (snapshotBytes.byteLength !== WRAM_BYTE_LENGTH) {
      errors.push(`ram_snapshot must decode to ${WRAM_BYTE_LENGTH} bytes`);
    } else {
      const ramHash = await computeRamSnapshotHash(snapshotBytes);
      if (ramHash !== String(commitRecord.ram_snapshot_hash ?? '').toLowerCase()) {
        errors.push('ram_snapshot does not match commit hash');
      } else {
        try {
          const slot = parsePartySlotFromSnapshot(snapshotBytes, commitRecord.party_slot_index);

          // IVs MUST match the DVs encoded in the slot. Without this check,
          // a minter could set ivs_commitment to any value, reveal any (ivs,
          // salt) that hashes to it, and publish fake ivs unrelated to the
          // Pokemon in the RAM.
          const slotIvs = slot.dvs;
          if (ivs.atk !== slotIvs.atk || ivs.def !== slotIvs.def
              || ivs.spe !== slotIvs.spe || specialIv !== slotIvs.spd) {
            errors.push('mint.ivs does not match the DVs in the RAM slot');
          }

          // HP IV is derived deterministically from the four DVs. v1.5 requires
          // derived_ivs present as an object so marketplaces don't see undefined.
          const expectedHpIv = deriveGbcHpIv(slotIvs);
          if (!mintRecord.derived_ivs || typeof mintRecord.derived_ivs !== 'object') {
            errors.push('mint.derived_ivs must be an object');
          } else if (mintRecord.derived_ivs.hp !== expectedHpIv) {
            errors.push(`derived_ivs.hp ${mintRecord.derived_ivs.hp} must equal ${expectedHpIv}`);
          }

          const speciesResolver = options.speciesResolver;
          const speciesInfo = typeof speciesResolver === 'function'
            ? speciesResolver(slot.internalSpeciesId) : null;
          const expectedDexNo = speciesInfo?.dexNo ?? slot.internalSpeciesId;
          if (mintRecord.species_id !== expectedDexNo) {
            errors.push(`mint.species_id ${mintRecord.species_id} does not match RAM slot (${expectedDexNo})`);
          }
          if (speciesInfo && typeof mintRecord.species_name === 'string'
              && mintRecord.species_name !== speciesInfo.name) {
            errors.push(`mint.species_name "${mintRecord.species_name}" does not match catalog ("${speciesInfo.name}")`);
          }
          if (mintRecord.level !== slot.level) {
            errors.push(`mint.level ${mintRecord.level} does not match RAM slot (${slot.level})`);
          }
          const expectedShiny = isGen2Shiny(slotIvs);
          if (Boolean(mintRecord.shiny) !== expectedShiny) {
            errors.push(`mint.shiny ${mintRecord.shiny} does not match RAM-derived (${expectedShiny})`);
          }

          // Moves, PP, held item, friendship, pokerus, status = full RAM
          // projection. Catalog-derived catch_rate too.
          if (!Array.isArray(mintRecord.moves) || mintRecord.moves.length !== 4
              || !mintRecord.moves.every((m, i) => m === slot.moves[i])) {
            errors.push('mint.moves does not match RAM slot');
          }
          if (!Array.isArray(mintRecord.pp) || mintRecord.pp.length !== 4
              || !mintRecord.pp.every((p, i) => p === slot.pp[i])) {
            errors.push('mint.pp does not match RAM slot');
          }
          if (mintRecord.held_item !== slot.heldItem) {
            errors.push(`mint.held_item ${mintRecord.held_item} does not match RAM slot (${slot.heldItem})`);
          }
          if (mintRecord.friendship !== slot.friendship) {
            errors.push(`mint.friendship ${mintRecord.friendship} does not match RAM slot (${slot.friendship})`);
          }
          if (mintRecord.pokerus !== slot.pokerus) {
            errors.push(`mint.pokerus ${mintRecord.pokerus} does not match RAM slot (${slot.pokerus})`);
          }
          const expectedStatus = statusNameFromByte(slot.statusByte);
          if (mintRecord.status !== expectedStatus) {
            errors.push(`mint.status "${mintRecord.status}" does not match RAM-derived ("${expectedStatus}")`);
          }
          // v1.5: mint.evs MUST be a complete object with all 5 keys matching
          // the slot. No "if present" leniency — marketplaces must see
          // consistent EVs or the mint is rejected entirely.
          if (!mintRecord.evs || typeof mintRecord.evs !== 'object') {
            errors.push('mint.evs must be an object');
          } else {
            for (const key of ['hp', 'atk', 'def', 'spe', 'spc']) {
              if (mintRecord.evs[key] !== slot.evs[key]) {
                errors.push(`mint.evs.${key} ${mintRecord.evs[key]} does not match RAM slot (${slot.evs[key]})`);
              }
            }
          }
          if (speciesInfo && mintRecord.catch_rate != null
              && mintRecord.catch_rate !== speciesInfo.catchRate) {
            errors.push(`mint.catch_rate ${mintRecord.catch_rate} does not match catalog (${speciesInfo.catchRate})`);
          }

          // ===== Marketplace projection: name / image / attributes =====
          // These fields are what wallets and marketplaces render to users.
          // Letting them lie would let an attacker publish a Cyndaquil that
          // shows up as "Mewtwo Lv.100 SHINY" with custom IV traits in
          // listings. We pin them strictly to the canonical projection of
          // the RAM slot + catalog so the mint's UX surface is always
          // honest.
          const speciesNameFinal = speciesInfo?.name ?? `Species ${expectedDexNo}`;
          const expectedName = `${speciesNameFinal} Lv.${slot.level}`;
          if (mintRecord.name !== expectedName) {
            errors.push(`mint.name "${mintRecord.name}" must equal "${expectedName}"`);
          }

          // image canonical resolution. Mainnet indexer MUST pass a resolver
          // backed by the pinned p:pokebells-sprites manifest. If the
          // resolver is provided but returns null (sprite missing for this
          // species/shiny pair), the mint is rejected: the collection
          // requires a canonical image for every entry. Without a resolver
          // (unit-test path) the validator enforces only "non-empty string"
          // — never accept that fallback in production.
          if (typeof options.resolveSpriteImage === 'function') {
            const expectedImage = options.resolveSpriteImage(expectedDexNo, expectedShiny);
            if (typeof expectedImage !== 'string' || !expectedImage) {
              errors.push(`canonical sprite for species ${expectedDexNo} (shiny=${expectedShiny}) not found in resolver — mint cannot be validated; check the sprite pack manifest`);
            } else if (mintRecord.image !== expectedImage) {
              errors.push(`mint.image "${mintRecord.image}" must equal canonical "${expectedImage}"`);
            }
          } else if (typeof mintRecord.image !== 'string' || !mintRecord.image) {
            errors.push('mint.image must be a non-empty string');
          }

          // attributes[] = strict canonical ordered array. Same shape as
          // buildPokemonMintRecord emits.
          const ivTotalExpected = slotIvs.atk + slotIvs.def + slotIvs.spe + slotIvs.spd;
          const expectedAttributes = [
            { trait_type: 'Collection', value: POKEBELLS_COLLECTION_NAME },
            { trait_type: 'Pokemon', value: speciesNameFinal },
            { trait_type: 'Dex No', value: expectedDexNo },
            { trait_type: 'Level', value: slot.level },
            { trait_type: 'Shiny', value: expectedShiny ? 'Yes' : 'No' },
            { trait_type: 'IV Total', value: ivTotalExpected },
            { trait_type: 'IV HP', value: expectedHpIv },
            { trait_type: 'IV Attack', value: slotIvs.atk },
            { trait_type: 'IV Defense', value: slotIvs.def },
            { trait_type: 'IV Speed', value: slotIvs.spe },
            { trait_type: 'IV Special', value: slotIvs.spd },
            { trait_type: 'Status', value: expectedStatus },
            { trait_type: 'Friendship', value: slot.friendship },
            { trait_type: 'Held Item', value: slot.heldItem === 0 ? 'None' : `ITEM_${slot.heldItem}` },
          ];
          if (!Array.isArray(mintRecord.attributes)) {
            errors.push('mint.attributes must be an array');
          } else if (mintRecord.attributes.length !== expectedAttributes.length) {
            errors.push(`mint.attributes length ${mintRecord.attributes.length} must equal canonical ${expectedAttributes.length}`);
          } else {
            for (let i = 0; i < expectedAttributes.length; i += 1) {
              const exp = expectedAttributes[i];
              const got = mintRecord.attributes[i];
              if (!got || got.trait_type !== exp.trait_type || got.value !== exp.value) {
                errors.push(`mint.attributes[${i}] mismatch: expected {${exp.trait_type}: ${JSON.stringify(exp.value)}} got ${JSON.stringify(got)}`);
                break; // one mismatch is enough — caller fixes and re-validates
              }
            }
          }
        } catch (e) {
          errors.push(`slot parse failed: ${e.message}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, error: errors[0] ?? null };
}

const browserExports = {
  ATTESTATION_SCHEME,
  ATTESTATION_SCHEME_V1,
  ATTESTATION_SCHEME_V1_1,
  ATTESTATION_SCHEME_V2,
  ATTESTATION_SCHEME_V2_1,
  CAPTURE_COMMIT_OP_V1_5,
  MINT_OP_V1_5,
  SCHEMA_VERSION_V1_5,
  RAM_COMMITMENT_SCHEME_V1,
  RAM_WITNESS_SCHEME_FULL_V1,
  CAPTURE_SCHEMA_VERSION,
  IVS_COMMITMENT_SCHEME,
  REVEAL_SCHEMA_VERSION,
  BLOCK_HASH_HEX_RE,
  CAPTURE_FRAMES_REQUIRED,
  GEN2_UNSUPPORTED_LABEL,
  PARTY_OFFSETS,
  POKEBELLS_COLLECTION_NAME,
  POKEBELLS_COLLECTION_SLUG,
  RAM_ADDRS,
  SVBK_REGISTER,
  WRAM_BANK0_BYTE_LENGTH,
  WRAM_BANK0_START,
  WRAM_BANK1_BYTE_LENGTH,
  WRAM_BANK1_START,
  WRAM_BYTE_LENGTH,
  WRAM_START,
  assertBlockHashExists,
  buildBlockByHashUrl,
  buildBlockTipHashUrl,
  SRAM_TOTAL_BYTE_LENGTH,
  SRAM_BANK_BYTE_LENGTH,
  SAVE_SNAPSHOT_SCHEME,
  buildCaptureCommitRecord,
  buildCaptureProvenance,
  buildCapturedPokemonRecord,
  buildEvolveRecord,
  buildPokemonMintRecord,
  buildRevealRecord,
  buildSaveSnapshotRecord,
  buildUpdateRecord,
  buildSpriteImageResolver,
  byteToHex,
  catchChancePercent,
  clamp,
  computeCaptureAttestation,
  computeCaptureAttestationV1_1,
  computeCaptureAttestationV2,
  computeCaptureAttestationV2_1,
  computeCatchChance,
  computeIvsCommitment,
  computeRamSnapshotHash,
  decodeBase64,
  deriveGbcHpIv,
  deriveGen1HpIv,
  encodeBase64,
  fetchBlockTipHash,
  generateIvSaltBytes,
  isGen2Shiny,
  normalizeNetworkKey,
  normalizeSpeciesId,
  parseGbcDvs,
  parseGen1Dvs,
  parsePartySlotFromSnapshot,
  readRamSnapshot,
  readTripleByte,
  readWord,
  resolveElectrsBaseUrl,
  sha256Hex,
  statusBonusFor,
  statusNameFromByte,
  readSramSnapshot,
  validateCaptureCommitRecord,
  validateCapturedPokemonRecord,
  validatePokemonMintRecord,
  validateRevealRecord,
  validateSaveSnapshotRecord,
  writeSramSnapshot,
  wordToHex,
};

if (typeof window !== 'undefined') {
  window.PokeBellsCaptureCore = browserExports;
}
