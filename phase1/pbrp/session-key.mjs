// PBRP — PokeBells Realtime Protocol, session key layer (v1, Phase 4.5a).
//
// Why a session key exists:
//   Wallet signatures require a user popup and are too slow for 10 Hz presence
//   broadcasts. A session key is an ephemeral P-256 keypair, generated in the
//   browser, that the wallet authorizes once per session with a single popup.
//   Every realtime envelope is then signed by the session privkey. Relays are
//   dumb transport: they never hold authority. Any client can independently
//   verify that a message was authored by a session key authorized by a given
//   wallet, scoped to a given inscription, and not yet expired.
//
// Layers:
//   1. Wallet authorization (once per session, ~4 h).
//      Challenge: "pokebells:session:v1:<wallet>:<session_pubkey_b64url>:<issued_ms>:<expires_ms>:<inscription_id>"
//      Signed by the wallet over secp256k1 (same primitive as sign-in).
//   2. Envelope signature (every message).
//      Sig over canonicalJson(body), signed by session privkey (P-256 ECDSA,
//      IEEE P1363 64-byte output, encoded as base64url).
//
// Security bounds:
//   - Session key compromise: at most MAX_TTL_MS (4 h) of forged realtime
//     messages. Wallet funds and mint authority are untouched.
//   - Hostile relay: can drop/reorder/censor but cannot forge envelopes
//     without the session privkey.
//   - Replay across inscriptions: blocked by inscription_id in the challenge.
//   - Replay after expiry: blocked by expires_ms check.
//   - Per-wallet sybil: must be rate-limited at the relay, not here.
//
// This module is pure: no DOM, no network. It runs in Node 22+ and any
// browser with Web Crypto (crypto.subtle, P-256 ECDSA).

import { verifyNintondoRawSignature, resolveBellsServices } from '../signin-verify.mjs';

export const SESSION_CHALLENGE_PREFIX = 'pokebells:session:v1';
export const MAX_TTL_MS = 4 * 60 * 60 * 1000;
export const MIN_TTL_MS = 60 * 1000;
export const SESSION_KEY_CURVE = 'P-256';
const ECDSA_SIG_BYTES = 64;
const RAW_P256_PUBKEY_BYTES = 65;
const BECH32_ADDRESS_RE = /^(bel|tpep)1[0-9a-z]{20,90}$/;
const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

function ensureSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto (crypto.subtle) is required for PBRP session keys.');
  }
  return subtle;
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new Error('Expected a BufferSource.');
}

function base64UrlEncode(value) {
  const bytes = toBytes(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlDecode(value) {
  const clean = String(value ?? '').trim();
  if (!clean || /[^A-Za-z0-9_\-=]/.test(clean)) {
    throw new Error('Invalid base64url value.');
  }
  const normalized = clean.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value ?? ''));
}

function isSafeMs(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function assertWallet(wallet) {
  if (typeof wallet !== 'string' || !BECH32_ADDRESS_RE.test(wallet)) {
    throw new Error('Invalid wallet address. Expected Bells bech32 (bel1… or tpep1…).');
  }
}

function assertInscriptionId(inscriptionId) {
  if (typeof inscriptionId !== 'string' || !INSCRIPTION_ID_RE.test(inscriptionId.trim())) {
    throw new Error('Invalid inscription_id. Expected 64 hex chars + "i" + index.');
  }
}

function assertTtlBounds(issuedMs, expiresMs) {
  if (!isSafeMs(issuedMs) || !isSafeMs(expiresMs)) {
    throw new Error('issued and expires must be positive safe integers (ms).');
  }
  if (expiresMs <= issuedMs) {
    throw new Error('expires must be strictly greater than issued.');
  }
  const ttl = expiresMs - issuedMs;
  if (ttl < MIN_TTL_MS) {
    throw new Error(`Session TTL too short (min ${MIN_TTL_MS} ms).`);
  }
  if (ttl > MAX_TTL_MS) {
    throw new Error(`Session TTL exceeds hard cap of ${MAX_TTL_MS} ms (4 h).`);
  }
}

export function buildCanonicalSessionChallenge({
  wallet,
  sessionPubkey,
  issuedMs,
  expiresMs,
  inscriptionId,
}) {
  assertWallet(wallet);
  assertInscriptionId(inscriptionId);
  assertTtlBounds(issuedMs, expiresMs);
  if (typeof sessionPubkey !== 'string' || !sessionPubkey) {
    throw new Error('sessionPubkey must be a non-empty base64url string.');
  }
  const bytes = base64UrlDecode(sessionPubkey);
  if (bytes.length !== RAW_P256_PUBKEY_BYTES || bytes[0] !== 0x04) {
    throw new Error('sessionPubkey must encode a 65-byte uncompressed P-256 point.');
  }
  return `${SESSION_CHALLENGE_PREFIX}:${wallet}:${sessionPubkey}:${issuedMs}:${expiresMs}:${inscriptionId.trim()}`;
}

export async function generateSessionKeypair() {
  const subtle = ensureSubtle();
  const keypair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: SESSION_KEY_CURVE },
    true,
    ['sign', 'verify'],
  );
  const pubkeyBytes = new Uint8Array(await subtle.exportKey('raw', keypair.publicKey));
  return {
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
    publicKeyB64url: base64UrlEncode(pubkeyBytes),
  };
}

export async function importSessionPublicKeyB64url(sessionPubkey) {
  const subtle = ensureSubtle();
  const bytes = base64UrlDecode(sessionPubkey);
  if (bytes.length !== RAW_P256_PUBKEY_BYTES || bytes[0] !== 0x04) {
    throw new Error('sessionPubkey must encode a 65-byte uncompressed P-256 point.');
  }
  return subtle.importKey(
    'raw',
    bytes,
    { name: 'ECDSA', namedCurve: SESSION_KEY_CURVE },
    true,
    ['verify'],
  );
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = canonicalize(value[key]);
  }
  return sorted;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export async function signEnvelopeBody(body, privateKey) {
  const subtle = ensureSubtle();
  const data = utf8Bytes(canonicalJson(body));
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data,
  );
  const bytes = new Uint8Array(signature);
  if (bytes.length !== ECDSA_SIG_BYTES) {
    throw new Error(`Unexpected ECDSA signature length: ${bytes.length}.`);
  }
  return base64UrlEncode(bytes);
}

export async function verifyEnvelopeSignature({ body, sig, sessionPublicKey }) {
  const subtle = ensureSubtle();
  let signatureBytes;
  try {
    signatureBytes = base64UrlDecode(sig);
  } catch {
    return false;
  }
  if (signatureBytes.length !== ECDSA_SIG_BYTES) return false;
  const data = utf8Bytes(canonicalJson(body));
  try {
    return await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      sessionPublicKey,
      signatureBytes,
      data,
    );
  } catch {
    return false;
  }
}

function assertSessionAuthShape(auth) {
  if (!auth || typeof auth !== 'object') {
    throw new Error('Session authorization must be an object.');
  }
  const {
    wallet,
    session_pubkey: sessionPubkey,
    issued,
    expires,
    inscription_id: inscriptionId,
    wallet_sig: walletSig,
  } = auth;
  assertWallet(wallet);
  assertInscriptionId(inscriptionId);
  assertTtlBounds(issued, expires);
  if (typeof sessionPubkey !== 'string' || !sessionPubkey) {
    throw new Error('session_pubkey must be a non-empty base64url string.');
  }
  if (typeof walletSig !== 'string' || !walletSig) {
    throw new Error('wallet_sig must be a non-empty string.');
  }
  return { wallet, sessionPubkey, issuedMs: issued, expiresMs: expires, inscriptionId: inscriptionId.trim(), walletSig };
}

export async function verifySessionAuthorization(auth, options = {}) {
  const parsed = assertSessionAuthShape(auth);
  const nowMs = Number.isSafeInteger(options.nowMs) ? options.nowMs : Date.now();
  if (nowMs >= parsed.expiresMs) {
    throw new Error('Session authorization has expired.');
  }
  if (options.expectedInscriptionId && parsed.inscriptionId !== String(options.expectedInscriptionId).trim()) {
    throw new Error('Session authorization is scoped to a different inscription.');
  }
  const challenge = buildCanonicalSessionChallenge({
    wallet: parsed.wallet,
    sessionPubkey: parsed.sessionPubkey,
    issuedMs: parsed.issuedMs,
    expiresMs: parsed.expiresMs,
    inscriptionId: parsed.inscriptionId,
  });
  const services = resolveBellsServices({ ...options, address: parsed.wallet });
  const verification = await verifyNintondoRawSignature({
    address: parsed.wallet,
    signature: parsed.walletSig,
    challenge,
    services,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
  });
  const sessionPublicKey = await importSessionPublicKeyB64url(parsed.sessionPubkey);
  return {
    wallet: parsed.wallet,
    inscriptionId: parsed.inscriptionId,
    sessionPubkeyB64url: parsed.sessionPubkey,
    sessionPublicKey,
    issuedMs: parsed.issuedMs,
    expiresMs: parsed.expiresMs,
    walletPublicKeyHex: verification.publicKeyHex,
    walletPublicKeySource: verification.publicKeySource,
    verifiedAtMs: nowMs,
  };
}
