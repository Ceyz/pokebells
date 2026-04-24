#!/usr/bin/env node
// PokeBells Phase 0 probe — sat-spend-v1 feasibility test on Bells testnet.
//
// Goal: verify that the Bells inscription pipeline (belcoinjs-lib + vendored
// bells-inscriber) lets us deliberately spend a specific UTXO as the commit
// tx input of a second inscription. This is the cryptographic primitive
// op:"collection_update" will rely on in Phase B (see game/ROOT-APP-DESIGN.md).
//
// Procedure (automatic, one invocation):
//   1. Inscribe a dummy `p:pokebells-collection-probe` body.
//   2. Wait for confirmation; note the reveal tx's dust output = the
//      inscription sat UTXO (546 sats at the operator address).
//   3. Inscribe a dummy `op:"collection-update-probe"` body. Use the greedy
//      smallest-first UTXO picker — the 546-sat inscription UTXO is the
//      smallest funded output in the wallet, so it MUST be picked as the
//      first input. If greedy picks it + a funding UTXO, the commit tx
//      deliberately spends the inscription UTXO.
//   4. After the second reveal confirms, fetch the second commit tx via
//      electrs and verify its inputs include the first reveal tx's output 0.
//   5. Fetch both inscription bodies via the content host to confirm both
//      are still readable (i.e., the sat-move didn't orphan them).
//   6. Print PASS / FAIL summary.
//
// Usage:
//   node tools/probe-sat-spend.mjs \
//     --key-file /tmp/probe.key \
//     --network bells-testnet \
//     --fee-rate 3 \
//     --log tools/probe-sat-spend.log
//
// Pre-reqs:
//   - A testnet BELS wallet with ~50,000 sats funded at the key-file address.
//   - Run `node tools/gen-bells-wallet.mjs` to generate a throwaway key file.
//
// After the probe, shred the key file: `shred -u /tmp/probe.key`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pkg from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";
const { Psbt, payments, networks, Transaction } = pkg;
import * as ecc from "./pokebells-inscriber/node_modules/bells-secp256k1/lib/index.js";
import bs58check from "./pokebells-inscriber/node_modules/bs58check/index.js";
import { MAX_CHUNK_LEN, UTXO_MIN_VALUE } from "./pokebells-inscriber/src/consts.mjs";
import { script as bscript } from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_ELECTRS = {
  "bells-mainnet": "https://api.nintondo.io",
  "bells-testnet": "https://bells-testnet-api.nintondo.io",
};
const DEFAULT_CONTENT = {
  "bells-mainnet": "https://bells-mainnet-content.nintondo.io/content/",
  "bells-testnet": "https://bells-testnet-content.nintondo.io/content/",
};
const BELLS_NETWORKS = {
  "bells-mainnet": {
    messagePrefix: "\x18Bells Signed Message:\n",
    bech32: "bel",
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x19,
    scriptHash: 0x1e,
    wif: 0x99,
  },
  "bells-testnet": {
    messagePrefix: "\x18Bells Signed Message:\n",
    bech32: "tbel",
    bip32: { public: 0x043587cf, private: 0x04358394 },
    pubKeyHash: 0x7f,
    scriptHash: 0xc4,
    wif: 0xef,
  },
};

// -----------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------
function parseArgs(argv) {
  const o = { keyFile: null, network: "bells-testnet", electrs: null, contentBase: null, feeRate: 3, log: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === "--key-file") o.keyFile = v();
    else if (a === "--network") o.network = v();
    else if (a === "--electrs") o.electrs = v();
    else if (a === "--content-base") o.contentBase = v();
    else if (a === "--fee-rate") o.feeRate = parseInt(v(), 10);
    else if (a === "--log") o.log = v();
    else if (a === "--help" || a === "-h") { usage(); process.exit(0); }
  }
  if (!o.keyFile) { usage(); process.exit(2); }
  o.electrs ??= DEFAULT_ELECTRS[o.network];
  o.contentBase ??= DEFAULT_CONTENT[o.network];
  if (!o.electrs || !o.contentBase) {
    console.error(`[fatal] unknown network "${o.network}"`);
    process.exit(2);
  }
  return o;
}

function usage() {
  console.log(
    "Usage: node tools/probe-sat-spend.mjs --key-file <path> [--network bells-testnet] [--electrs <url>] [--fee-rate 3] [--log <path>]\n"
    + "  Runs a two-step inscription probe. Needs ~50,000 sats in the WIF's address.",
  );
}

// -----------------------------------------------------------------------
// Wallet + electrs
// -----------------------------------------------------------------------
function loadWif(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  return raw.split(/\s+/)[0];
}

function wifToKeyPair(wif, network) {
  const decoded = bs58check.decode(wif);
  const keyByte = decoded[0];
  if (keyByte !== network.wif) {
    throw new Error(`wif version byte ${keyByte.toString(16)} does not match network (${network.wif.toString(16)})`);
  }
  const priv = Buffer.from(decoded.slice(1, 33));
  const compressed = decoded.length === 34;
  const pub = Buffer.from(ecc.pointFromScalar(priv, compressed));
  return {
    privateKey: priv,
    publicKey: pub,
    sign: (hash) => Buffer.from(ecc.sign(hash, priv)),
    signSchnorr: (hash) => Buffer.from(ecc.signSchnorr(hash, priv)),
    network,
    compressed,
  };
}

function deriveP2pkhAddress(publicKey, network) {
  return payments.p2pkh({ pubkey: publicKey, network }).address;
}

class Electrs {
  constructor(base) { this.base = base.replace(/\/$/, ""); }
  async _get(p, asText = false) {
    const r = await fetch(`${this.base}${p}`);
    if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`);
    return asText ? r.text() : r.json();
  }
  async utxos(addr) { return this._get(`/address/${addr}/utxo`); }
  async txHex(txid) { return this._get(`/tx/${txid}/hex`, true); }
  async txStatus(txid) { return this._get(`/tx/${txid}/status`); }
  async tx(txid) { return this._get(`/tx/${txid}`); }
  async broadcast(hex) {
    const r = await fetch(`${this.base}/tx`, { method: "POST", body: hex });
    const text = await r.text();
    if (!r.ok) throw new Error(`broadcast failed (${r.status}): ${text}`);
    return text.trim();
  }
}

async function waitForConfirmation(electrs, txid, timeoutMs = 20 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  process.stdout.write(`  waiting for ${txid.slice(0, 16)}…`);
  while (Date.now() < deadline) {
    attempts++;
    try {
      const s = await electrs.txStatus(txid);
      if (s?.confirmed) {
        process.stdout.write(` confirmed at ${s.block_height} (${attempts} polls)\n`);
        return { confirmed: true, height: s.block_height };
      }
    } catch (e) {
      if (!/404/.test(String(e.message))) throw e;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, Math.min(5000 + attempts * 1000, 15_000)));
  }
  throw new Error(`confirmation timeout for ${txid}`);
}

// -----------------------------------------------------------------------
// Inscription builder (copy of bulk-inscribe.mjs inscribeLocal)
// -----------------------------------------------------------------------
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

function toXOnly(pub) { return pub.length === 32 ? pub : pub.slice(1, 33); }

function estimateRevealVsize(inscriptionScript) {
  const scriptLen = inscriptionScript.length;
  const witnessBytes = 64 + scriptLen + 33 + 10;
  const baseBytes = 10 + 41 + 43;
  return Math.ceil(baseBytes + witnessBytes / 4);
}

async function inscribe({ data, contentType, destAddress, signer, network, feeRate, utxos, srcAddress }) {
  const xOnlyPubKey = toXOnly(signer.publicKey);
  const inscriptionScript = buildInscriptionScript(xOnlyPubKey, contentType, data);
  const payment = buildP2TR(inscriptionScript, xOnlyPubKey, network);
  const revealVsize = estimateRevealVsize(inscriptionScript);
  const revealFee = revealVsize * feeRate;
  const commitmentValue = revealFee + UTXO_MIN_VALUE;

  // Greedy smallest-first pick — this is the key behavior for the probe.
  // The inscription UTXO from step 1 (546 sats) is the smallest funded
  // output, so it MUST be picked first.
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
    throw new Error(`insufficient funds: have ${totalIn} sats across ${picked.length} UTXOs, need ≥ ${commitmentValue} + fee`);
  }

  // Commit tx — mirrors tools/bulk-inscribe.mjs inscribeLocal.
  const commitPsbt = new Psbt({ network });
  for (const u of picked) {
    commitPsbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(u.hex, "hex"),
    });
  }
  commitPsbt.addOutput({ address: payment.address, value: commitmentValue });

  // Scratch sign to learn commit vsize before deciding on change.
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
    throw new Error(`insufficient funds after fee calc: short by ${-change} sats`);
  }
  commitPsbt.signAllInputs(signer);
  commitPsbt.finalizeAllInputs();
  const commitTx = commitPsbt.extractTransaction(true);
  const commitTxid = commitTx.getId();
  const commitHex = commitTx.toHex();

  // Reveal tx — tapscript-spend the commit output.
  const revealPsbt = new Psbt({ network });
  revealPsbt.addInput({
    hash: commitTxid,
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
  const revealTxid = revealTx.getId();
  const revealHex = revealTx.toHex();

  return {
    commitTxid,
    commitHex,
    revealTxid,
    revealHex,
    inscriptionId: `${revealTxid}i0`,
    pickedInputs: picked.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value })),
    commitChangeVout: change >= UTXO_MIN_VALUE ? 1 : null,
    commitChangeValue: change >= UTXO_MIN_VALUE ? change : 0,
    revealDust: { txid: revealTxid, vout: 0, value: UTXO_MIN_VALUE },
  };
}

async function hydrateUtxos(electrs, rawUtxos) {
  const out = [];
  for (const u of rawUtxos) {
    const hex = await electrs.txHex(u.txid);
    out.push({ ...u, hex });
  }
  return out;
}

// -----------------------------------------------------------------------
// Main probe
// -----------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const net = BELLS_NETWORKS[opts.network];
  const electrs = new Electrs(opts.electrs);

  const wif = loadWif(opts.keyFile);
  const signer = wifToKeyPair(wif, net);
  const addr = deriveP2pkhAddress(signer.publicKey, net);

  const log = [];
  const logLine = (s) => { console.log(s); log.push(s); };

  logLine(`[probe] address: ${addr}`);
  logLine(`[probe] network: ${opts.network}`);
  logLine(`[probe] electrs: ${opts.electrs}`);
  logLine(`[probe] content: ${opts.contentBase}`);
  logLine(`[probe] fee rate: ${opts.feeRate} sat/vB\n`);

  // ---- Phase 1: dummy collection inscription ----
  logLine("[step 1] fetching UTXOs for initial collection-probe inscription");
  const utxos1 = await hydrateUtxos(electrs, await electrs.utxos(addr));
  const balance1 = utxos1.reduce((s, u) => s + u.value, 0);
  logLine(`         ${utxos1.length} UTXO(s), ${balance1} sats total`);
  if (balance1 < 30000) {
    logLine(`[fatal] need ≥ 30000 sats to run probe. Fund ${addr} and retry.`);
    process.exit(3);
  }

  const body1 = JSON.stringify({
    p: "pokebells-collection-probe",
    v: 1,
    probe: "phase-0-sat-spend-v1",
    note: "Dummy collection body inscribed by tools/probe-sat-spend.mjs. Safe to ignore.",
    issued_at: new Date().toISOString(),
  });

  const r1 = await inscribe({
    data: Buffer.from(body1, "utf8"),
    contentType: "application/json",
    destAddress: addr,
    signer, network: net, feeRate: opts.feeRate,
    utxos: utxos1,
    srcAddress: addr,
  });
  logLine(`[step 1] built commit_1=${r1.commitTxid.slice(0, 16)}… reveal_1=${r1.revealTxid.slice(0, 16)}…`);
  logLine(`         commit_1 inputs: ${r1.pickedInputs.length} UTXO(s)`);

  logLine("[step 1] broadcasting commit_1");
  await electrs.broadcast(r1.commitHex);
  logLine("[step 1] broadcasting reveal_1");
  await electrs.broadcast(r1.revealHex);
  logLine(`[step 1] inscription id: ${r1.inscriptionId}`);
  await waitForConfirmation(electrs, r1.revealTxid);

  // ---- Phase 2: second inscription that should naturally spend the inscription UTXO ----
  logLine("\n[step 2] fetching UTXOs after step 1 (should include the 546-sat inscription UTXO)");
  const utxos2 = await hydrateUtxos(electrs, await electrs.utxos(addr));
  const balance2 = utxos2.reduce((s, u) => s + u.value, 0);
  const inscriptionUtxo = utxos2.find(
    (u) => u.txid === r1.revealTxid && u.vout === 0,
  );
  logLine(`         ${utxos2.length} UTXO(s), ${balance2} sats total`);
  logLine(`         smallest: ${Math.min(...utxos2.map((u) => u.value))} sats`);
  if (!inscriptionUtxo) {
    logLine(`[fatal] could not find the step-1 inscription UTXO (${r1.revealTxid}:0) in the wallet.`);
    process.exit(4);
  }
  logLine(`         inscription UTXO found: ${inscriptionUtxo.txid.slice(0, 16)}…:${inscriptionUtxo.vout} = ${inscriptionUtxo.value} sats`);

  const body2 = JSON.stringify({
    p: "pokebells",
    op: "collection-update-probe",
    v: 1,
    probe: "phase-0-sat-spend-v1",
    refers_to: r1.inscriptionId,
    note: "Dummy update body. If greedy-smallest-first picked the inscription UTXO as its first input, the probe passed.",
    issued_at: new Date().toISOString(),
  });

  const r2 = await inscribe({
    data: Buffer.from(body2, "utf8"),
    contentType: "application/json",
    destAddress: addr,
    signer, network: net, feeRate: opts.feeRate,
    utxos: utxos2,
    srcAddress: addr,
  });
  logLine(`[step 2] built commit_2=${r2.commitTxid.slice(0, 16)}… reveal_2=${r2.revealTxid.slice(0, 16)}…`);
  logLine(`         commit_2 inputs: ${r2.pickedInputs.map((u) => `${u.txid.slice(0, 8)}:${u.vout}(${u.value})`).join(", ")}`);

  const spentInscriptionUtxo = r2.pickedInputs.some(
    (u) => u.txid === inscriptionUtxo.txid && u.vout === inscriptionUtxo.vout,
  );
  logLine(`[step 2] commit_2 spends inscription UTXO? ${spentInscriptionUtxo ? "YES" : "NO"}`);

  logLine("[step 2] broadcasting commit_2");
  await electrs.broadcast(r2.commitHex);
  logLine("[step 2] broadcasting reveal_2");
  await electrs.broadcast(r2.revealHex);
  logLine(`[step 2] inscription id: ${r2.inscriptionId}`);
  await waitForConfirmation(electrs, r2.revealTxid);

  // ---- Phase 3: verify both inscriptions still readable ----
  logLine("\n[step 3] verifying both inscription bodies are still readable at the content host");
  const body1Url = `${opts.contentBase}${r1.inscriptionId}`;
  const body2Url = `${opts.contentBase}${r2.inscriptionId}`;
  const resp1 = await fetch(body1Url);
  const resp2 = await fetch(body2Url);
  logLine(`         ${body1Url} → HTTP ${resp1.status}`);
  logLine(`         ${body2Url} → HTTP ${resp2.status}`);
  const body1OK = resp1.ok && (await resp1.text()).includes("pokebells-collection-probe");
  const body2OK = resp2.ok && (await resp2.text()).includes("collection-update-probe");

  // ---- Report ----
  logLine("\n======================================================================");
  logLine("PROBE RESULT");
  logLine("======================================================================");
  logLine(`Greedy-smallest-first picked the inscription UTXO as commit_2 input? ${spentInscriptionUtxo ? "YES ✓" : "NO ✗"}`);
  logLine(`Collection-probe still readable post-spend?                           ${body1OK ? "YES ✓" : "NO ✗"}`);
  logLine(`Update-probe readable (sanity check)?                                 ${body2OK ? "YES ✓" : "NO ✗"}`);

  const pass = spentInscriptionUtxo && body1OK && body2OK;
  logLine(`\nOverall:                                                              ${pass ? "PASS ✓" : "FAIL ✗"}`);
  logLine("");
  logLine("Next steps:");
  if (pass) {
    logLine("  - sat-spend-v1 is feasible with the default inscriber. Phase B can");
    logLine("    implement the op:\"collection_update\" validator assuming the same");
    logLine("    primitive works for the real collection root inscription.");
    logLine("  - Share collection-probe id + update-probe id with Claude for Phase B");
    logLine("    acceptance criteria fixtures.");
  } else {
    logLine("  - Report which sub-check failed. If YES/NO for sat-spend, attach the");
    logLine("    commit_2 tx hex from electrs so Claude can investigate why the");
    logLine("    greedy picker missed the inscription UTXO.");
  }
  logLine("======================================================================");

  if (opts.log) {
    fs.writeFileSync(opts.log, log.join("\n") + "\n", "utf8");
    console.log(`\nLog saved to ${opts.log}`);
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n[fatal] ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
