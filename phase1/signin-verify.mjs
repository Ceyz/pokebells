const OWNER_SEARCH_PAGE_SIZE = 100;
const DEFAULT_FETCH_CONCURRENCY = 6;
const MAX_ADDRESS_HISTORY_PAGES = 20;

const BELLS_MAINNET = Object.freeze({
  key: 'bells-mainnet',
  bech32: 'bel',
  p2pkhVersion: 25,
  p2shVersion: 30,
  electrsBaseUrl: 'https://api.nintondo.io',
  searchBaseUrl: 'https://bells-mainnet-search.nintondo.io/pub',
  contentBaseUrl: 'https://bells-mainnet-content.nintondo.io',
});

const BELLS_TESTNET = Object.freeze({
  key: 'bells-testnet',
  bech32: 'tpep',
  p2pkhVersion: 33,
  p2shVersion: 196,
  electrsBaseUrl: 'https://bells-testnet-api.nintondo.io',
  searchBaseUrl: 'https://bells-testnet-search.nintondo.io/pub',
  contentBaseUrl: 'https://bells-testnet-content.nintondo.io',
});

const SECP256K1_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const SECP256K1_N = 0xfffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP256K1_GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240n;
const SECP256K1_GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424n;
const SECP256K1_G = Object.freeze({ x: SECP256K1_GX, y: SECP256K1_GY });

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_CHECKSUM_CONST = 1;
const BECH32M_CHECKSUM_CONST = 0x2bc830a3;

function ensureCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable in this runtime.');
  }
  return globalThis.crypto;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isInscriptionId(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}i\d+$/i.test(value.trim());
}

function isLikelyPubkeyHex(value) {
  return typeof value === 'string'
    && (/^(02|03)[0-9a-f]{64}$/i.test(value) || /^04[0-9a-f]{128}$/i.test(value));
}

function normalizeBase64(value) {
  return String(value ?? '')
    .trim()
    .replaceAll(' ', '+')
    .replaceAll('-', '+')
    .replaceAll('_', '/');
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const normalized = String(hex ?? '').trim();
  if (!/^[0-9a-f]*$/i.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Expected an even-length hex string.');
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, (index * 2) + 2), 16);
  }
  return bytes;
}

function decodeBase64Bytes(value) {
  const normalized = normalizeBase64(value);
  if (!normalized) {
    throw new Error('Missing signature bytes.');
  }

  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(normalized, 'base64'));
  }

  if (typeof atob !== 'function') {
    throw new Error('Base64 decoding is unavailable in this runtime.');
  }

  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value ?? ''));
}

async function sha256Bytes(bytes) {
  const crypto = ensureCrypto();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

function parseSafeInteger(value, label) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid ${label} value.`);
  }
  return parsed;
}

function dedupe(values) {
  return Array.from(new Set(values));
}

function buildUrl(baseUrl, pathName) {
  const base = new URL(`${baseUrl.replace(/\/+$/, '')}/`);
  const normalizedPath = String(pathName ?? '').replace(/^\/+/, '');
  return new URL(normalizedPath, base).toString();
}

async function fetchText(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch() is unavailable in this runtime.');
  }

  const response = await fetchImpl(url, options.request);
  const text = await response.text();
  if (!response.ok) {
    const detail = text ? ` ${text.slice(0, 240)}` : '';
    throw new Error(`${response.status} ${response.statusText} for ${url}.${detail}`.trim());
  }
  return text;
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

function serializeJsonBody(body) {
  return {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function detectNetworkFromHostName(hostName) {
  const normalized = String(hostName ?? '').toLowerCase();
  return normalized.includes('testnet') ? BELLS_TESTNET : BELLS_MAINNET;
}

function detectNetworkFromAddress(address) {
  const normalized = String(address ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith(`${BELLS_MAINNET.bech32}1`)) {
    return BELLS_MAINNET;
  }
  if (normalized.startsWith(`${BELLS_TESTNET.bech32}1`)) {
    return BELLS_TESTNET;
  }

  try {
    const payload = decodeBase58Check(address);
    const version = payload[0];
    if (version === BELLS_MAINNET.p2pkhVersion || version === BELLS_MAINNET.p2shVersion) {
      return BELLS_MAINNET;
    }
    if (version === BELLS_TESTNET.p2pkhVersion || version === BELLS_TESTNET.p2shVersion) {
      return BELLS_TESTNET;
    }
  } catch {
    // Address parsing falls through to hostname inference.
  }

  return null;
}

export function resolveBellsServices(options = {}) {
  const fromAddress = detectNetworkFromAddress(options.address ?? null);
  if (fromAddress) {
    return fromAddress;
  }

  const explicit = String(options.network ?? '').trim().toLowerCase();
  if (explicit.includes('test')) {
    return BELLS_TESTNET;
  }
  if (explicit.includes('main')) {
    return BELLS_MAINNET;
  }

  const locationLike = options.location ?? globalThis.location ?? null;
  return detectNetworkFromHostName(locationLike?.hostname ?? options.hostname ?? '');
}

export function extractInscriptionIdFromLocation(locationLike = globalThis.location) {
  const searchParams = new URLSearchParams(locationLike?.search ?? '');
  for (const key of ['inscription_id', 'inscription']) {
    const candidate = searchParams.get(key);
    if (isInscriptionId(candidate)) {
      return candidate.trim();
    }
  }

  const candidates = [locationLike?.pathname, locationLike?.href];
  for (const candidate of candidates) {
    const match = String(candidate ?? '').match(/([0-9a-f]{64}i\d+)/i);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function parseSigninParamsFromLocation(locationLike = globalThis.location) {
  const searchParams = new URLSearchParams(locationLike?.search ?? '');
  const hasAnyAuthParam = ['wallet', 'sig', 'issued', 'expires', 'nonce']
    .some((key) => searchParams.has(key));

  if (!hasAnyAuthParam) {
    return null;
  }

  const wallet = searchParams.get('wallet')?.trim();
  const signature = searchParams.get('sig')?.trim();
  const nonce = searchParams.get('nonce') ?? '';

  if (!wallet || !signature || !nonce || !searchParams.has('issued') || !searchParams.has('expires')) {
    throw new Error('Incomplete sign-in URL. Expected wallet, sig, issued, expires, and nonce.');
  }

  const inscriptionId = extractInscriptionIdFromLocation(locationLike);
  if (!inscriptionId) {
    throw new Error('Unable to determine the current inscription ID from the URL.');
  }

  return {
    wallet,
    signature,
    issuedMs: parseSafeInteger(searchParams.get('issued'), 'issued'),
    expiresMs: parseSafeInteger(searchParams.get('expires'), 'expires'),
    nonce: String(nonce),
    inscriptionId,
  };
}

export function buildCanonicalSigninChallenge({
  inscriptionId,
  wallet,
  issuedMs,
  expiresMs,
  nonce,
}) {
  if (!inscriptionId || !wallet || !Number.isSafeInteger(issuedMs) || !Number.isSafeInteger(expiresMs) || nonce == null) {
    throw new Error('Cannot build the sign-in challenge without inscriptionId, wallet, issuedMs, expiresMs, and nonce.');
  }

  return `pokebells:signin:v1:${inscriptionId}:${wallet}:${issuedMs}:${expiresMs}:${nonce}`;
}

function mod(value, modulus) {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let value = mod(base, modulus);
  let power = exponent;

  while (power > 0n) {
    if (power & 1n) {
      result = mod(result * value, modulus);
    }
    value = mod(value * value, modulus);
    power >>= 1n;
  }

  return result;
}

function invertMod(value, modulus) {
  let a = mod(value, modulus);
  let b = modulus;
  let x0 = 1n;
  let x1 = 0n;

  while (b !== 0n) {
    const quotient = a / b;
    const nextA = b;
    const nextB = a % b;
    const nextX0 = x1;
    const nextX1 = x0 - (quotient * x1);
    a = nextA;
    b = nextB;
    x0 = nextX0;
    x1 = nextX1;
  }

  if (a !== 1n) {
    throw new Error('Value is not invertible on secp256k1.');
  }

  return mod(x0, modulus);
}

function bytesToNumber(bytes) {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

function sqrtModSecp256k1(value) {
  return modPow(value, (SECP256K1_P + 1n) >> 2n, SECP256K1_P);
}

function pointDouble(point) {
  if (!point) {
    return null;
  }
  if (point.y === 0n) {
    return null;
  }

  const slope = mod(
    (3n * point.x * point.x) * invertMod(2n * point.y, SECP256K1_P),
    SECP256K1_P,
  );
  const nextX = mod((slope * slope) - (2n * point.x), SECP256K1_P);
  const nextY = mod(slope * (point.x - nextX) - point.y, SECP256K1_P);

  return { x: nextX, y: nextY };
}

function pointAdd(left, right) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  if (left.x === right.x) {
    if (mod(left.y + right.y, SECP256K1_P) === 0n) {
      return null;
    }
    return pointDouble(left);
  }

  const slope = mod(
    (right.y - left.y) * invertMod(right.x - left.x, SECP256K1_P),
    SECP256K1_P,
  );
  const nextX = mod((slope * slope) - left.x - right.x, SECP256K1_P);
  const nextY = mod(slope * (left.x - nextX) - left.y, SECP256K1_P);

  return { x: nextX, y: nextY };
}

function scalarMultiply(point, scalar) {
  let result = null;
  let addend = point;
  let factor = mod(scalar, SECP256K1_N);

  while (factor > 0n) {
    if (factor & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointDouble(addend);
    factor >>= 1n;
  }

  return result;
}

function pointFromCompressedPublicKey(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 33) {
    throw new Error('Expected a 33-byte compressed public key.');
  }

  const prefix = bytes[0];
  if (prefix !== 0x02 && prefix !== 0x03) {
    throw new Error('Expected a compressed secp256k1 public key.');
  }

  const x = bytesToNumber(bytes.slice(1));
  const alpha = mod((x ** 3n) + 7n, SECP256K1_P);
  let y = sqrtModSecp256k1(alpha);
  if ((y & 1n) !== BigInt(prefix & 1)) {
    y = SECP256K1_P - y;
  }
  return { x, y };
}

function pointFromPublicKey(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('Expected public key bytes.');
  }

  if (bytes.length === 33) {
    return pointFromCompressedPublicKey(bytes);
  }

  if (bytes.length === 65 && bytes[0] === 0x04) {
    const x = bytesToNumber(bytes.slice(1, 33));
    const y = bytesToNumber(bytes.slice(33));
    return { x, y };
  }

  throw new Error('Unsupported public key format.');
}

function verifyCompactSecp256k1Signature(messageHashBytes, signatureBytes, publicKeyBytes) {
  if (!(signatureBytes instanceof Uint8Array) || signatureBytes.length !== 64) {
    return false;
  }

  const r = bytesToNumber(signatureBytes.slice(0, 32));
  const s = bytesToNumber(signatureBytes.slice(32));
  if (r <= 0n || s <= 0n || r >= SECP256K1_N || s >= SECP256K1_N) {
    return false;
  }

  let publicPoint;
  try {
    publicPoint = pointFromPublicKey(publicKeyBytes);
  } catch {
    return false;
  }

  const z = bytesToNumber(messageHashBytes);
  const w = invertMod(s, SECP256K1_N);
  const u1 = mod(z * w, SECP256K1_N);
  const u2 = mod(r * w, SECP256K1_N);
  const point = pointAdd(scalarMultiply(SECP256K1_G, u1), scalarMultiply(publicPoint, u2));

  if (!point) {
    return false;
  }

  return mod(point.x, SECP256K1_N) === r;
}

function witnessPublicKeyCandidatesFromTaprootProgram(programBytes) {
  if (!(programBytes instanceof Uint8Array) || programBytes.length !== 32) {
    return [];
  }

  return [
    Uint8Array.from([0x02, ...programBytes]),
    Uint8Array.from([0x03, ...programBytes]),
  ];
}

function createBech32Lookup() {
  const map = new Map();
  for (let index = 0; index < BECH32_CHARSET.length; index += 1) {
    map.set(BECH32_CHARSET[index], index);
  }
  return map;
}

const BECH32_LOOKUP = createBech32Lookup();

function bech32HrpExpand(hrp) {
  const values = [];
  for (const char of hrp) {
    const code = char.charCodeAt(0);
    values.push(code >> 5);
  }
  values.push(0);
  for (const char of hrp) {
    values.push(char.charCodeAt(0) & 31);
  }
  return values;
}

function bech32Polymod(values) {
  const generators = [
    0x3b6a57b2,
    0x26508e6d,
    0x1ea119fa,
    0x3d4233dd,
    0x2a1462b3,
  ];

  let checksum = 1;
  for (const value of values) {
    const top = checksum >> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let bit = 0; bit < generators.length; bit += 1) {
      if ((top >> bit) & 1) {
        checksum ^= generators[bit];
      }
    }
  }

  return checksum >>> 0;
}

function decodeBech32(address) {
  const original = String(address ?? '').trim();
  if (!original) {
    throw new Error('Address is empty.');
  }

  const hasLower = original !== original.toUpperCase();
  const hasUpper = original !== original.toLowerCase();
  if (hasLower && hasUpper) {
    throw new Error('Mixed-case Bech32 addresses are invalid.');
  }

  const value = original.toLowerCase();
  const separatorIndex = value.lastIndexOf('1');
  if (separatorIndex <= 0 || separatorIndex + 7 > value.length) {
    throw new Error('Invalid Bech32 address format.');
  }

  const hrp = value.slice(0, separatorIndex);
  const wordChars = value.slice(separatorIndex + 1);
  const words = [];
  for (const char of wordChars) {
    const decoded = BECH32_LOOKUP.get(char);
    if (decoded == null) {
      throw new Error('Invalid Bech32 character.');
    }
    words.push(decoded);
  }

  const polymod = bech32Polymod([...bech32HrpExpand(hrp), ...words]);
  let encoding = null;
  if (polymod === BECH32_CHECKSUM_CONST) {
    encoding = 'bech32';
  } else if (polymod === BECH32M_CHECKSUM_CONST) {
    encoding = 'bech32m';
  } else {
    throw new Error('Invalid Bech32 checksum.');
  }

  return {
    hrp,
    words: words.slice(0, -6),
    encoding,
  };
}

function convertBits(words, fromBits, toBits, allowPadding) {
  let accumulator = 0;
  let bitCount = 0;
  const result = [];
  const maxValue = (1 << toBits) - 1;

  for (const word of words) {
    if (word < 0 || word >> fromBits) {
      throw new Error('Invalid Bech32 word.');
    }
    accumulator = (accumulator << fromBits) | word;
    bitCount += fromBits;
    while (bitCount >= toBits) {
      bitCount -= toBits;
      result.push((accumulator >> bitCount) & maxValue);
    }
  }

  if (allowPadding) {
    if (bitCount > 0) {
      result.push((accumulator << (toBits - bitCount)) & maxValue);
    }
  } else if (bitCount >= fromBits || ((accumulator << (toBits - bitCount)) & maxValue)) {
    throw new Error('Invalid Bech32 padding.');
  }

  return result;
}

function decodeWitnessAddress(address) {
  const decoded = decodeBech32(address);
  if (!decoded.words.length) {
    throw new Error('Missing witness version.');
  }

  const version = decoded.words[0];
  if (version > 16) {
    throw new Error('Invalid witness version.');
  }

  const program = Uint8Array.from(convertBits(decoded.words.slice(1), 5, 8, false));
  if (program.length < 2 || program.length > 40) {
    throw new Error('Invalid witness program length.');
  }

  if (version === 0 && decoded.encoding !== 'bech32') {
    throw new Error('Version 0 witness addresses must use Bech32.');
  }
  if (version !== 0 && decoded.encoding !== 'bech32m') {
    throw new Error('Version >0 witness addresses must use Bech32m.');
  }
  if (version === 0 && program.length !== 20 && program.length !== 32) {
    throw new Error('Version 0 witness addresses must be 20 or 32 bytes.');
  }

  return {
    prefix: decoded.hrp,
    version,
    program,
  };
}

function decodeBase58(value) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let decoded = 0n;

  for (const character of String(value ?? '').trim()) {
    const alphabetIndex = alphabet.indexOf(character);
    if (alphabetIndex < 0) {
      throw new Error('Invalid Base58 character.');
    }
    decoded = (decoded * 58n) + BigInt(alphabetIndex);
  }

  let hex = decoded.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }

  let bytes = hex ? hexToBytes(hex) : new Uint8Array(0);
  let leadingZeroes = 0;
  for (const character of String(value ?? '')) {
    if (character === '1') {
      leadingZeroes += 1;
    } else {
      break;
    }
  }

  if (leadingZeroes > 0) {
    bytes = Uint8Array.from([
      ...new Uint8Array(leadingZeroes),
      ...bytes,
    ]);
  }

  return bytes;
}

function decodeBase58Check(address) {
  const decoded = decodeBase58(address);
  if (decoded.length < 5) {
    throw new Error('Base58Check payload is too short.');
  }

  return decoded.slice(0, -4);
}

function extractPubkeyFromScriptSigAsm(scriptsigAsm) {
  const tokens = String(scriptsigAsm ?? '').trim().split(/\s+/);
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (isLikelyPubkeyHex(tokens[index])) {
      return tokens[index];
    }
  }
  return null;
}

function extractPubkeyFromTxInput(address, vin) {
  if (vin?.prevout?.scriptpubkey_address !== address) {
    return null;
  }

  const witness = Array.isArray(vin?.witness) ? vin.witness : [];
  for (let index = witness.length - 1; index >= 0; index -= 1) {
    if (isLikelyPubkeyHex(witness[index])) {
      return witness[index];
    }
  }

  return extractPubkeyFromScriptSigAsm(vin?.scriptsig_asm ?? '');
}

async function discoverPublicKeyFromAddressHistory(address, services, fetchImpl) {
  let cursor = null;
  for (let pageIndex = 0; pageIndex < MAX_ADDRESS_HISTORY_PAGES; pageIndex += 1) {
    const pathName = cursor
      ? `/address/${address}/txs/chain/${cursor}`
      : `/address/${address}/txs`;
    const transactions = await fetchJson(buildUrl(services.electrsBaseUrl, pathName), {
      fetchImpl,
    });

    if (!Array.isArray(transactions) || !transactions.length) {
      break;
    }

    for (const transaction of transactions) {
      const vinList = Array.isArray(transaction?.vin) ? transaction.vin : [];
      for (const vin of vinList) {
        const pubkeyHex = extractPubkeyFromTxInput(address, vin);
        if (pubkeyHex) {
          return {
            publicKeyBytes: hexToBytes(pubkeyHex),
            source: `address-history:${transaction.txid}`,
          };
        }
      }
    }

    cursor = transactions.at(-1)?.txid ?? null;
    if (!cursor) {
      break;
    }
  }

  return null;
}

export async function verifyNintondoRawSignature({ address, signature, challenge, services, fetchImpl }) {
  const signatureBytes = decodeBase64Bytes(signature);
  if (signatureBytes.length !== 64) {
    throw new Error('Unsupported signature format. Expected Nintondo compact base64 output.');
  }

  const challengeHash = await sha256Bytes(utf8Bytes(challenge));

  try {
    const witnessAddress = decodeWitnessAddress(address);
    if (
      witnessAddress.version === 1
      && witnessAddress.program.length === 32
      && witnessAddress.prefix === services.bech32
    ) {
      const pubkeyCandidates = witnessPublicKeyCandidatesFromTaprootProgram(witnessAddress.program);
      for (const candidate of pubkeyCandidates) {
        if (verifyCompactSecp256k1Signature(challengeHash, signatureBytes, candidate)) {
          return {
            publicKeyHex: bytesToHex(candidate),
            publicKeySource: 'taproot-address',
          };
        }
      }
      throw new Error('The supplied signature does not validate for this taproot address.');
    }
  } catch (error) {
    if (!String(error?.message ?? '').includes('Bech32')) {
      throw error;
    }
  }

  const discovered = await discoverPublicKeyFromAddressHistory(address, services, fetchImpl);
  if (!discovered?.publicKeyBytes) {
    throw new Error(
      'Unable to derive a public key for this address. Nintondo compact signatures can only be verified for taproot addresses or addresses with a previously revealed pubkey.',
    );
  }

  if (!verifyCompactSecp256k1Signature(challengeHash, signatureBytes, discovered.publicKeyBytes)) {
    throw new Error('The supplied signature does not validate for this address.');
  }

  return {
    publicKeyHex: bytesToHex(discovered.publicKeyBytes),
    publicKeySource: discovered.source,
  };
}

export async function verifySigninRequest(request, options = {}) {
  if (!isObject(request)) {
    throw new Error('Missing sign-in request data.');
  }

  const services = resolveBellsServices({
    ...options,
    address: request.wallet,
  });
  const nowMs = Number.isSafeInteger(options.nowMs) ? options.nowMs : Date.now();
  if (nowMs > request.expiresMs) {
    throw new Error('The sign-in link has expired.');
  }
  if (request.expiresMs <= request.issuedMs) {
    throw new Error('The sign-in link has an invalid expiry window.');
  }

  const challenge = buildCanonicalSigninChallenge(request);
  const verification = await verifyNintondoRawSignature({
    address: request.wallet,
    signature: request.signature,
    challenge,
    services,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
  });

  return {
    ...request,
    challenge,
    verifiedAt: new Date(nowMs).toISOString(),
    services,
    publicKeyHex: verification.publicKeyHex,
    publicKeySource: verification.publicKeySource,
  };
}

async function fetchOwnerSearchPage(address, page, services, fetchImpl) {
  return fetchJson(buildUrl(services.searchBaseUrl, '/search'), {
    fetchImpl,
    request: {
      method: 'POST',
      ...serializeJsonBody({
        owner: address,
        page,
        page_size: OWNER_SEARCH_PAGE_SIZE,
      }),
    },
  });
}

async function fetchOwnedInscriptionIdsViaOwnerSearch(address, services, fetchImpl) {
  const inscriptionIds = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const payload = await fetchOwnerSearchPage(address, currentPage, services, fetchImpl);
    const inscriptions = Array.isArray(payload?.inscriptions) ? payload.inscriptions : [];
    for (const inscription of inscriptions) {
      if (typeof inscription?.id === 'string' && String(inscription?.file_type ?? '').toUpperCase() === 'JSON') {
        inscriptionIds.push(inscription.id);
      }
    }

    totalPages = Math.max(1, Number(payload?.pages) || 1);
    currentPage += 1;
  } while (currentPage <= totalPages);

  return dedupe(inscriptionIds);
}

function transactionContainsOrdEnvelope(transaction) {
  const vinList = Array.isArray(transaction?.vin) ? transaction.vin : [];
  return vinList.some((vin) => {
    if (typeof vin?.scriptsig === 'string' && vin.scriptsig.toLowerCase().includes('6f7264')) {
      return true;
    }
    const witness = Array.isArray(vin?.witness) ? vin.witness : [];
    return witness.some((item) => typeof item === 'string' && item.toLowerCase().includes('6f7264'));
  });
}

async function fetchAddressHistoryPage(address, cursor, services, fetchImpl) {
  const pathName = cursor
    ? `/address/${address}/txs/chain/${cursor}`
    : `/address/${address}/txs`;
  return fetchJson(buildUrl(services.electrsBaseUrl, pathName), {
    fetchImpl,
  });
}

async function fetchLocations(inscriptionIds, services, fetchImpl) {
  if (!inscriptionIds.length) {
    return [];
  }

  return fetchJson(buildUrl(services.electrsBaseUrl, '/locations'), {
    fetchImpl,
    request: {
      method: 'POST',
      ...serializeJsonBody(inscriptionIds),
    },
  });
}

async function fetchOwnedInscriptionIdsViaHistoryFallback(address, services, fetchImpl) {
  const candidateIds = [];
  let cursor = null;

  for (let pageIndex = 0; pageIndex < MAX_ADDRESS_HISTORY_PAGES; pageIndex += 1) {
    const transactions = await fetchAddressHistoryPage(address, cursor, services, fetchImpl);
    if (!Array.isArray(transactions) || !transactions.length) {
      break;
    }

    for (const transaction of transactions) {
      if (transactionContainsOrdEnvelope(transaction)) {
        candidateIds.push(`${transaction.txid}i0`);
      }
    }

    cursor = transactions.at(-1)?.txid ?? null;
    if (!cursor) {
      break;
    }
  }

  const uniqueCandidates = dedupe(candidateIds);
  if (!uniqueCandidates.length) {
    return [];
  }

  const locations = await fetchLocations(uniqueCandidates, services, fetchImpl);
  return uniqueCandidates.filter((id, index) => locations?.[index]?.owner === address);
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, values.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function normalizePokebellsRecord(record, inscriptionId) {
  if (!isObject(record) || record.p !== 'pokebells') {
    return null;
  }

  return {
    ...record,
    inscription_id: record.inscription_id ?? inscriptionId,
  };
}

async function fetchPokebellsRecordById(inscriptionId, services, fetchImpl) {
  const url = buildUrl(services.contentBaseUrl, `/content/${inscriptionId}`);
  const content = await fetchText(url, { fetchImpl });
  return normalizePokebellsRecord(JSON.parse(content), inscriptionId);
}

async function fetchPokebellsRecordsFromIds(inscriptionIds, services, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const concurrency = Math.max(1, Number(options.fetchConcurrency) || DEFAULT_FETCH_CONCURRENCY);
  const records = await mapWithConcurrency(inscriptionIds, concurrency, async (inscriptionId) => {
    try {
      return await fetchPokebellsRecordById(inscriptionId, services, fetchImpl);
    } catch {
      return null;
    }
  });

  return records.filter(Boolean);
}

export async function fetchOwnedPokebellsCollection(address, options = {}) {
  if (!address) {
    throw new Error('An owner address is required to load PokeBells inscriptions.');
  }

  const services = resolveBellsServices({
    ...options,
    address,
  });
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  let inscriptionIds;
  let source = 'owner-search';

  try {
    inscriptionIds = await fetchOwnedInscriptionIdsViaOwnerSearch(address, services, fetchImpl);
  } catch {
    source = 'address-history-fallback';
    inscriptionIds = await fetchOwnedInscriptionIdsViaHistoryFallback(address, services, fetchImpl);
  }

  const records = await fetchPokebellsRecordsFromIds(inscriptionIds, services, {
    fetchImpl,
    fetchConcurrency: options.fetchConcurrency,
  });

  return {
    address,
    services,
    source,
    inscriptionIds,
    records,
  };
}

const browserExports = {
  BELLS_MAINNET,
  BELLS_TESTNET,
  buildCanonicalSigninChallenge,
  extractInscriptionIdFromLocation,
  fetchOwnedPokebellsCollection,
  parseSigninParamsFromLocation,
  resolveBellsServices,
  verifySigninRequest,
};

if (typeof window !== 'undefined') {
  window.PokeBellsSigninVerify = browserExports;
}

export default browserExports;
