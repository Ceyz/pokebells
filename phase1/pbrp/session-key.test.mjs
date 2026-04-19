import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_TTL_MS,
  MIN_TTL_MS,
  SESSION_CHALLENGE_PREFIX,
  buildCanonicalSessionChallenge,
  canonicalJson,
  generateSessionKeypair,
  importSessionPublicKeyB64url,
  signEnvelopeBody,
  verifyEnvelopeSignature,
  verifySessionAuthorization,
} from './session-key.mjs';

const VALID_WALLET_MAINNET = 'bel1pq89re30lzrj5m3sp9wx47svz6a6pj0kg2yudynaxzz3p30ld97qsvgw8s5';
const VALID_WALLET_TESTNET = 'tpep1q0000000000000000000000000000000000000000';
const VALID_WALLET_LEGACY = 'BFADD6RogcM2rJ1QjPGZ4yFZkFRnRyoSGo';
const VALID_INSCRIPTION = '58bf94bfb7214a783656e792dc39490e2a70dd59e9c9221c923f0e4300407681i0';

async function freshSession() {
  const { privateKey, publicKey, publicKeyB64url } = await generateSessionKeypair();
  return { privateKey, publicKey, publicKeyB64url };
}

test('buildCanonicalSessionChallenge formats the canonical string', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  const challenge = buildCanonicalSessionChallenge({
    wallet: VALID_WALLET_MAINNET,
    sessionPubkey: publicKeyB64url,
    issuedMs: issued,
    expiresMs: expires,
    inscriptionId: VALID_INSCRIPTION,
  });
  assert.equal(
    challenge,
    `${SESSION_CHALLENGE_PREFIX}:${VALID_WALLET_MAINNET}:${publicKeyB64url}:${issued}:${expires}:${VALID_INSCRIPTION}`,
  );
});

test('buildCanonicalSessionChallenge rejects bad wallet formats', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  for (const wallet of ['', 'not-bech32', '1btc...', 'bc1qxyz']) {
    assert.throws(
      () => buildCanonicalSessionChallenge({
        wallet,
        sessionPubkey: publicKeyB64url,
        issuedMs: issued,
        expiresMs: expires,
        inscriptionId: VALID_INSCRIPTION,
      }),
      /Invalid wallet address/,
      `wallet=${wallet} should be rejected`,
    );
  }
});

test('buildCanonicalSessionChallenge accepts testnet prefix', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  assert.doesNotThrow(() => buildCanonicalSessionChallenge({
    wallet: VALID_WALLET_TESTNET,
    sessionPubkey: publicKeyB64url,
    issuedMs: issued,
    expiresMs: expires,
    inscriptionId: VALID_INSCRIPTION,
  }));
});

test('buildCanonicalSessionChallenge accepts legacy base58 Bells addresses', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  assert.doesNotThrow(() => buildCanonicalSessionChallenge({
    wallet: VALID_WALLET_LEGACY,
    sessionPubkey: publicKeyB64url,
    issuedMs: issued,
    expiresMs: expires,
    inscriptionId: VALID_INSCRIPTION,
  }));
});

test('buildCanonicalSessionChallenge rejects bad inscription id', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  for (const inscriptionId of ['', 'abc', 'not-an-id', 'deadbeefi0']) {
    assert.throws(
      () => buildCanonicalSessionChallenge({
        wallet: VALID_WALLET_MAINNET,
        sessionPubkey: publicKeyB64url,
        issuedMs: issued,
        expiresMs: expires,
        inscriptionId,
      }),
      /Invalid inscription_id/,
    );
  }
});

test('buildCanonicalSessionChallenge enforces TTL bounds', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  assert.throws(
    () => buildCanonicalSessionChallenge({
      wallet: VALID_WALLET_MAINNET,
      sessionPubkey: publicKeyB64url,
      issuedMs: issued,
      expiresMs: issued,
      inscriptionId: VALID_INSCRIPTION,
    }),
    /expires must be strictly greater than issued/,
  );
  assert.throws(
    () => buildCanonicalSessionChallenge({
      wallet: VALID_WALLET_MAINNET,
      sessionPubkey: publicKeyB64url,
      issuedMs: issued,
      expiresMs: issued + 100,
      inscriptionId: VALID_INSCRIPTION,
    }),
    /too short/,
  );
  assert.throws(
    () => buildCanonicalSessionChallenge({
      wallet: VALID_WALLET_MAINNET,
      sessionPubkey: publicKeyB64url,
      issuedMs: issued,
      expiresMs: issued + MAX_TTL_MS + 1,
      inscriptionId: VALID_INSCRIPTION,
    }),
    /exceeds hard cap/,
  );
});

test('buildCanonicalSessionChallenge rejects malformed sessionPubkey', async () => {
  const issued = 1_776_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  for (const sessionPubkey of ['', 'not base64!', 'QUJD']) {
    assert.throws(
      () => buildCanonicalSessionChallenge({
        wallet: VALID_WALLET_MAINNET,
        sessionPubkey,
        issuedMs: issued,
        expiresMs: expires,
        inscriptionId: VALID_INSCRIPTION,
      }),
      /sessionPubkey|base64url/,
      `sessionPubkey=${JSON.stringify(sessionPubkey)} should be rejected`,
    );
  }
});

test('generateSessionKeypair returns exportable P-256 public key', async () => {
  const { publicKeyB64url, privateKey, publicKey } = await freshSession();
  assert.ok(privateKey);
  assert.ok(publicKey);
  assert.equal(publicKey.algorithm.name, 'ECDSA');
  assert.equal(publicKey.algorithm.namedCurve, 'P-256');
  const imported = await importSessionPublicKeyB64url(publicKeyB64url);
  assert.equal(imported.algorithm.name, 'ECDSA');
  assert.equal(imported.algorithm.namedCurve, 'P-256');
});

test('canonicalJson sorts keys at every depth', () => {
  const left = canonicalJson({ b: 1, a: { z: 2, y: [3, { k: 1, j: 2 }] } });
  const right = canonicalJson({ a: { y: [3, { j: 2, k: 1 }], z: 2 }, b: 1 });
  assert.equal(left, right);
  assert.equal(left, '{"a":{"y":[3,{"j":2,"k":1}],"z":2},"b":1}');
});

test('signEnvelopeBody + verifyEnvelopeSignature round-trip', async () => {
  const { privateKey, publicKeyB64url } = await freshSession();
  const body = {
    type: 'presence',
    map_id: 'route-1',
    x: 120,
    y: 88,
    seq: 17,
    issued: 1_776_000_000_000,
    expires: 1_776_000_002_000,
  };
  const sig = await signEnvelopeBody(body, privateKey);
  const publicKey = await importSessionPublicKeyB64url(publicKeyB64url);
  const ok = await verifyEnvelopeSignature({ body, sig, sessionPublicKey: publicKey });
  assert.equal(ok, true);
});

test('verifyEnvelopeSignature rejects tampered body', async () => {
  const { privateKey, publicKeyB64url } = await freshSession();
  const body = { type: 'chat', text: 'hello', seq: 1, expires: 2 };
  const sig = await signEnvelopeBody(body, privateKey);
  const publicKey = await importSessionPublicKeyB64url(publicKeyB64url);
  const tampered = { ...body, text: 'hello!' };
  const ok = await verifyEnvelopeSignature({ body: tampered, sig, sessionPublicKey: publicKey });
  assert.equal(ok, false);
});

test('verifyEnvelopeSignature rejects a different session key', async () => {
  const signer = await freshSession();
  const other = await freshSession();
  const body = { type: 'chat', text: 'hello', seq: 1, expires: 2 };
  const sig = await signEnvelopeBody(body, signer.privateKey);
  const otherPublicKey = await importSessionPublicKeyB64url(other.publicKeyB64url);
  const ok = await verifyEnvelopeSignature({ body, sig, sessionPublicKey: otherPublicKey });
  assert.equal(ok, false);
});

test('verifyEnvelopeSignature rejects malformed signatures', async () => {
  const { publicKeyB64url } = await freshSession();
  const publicKey = await importSessionPublicKeyB64url(publicKeyB64url);
  for (const sig of ['', 'not base64!', 'QUJD']) {
    const ok = await verifyEnvelopeSignature({ body: { x: 1 }, sig, sessionPublicKey: publicKey });
    assert.equal(ok, false, `malformed sig "${sig}" should be rejected`);
  }
});

test('canonicalJson is insertion-order insensitive under re-serialization', async () => {
  const { privateKey, publicKeyB64url } = await freshSession();
  const a = { z: 1, a: 2, m: { b: 1, a: [1, 2] } };
  const b = { a: 2, m: { a: [1, 2], b: 1 }, z: 1 };
  const sig = await signEnvelopeBody(a, privateKey);
  const publicKey = await importSessionPublicKeyB64url(publicKeyB64url);
  const ok = await verifyEnvelopeSignature({ body: b, sig, sessionPublicKey: publicKey });
  assert.equal(ok, true);
});

test('importSessionPublicKeyB64url rejects non-P-256-raw inputs', async () => {
  for (const bad of ['', 'QUJD', 'AAECAwQFBgcICQ']) {
    await assert.rejects(() => importSessionPublicKeyB64url(bad));
  }
});

test('verifySessionAuthorization rejects bad shape before any crypto', async () => {
  await assert.rejects(() => verifySessionAuthorization(null), /must be an object/);
  await assert.rejects(() => verifySessionAuthorization({}), /Invalid wallet address/);
});

test('verifySessionAuthorization rejects expired authorization', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_700_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  await assert.rejects(
    () => verifySessionAuthorization(
      {
        wallet: VALID_WALLET_MAINNET,
        session_pubkey: publicKeyB64url,
        issued,
        expires,
        inscription_id: VALID_INSCRIPTION,
        wallet_sig: 'A'.repeat(88),
      },
      { nowMs: expires + 1 },
    ),
    /expired/,
  );
});

test('verifySessionAuthorization enforces inscription scope', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  const expires = issued + 60 * 60 * 1000;
  await assert.rejects(
    () => verifySessionAuthorization(
      {
        wallet: VALID_WALLET_MAINNET,
        session_pubkey: publicKeyB64url,
        issued,
        expires,
        inscription_id: VALID_INSCRIPTION,
        wallet_sig: 'A'.repeat(88),
      },
      { nowMs: issued + 1000, expectedInscriptionId: 'deadbeef'.repeat(8) + 'i0' },
    ),
    /different inscription/,
  );
});

test('verifySessionAuthorization enforces TTL cap', async () => {
  const { publicKeyB64url } = await freshSession();
  const issued = 1_776_000_000_000;
  const expires = issued + MAX_TTL_MS + 1;
  await assert.rejects(
    () => verifySessionAuthorization(
      {
        wallet: VALID_WALLET_MAINNET,
        session_pubkey: publicKeyB64url,
        issued,
        expires,
        inscription_id: VALID_INSCRIPTION,
        wallet_sig: 'A'.repeat(88),
      },
      { nowMs: issued + 1000 },
    ),
    /hard cap/,
  );
});

test('MIN_TTL_MS and MAX_TTL_MS are sane', () => {
  assert.ok(MIN_TTL_MS >= 60 * 1000);
  assert.equal(MAX_TTL_MS, 4 * 60 * 60 * 1000);
});
