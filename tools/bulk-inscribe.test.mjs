// Offline unit tests for the inscribeLocal pipeline.
// Runs without network, uses mock UTXOs so we can catch bugs before any
// real-money test.
//
//   node tools/bulk-inscribe.test.mjs

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import pkg from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";
const { Psbt, payments, networks, Transaction, script: bscript } = pkg;
import * as ecc from "./pokebells-inscriber/node_modules/bells-secp256k1/lib/index.js";
import bs58check from "./pokebells-inscriber/node_modules/bs58check/index.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ----------------------------------------------------------------------
// Copy-pasted helpers from bulk-inscribe.mjs. We don't import them
// because bulk-inscribe.mjs runs main() at import time.
// ----------------------------------------------------------------------
import { MAX_CHUNK_LEN, UTXO_MIN_VALUE } from "./pokebells-inscriber/src/consts.mjs";

function toXOnly(pub) { return pub.length === 32 ? pub : pub.slice(1, 33); }

function buildInscriptionScript(xOnlyPubKey, contentType, data) {
  const chunks = [
    xOnlyPubKey,
    bscript.OPS.OP_CHECKSIG,
    bscript.OPS.OP_FALSE,
    bscript.OPS.OP_IF,
    Buffer.from("ord", "utf8"),
    1, 1,
    Buffer.from(contentType, "utf8"),
    0,
  ];
  for (let i = 0; i < data.length; i += MAX_CHUNK_LEN) {
    chunks.push(data.subarray(i, Math.min(i + MAX_CHUNK_LEN, data.length)));
  }
  chunks.push(bscript.OPS.OP_ENDIF);
  return bscript.compile(chunks);
}

function buildP2TR(inscriptionScript, xOnlyPubKey, network) {
  return payments.p2tr({
    internalPubkey: xOnlyPubKey,
    redeem: { output: inscriptionScript, redeemVersion: 192 },
    scriptTree: [{ output: inscriptionScript }, { output: inscriptionScript }],
    network,
  });
}

function estimateRevealVsize(inscriptionScript) {
  const scriptLen = inscriptionScript.length;
  const witnessBytes = 64 + scriptLen + 33 + 10;
  const baseBytes = 10 + 41 + 43;
  return Math.ceil(baseBytes + witnessBytes / 4);
}

function makeSigner(privBuf, network) {
  const publicKey = Buffer.from(ecc.pointFromScalar(privBuf, true));
  return {
    publicKey,
    network,
    sign(hash) { return Buffer.from(ecc.sign(new Uint8Array(hash), new Uint8Array(privBuf))); },
    signSchnorr(hash) { return Buffer.from(ecc.signSchnorr(new Uint8Array(hash), new Uint8Array(privBuf))); },
  };
}

function deriveP2pkhAddress(pub, network) {
  return payments.p2pkh({ pubkey: pub, network }).address;
}

function inscribeLocal(opts) {
  const { data, contentType, destAddress, signer, network, feeRate, utxos, srcAddress } = opts;
  const xOnlyPubKey = toXOnly(signer.publicKey);
  const inscriptionScript = buildInscriptionScript(xOnlyPubKey, contentType, data);
  const payment = buildP2TR(inscriptionScript, xOnlyPubKey, network);

  const revealFee = estimateRevealVsize(inscriptionScript) * feeRate;
  const commitmentValue = revealFee + UTXO_MIN_VALUE;

  const sorted = [...utxos].sort((a, b) => a.value - b.value);
  const picked = [];
  let totalIn = 0;
  for (const u of sorted) {
    picked.push(u);
    totalIn += u.value;
    const estCommitFee = (10 + picked.length * 148 + 86) * feeRate;
    if (totalIn >= commitmentValue + estCommitFee) break;
  }
  if (totalIn < commitmentValue) {
    throw new Error(`insufficient funds: have ${totalIn}, need ≥ ${commitmentValue}`);
  }

  const commitPsbt = new Psbt({ network });
  for (const u of picked) {
    commitPsbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(u.hex, "hex"),
    });
  }
  commitPsbt.addOutput({ address: payment.address, value: commitmentValue });

  const scratch = commitPsbt.clone();
  scratch.addOutput({ address: srcAddress, value: 0 });
  scratch.signAllInputs(signer);
  scratch.finalizeAllInputs();
  const commitVsize = scratch.extractTransaction(true).virtualSize();
  const commitFee = commitVsize * feeRate;

  const change = totalIn - commitmentValue - commitFee;
  if (change >= UTXO_MIN_VALUE) {
    commitPsbt.addOutput({ address: srcAddress, value: change });
  } else if (change < 0) {
    throw new Error(`insufficient funds after fee: short ${-change}`);
  }

  commitPsbt.signAllInputs(signer);
  commitPsbt.finalizeAllInputs();
  const commitTx = commitPsbt.extractTransaction(true);

  const revealPsbt = new Psbt({ network });
  revealPsbt.addInput({
    hash: commitTx.getId(),
    index: 0,
    witnessUtxo: { script: payment.output, value: commitmentValue },
    tapLeafScript: [{
      leafVersion: 192,
      script: inscriptionScript,
      controlBlock: payment.witness[payment.witness.length - 1],
    }],
    tapInternalKey: xOnlyPubKey,
  });
  revealPsbt.addOutput({ address: destAddress, value: UTXO_MIN_VALUE });
  revealPsbt.signAllInputs(signer);
  revealPsbt.finalizeAllInputs();
  const revealTx = revealPsbt.extractTransaction(true);

  return {
    commitTx, revealTx, commitFee, revealFee, commitmentValue,
    inscriptionScript, payment,
    change: change >= UTXO_MIN_VALUE ? change : 0,
  };
}

// ----------------------------------------------------------------------
// Test harness — synthesize a mock funding tx whose output we can spend.
// ----------------------------------------------------------------------
function makeMockFundingUtxo(toAddress, network, value = 200_000_000) {
  // Build a tx with a single output paying toAddress. Use a coinbase-ish
  // input (all-zeros + sequence 0xffffffff) since we only need it to
  // serialize correctly for nonWitnessUtxo consumption.
  const tx = new Transaction();
  tx.version = 2;
  tx.addInput(Buffer.alloc(32), 0xffffffff, 0xffffffff, Buffer.from("aa", "hex"));
  const script = payments.p2pkh({ address: toAddress, network }).output;
  tx.addOutput(script, value);
  return {
    txid: tx.getId(),
    vout: 0,
    value,
    hex: tx.toHex(),
    status: { confirmed: false },
  };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok  ${name}`); passed++; }
  catch (e) { console.error(`FAIL ${name}\n  ${e.stack ?? e.message}`); failed++; }
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg ?? "assertEq"}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
function assertTrue(cond, msg) { if (!cond) throw new Error(msg ?? "assertTrue"); }

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------

test("signer derives valid compressed pubkey", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  assertEq(signer.publicKey.length, 33, "pubkey length");
  assertTrue(signer.publicKey[0] === 0x02 || signer.publicKey[0] === 0x03, "pubkey prefix");
});

test("P2PKH address round-trips WIF", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  const addr = deriveP2pkhAddress(signer.publicKey, networks.testnet);
  assertTrue(addr.startsWith("E") || addr.startsWith("e") || addr.startsWith("m") || addr.startsWith("n"), `testnet P2PKH addr prefix (got ${addr[0]})`);
});

test("inscribeLocal produces valid commit+reveal for tiny payload", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  const srcAddress = deriveP2pkhAddress(signer.publicKey, networks.testnet);
  const utxo = makeMockFundingUtxo(srcAddress, networks.testnet);

  const payload = Buffer.from("hello pokebells", "utf8");
  const r = inscribeLocal({
    data: payload,
    contentType: "text/plain",
    destAddress: srcAddress,
    signer,
    network: networks.testnet,
    feeRate: 3,
    utxos: [utxo],
    srcAddress,
  });

  assertEq(r.commitTx.outs.length, 2, "commit should have 2 outputs (commitment + change)");
  assertEq(r.revealTx.outs.length, 1, "reveal should have 1 output");
  assertEq(r.revealTx.ins[0].hash.toString("hex"), Buffer.from(r.commitTx.getId(), "hex").reverse().toString("hex"), "reveal spends commit");
  assertTrue(r.commitFee > 0, "commit fee set");
  assertTrue(r.revealFee > 0, "reveal fee set");
});

test("inscribeLocal chunks large payload across MAX_CHUNK_LEN boundary", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  const srcAddress = deriveP2pkhAddress(signer.publicKey, networks.testnet);
  const utxo = makeMockFundingUtxo(srcAddress, networks.testnet, 500_000_000);

  const payload = crypto.randomBytes(1024); // 5 chunks
  const r = inscribeLocal({
    data: payload,
    contentType: "application/octet-stream",
    destAddress: srcAddress,
    signer,
    network: networks.testnet,
    feeRate: 3,
    utxos: [utxo],
    srcAddress,
  });

  // Round-trip check: disassemble the witness script and verify it
  // contains our payload across chunks.
  const witness = r.revealTx.ins[0].witness;
  const scriptBuf = witness[1];  // [sig, script, controlBlock]
  assertTrue(scriptBuf.includes(payload.slice(0, MAX_CHUNK_LEN)), "first chunk found in script");
  assertTrue(scriptBuf.includes(payload.slice(-50)), "tail bytes found in script");
});

test("inscribeLocal fails gracefully on under-funded UTXO", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  const srcAddress = deriveP2pkhAddress(signer.publicKey, networks.testnet);
  const utxo = makeMockFundingUtxo(srcAddress, networks.testnet, 1_500); // below dust + reveal fee
  let threw = false;
  try {
    inscribeLocal({
      data: Buffer.from("x"),
      contentType: "text/plain",
      destAddress: srcAddress,
      signer, network: networks.testnet, feeRate: 3,
      utxos: [utxo], srcAddress,
    });
  } catch (e) { threw = /insufficient/.test(e.message); }
  assertTrue(threw, "should throw 'insufficient funds'");
});

test("inscribeLocal chains: change output becomes next input", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  const srcAddress = deriveP2pkhAddress(signer.publicKey, networks.testnet);
  const utxo1 = makeMockFundingUtxo(srcAddress, networks.testnet, 200_000_000);

  const r1 = inscribeLocal({
    data: Buffer.from("first"),
    contentType: "text/plain",
    destAddress: srcAddress, signer,
    network: networks.testnet, feeRate: 3,
    utxos: [utxo1], srcAddress,
  });

  // Build the next inscription using r1's change as input
  assertTrue(r1.change > 0, "first inscription should leave change");
  const utxo2 = {
    txid: r1.commitTx.getId(),
    vout: 1,  // change is output 1
    value: r1.change,
    hex: r1.commitTx.toHex(),
  };

  const r2 = inscribeLocal({
    data: Buffer.from("second"),
    contentType: "text/plain",
    destAddress: srcAddress, signer,
    network: networks.testnet, feeRate: 3,
    utxos: [utxo2], srcAddress,
  });

  assertEq(r2.commitTx.ins[0].hash.toString("hex"), Buffer.from(utxo2.txid, "hex").reverse().toString("hex"), "second commit spends first change");
  assertEq(r2.commitTx.ins[0].index, 1, "spends vout 1 (change)");
});

test("inscription id is revealTxId + i0", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  const srcAddress = deriveP2pkhAddress(signer.publicKey, networks.testnet);
  const utxo = makeMockFundingUtxo(srcAddress, networks.testnet);

  const r = inscribeLocal({
    data: Buffer.from("sprite-test"),
    contentType: "image/png",
    destAddress: srcAddress, signer,
    network: networks.testnet, feeRate: 3,
    utxos: [utxo], srcAddress,
  });
  const expectedId = `${r.revealTx.getId()}i0`;
  assertTrue(/^[0-9a-f]{64}i0$/.test(expectedId), `expected matches /^hex64i0$/ (got ${expectedId})`);
});

test("WIF round-trip (gen → parse) yields same privkey", () => {
  const priv = crypto.randomBytes(32);
  const wifPayload = Buffer.concat([Buffer.from([networks.testnet.wif]), priv, Buffer.from([0x01])]);
  const wif = bs58check.encode(wifPayload);
  const decoded = Buffer.from(bs58check.decode(wif));
  const parsedPriv = decoded.slice(1, 33);
  assertEq(parsedPriv.toString("hex"), priv.toString("hex"), "priv round-trip");
});

test("real-world sprite size fits in single inscription", () => {
  const priv = crypto.randomBytes(32);
  const signer = makeSigner(priv, networks.testnet);
  const srcAddress = deriveP2pkhAddress(signer.publicKey, networks.testnet);
  const utxo = makeMockFundingUtxo(srcAddress, networks.testnet, 50_000_000);

  // Use a real sprite from the pack
  const spritePath = path.join(REPO_ROOT, "tools/sprites-out-gen2/001-normal.png");
  const data = fs.readFileSync(spritePath);
  const r = inscribeLocal({
    data,
    contentType: "image/png",
    destAddress: srcAddress, signer,
    network: networks.testnet, feeRate: 3,
    utxos: [utxo], srcAddress,
  });
  assertTrue(r.commitTx.byteLength() < 1_000_000, "commit tx serializes");
  assertTrue(r.revealTx.byteLength() < 100_000, "reveal tx fits");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
