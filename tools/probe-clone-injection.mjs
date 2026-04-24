#!/usr/bin/env node
// PokeBells clone-injection probe (P0 #3 universality follow-up).
//
// Fetches the PokeBells testnet root HTML bytes + inscribes a
// byte-identical copy at a NEW inscription id. The operator then
// visits the new URL and reports whether `window.nintondo` injects.
//
// Two outcomes matter:
//
//   (A) nintondo INJECTS on the clone
//       -> The Nintondo extension keys on CONTENT (or some
//          content-derived signal: bytes, DOM hash, meta tag, ...).
//          A malicious inscription could replicate the signal and
//          get auto-injected. The signPsbt popup is still the last
//          line of defense, but origin safety is weaker than
//          "per-inscription isolation".
//
//   (B) nintondo does NOT inject on the clone
//       -> Extension keys on the specific inscription id / URL
//          (internal allowlist, or some per-inscription permission
//          from a prior approval). Strongest isolation we could
//          hope for.
//
// Usage:
//   node tools/probe-clone-injection.mjs \
//     --key-file /z/tmp/inscribe.key \
//     --network bells-testnet \
//     --source e1c15e0bd5b4be8a76cb03c35ebdb96388ea2528242f2cb57db6ce0e454f4ea2i0 \
//     --fee-rate 3 \
//     --log tools/probe-clone-injection.log
//
// Needs ~30-100k testnet sats depending on root HTML size (the
// current testnet root inlines boot.js + index.html so it's
// chunky — run the dry-print first to see the estimate).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pkg from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";
const { Psbt, payments, networks } = pkg;
import * as ecc from "./pokebells-inscriber/node_modules/bells-secp256k1/lib/index.js";
import bs58check from "./pokebells-inscriber/node_modules/bs58check/index.js";
import { MAX_CHUNK_LEN, UTXO_MIN_VALUE } from "./pokebells-inscriber/src/consts.mjs";
import { script as bscript } from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_CONTENT = {
  "bells-mainnet": "https://bells-mainnet-content.nintondo.io/content/",
  "bells-testnet": "https://bells-testnet-content.nintondo.io/content/",
};
const DEFAULT_ELECTRS = {
  "bells-mainnet": "https://api.nintondo.io",
  "bells-testnet": "https://bells-testnet-api.nintondo.io",
};
const BELLS_NETWORKS = {
  "bells-mainnet": networks.bellcoin,
  "bells-testnet": networks.testnet,
};

function parseArgs(argv) {
  const o = {
    keyFile: null, network: "bells-testnet", source: null,
    electrs: null, contentBase: null, feeRate: 3, log: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; const v = () => argv[++i];
    if (a === "--key-file") o.keyFile = v();
    else if (a === "--network") o.network = v();
    else if (a === "--source") o.source = v();
    else if (a === "--electrs") o.electrs = v();
    else if (a === "--content-base") o.contentBase = v();
    else if (a === "--fee-rate") o.feeRate = parseInt(v(), 10);
    else if (a === "--log") o.log = v();
    else if (a === "--help" || a === "-h") { usage(); process.exit(0); }
  }
  if (!o.keyFile || !o.source) { usage(); process.exit(2); }
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
    "Usage: node tools/probe-clone-injection.mjs --key-file <path> --source <inscription-id> [--network bells-testnet] [--fee-rate 3] [--log <path>]\n"
    + "  Inscribes a byte-identical copy of <source> at a new inscription id.",
  );
}

function loadWif(p) { return fs.readFileSync(p, "utf8").trim().split(/\s+/)[0]; }

function wifToKeyPair(wif, network) {
  const decoded = bs58check.decode(wif);
  if (decoded[0] !== network.wif) {
    throw new Error(`wif version byte ${decoded[0].toString(16)} != network (${network.wif.toString(16)})`);
  }
  const priv = Buffer.from(decoded.slice(1, 33));
  const compressed = decoded.length === 34;
  const pub = Buffer.from(ecc.pointFromScalar(priv, compressed));
  return {
    privateKey: priv, publicKey: pub,
    sign: (h) => Buffer.from(ecc.sign(h, priv)),
    signSchnorr: (h) => Buffer.from(ecc.signSchnorr(h, priv)),
    network, compressed,
  };
}

function deriveP2pkhAddress(pub, network) {
  return payments.p2pkh({ pubkey: pub, network }).address;
}

class Electrs {
  constructor(base) { this.base = base.replace(/\/$/, ""); }
  async _get(p, asText = false) {
    const r = await fetch(`${this.base}${p}`);
    if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`);
    return asText ? r.text() : r.json();
  }
  async utxos(a) { return this._get(`/address/${a}/utxo`); }
  async txHex(t) { return this._get(`/tx/${t}/hex`, true); }
  async txStatus(t) { return this._get(`/tx/${t}/status`); }
  async broadcast(hex) {
    const r = await fetch(`${this.base}/tx`, { method: "POST", body: hex });
    const text = await r.text();
    if (!r.ok) throw new Error(`broadcast ${r.status}: ${text}`);
    return text.trim();
  }
}

async function waitForConfirmation(electrs, txid, label = "") {
  const deadline = Date.now() + 20 * 60_000;
  let attempts = 0;
  process.stdout.write(`  waiting for ${label}${txid.slice(0, 16)}…`);
  while (Date.now() < deadline) {
    attempts++;
    try {
      const s = await electrs.txStatus(txid);
      if (s?.confirmed) {
        process.stdout.write(` confirmed at ${s.block_height} (${attempts} polls)\n`);
        return { confirmed: true, height: s.block_height };
      }
    } catch (e) { if (!/404/.test(String(e.message))) throw e; }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, Math.min(5000 + attempts * 1000, 15_000)));
  }
  throw new Error(`confirmation timeout for ${txid}`);
}

function buildInscriptionScript(xOnly, contentType, data) {
  const chunks = [
    xOnly, bscript.OPS.OP_CHECKSIG, bscript.OPS.OP_FALSE, bscript.OPS.OP_IF,
    Buffer.from("ord", "utf8"), 1, 1, Buffer.from(contentType, "utf8"), 0,
  ];
  for (let i = 0; i < data.length; i += MAX_CHUNK_LEN) {
    chunks.push(data.subarray(i, Math.min(i + MAX_CHUNK_LEN, data.length)));
  }
  chunks.push(bscript.OPS.OP_ENDIF);
  return bscript.compile(chunks);
}

function toXOnly(p) { return p.length === 32 ? p : p.slice(1, 33); }

function estimateRevealVsize(s) {
  return Math.ceil(10 + 41 + 43 + (64 + s.length + 33 + 10) / 4);
}

async function inscribe({ data, contentType, destAddress, signer, network, feeRate, utxos, srcAddress }) {
  const xOnly = toXOnly(signer.publicKey);
  const script = buildInscriptionScript(xOnly, contentType, data);
  const payment = payments.p2tr({
    internalPubkey: xOnly,
    redeem: { output: script, redeemVersion: 192 },
    scriptTree: [{ output: script }, { output: script }],
    network,
  });
  const revealVsize = estimateRevealVsize(script);
  const revealFee = revealVsize * feeRate;
  const commitmentValue = revealFee + UTXO_MIN_VALUE;

  const sorted = [...utxos].sort((a, b) => a.value - b.value);
  const picked = [];
  let totalIn = 0;
  for (const u of sorted) {
    picked.push(u); totalIn += u.value;
    const estCommitFee = (10 + picked.length * 148 + 86) * feeRate;
    if (totalIn >= commitmentValue + estCommitFee) break;
  }
  if (totalIn < commitmentValue) {
    throw new Error(`insufficient: have ${totalIn}, need ${commitmentValue}+`);
  }

  const commit = new Psbt({ network });
  for (const u of picked) {
    commit.addInput({ hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(u.hex, "hex") });
  }
  commit.addOutput({ address: payment.address, value: commitmentValue });
  const scratch = commit.clone();
  scratch.addOutput({ address: srcAddress, value: 0 });
  scratch.signAllInputs(signer); scratch.finalizeAllInputs();
  const commitFee = scratch.extractTransaction(true).virtualSize() * feeRate;
  const change = totalIn - commitmentValue - commitFee;
  if (change >= UTXO_MIN_VALUE) commit.addOutput({ address: srcAddress, value: change });
  else if (change < 0) throw new Error(`short by ${-change}`);
  commit.signAllInputs(signer); commit.finalizeAllInputs();
  const commitTx = commit.extractTransaction(true);
  const commitTxid = commitTx.getId();
  const commitHex = commitTx.toHex();

  const reveal = new Psbt({ network });
  reveal.addInput({
    hash: commitTxid, index: 0,
    witnessUtxo: { script: payment.output, value: commitmentValue },
    tapLeafScript: [{
      leafVersion: 192, script,
      controlBlock: payment.witness[payment.witness.length - 1],
    }],
    tapInternalKey: xOnly,
  });
  reveal.addOutput({ address: destAddress, value: UTXO_MIN_VALUE });
  reveal.signAllInputs(signer); reveal.finalizeAllInputs();
  const revealTx = reveal.extractTransaction(true);
  return {
    commitTxid, commitHex,
    revealTxid: revealTx.getId(),
    revealHex: revealTx.toHex(),
    inscriptionId: `${revealTx.getId()}i0`,
    revealFee, commitFee,
  };
}

async function hydrateUtxos(electrs, raw) {
  const out = [];
  for (const u of raw) out.push({ ...u, hex: await electrs.txHex(u.txid) });
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const net = BELLS_NETWORKS[opts.network];
  const electrs = new Electrs(opts.electrs);
  const wif = loadWif(opts.keyFile);
  const signer = wifToKeyPair(wif, net);
  const addr = deriveP2pkhAddress(signer.publicKey, net);

  const log = [];
  const say = (s) => { console.log(s); log.push(s); };

  say(`[clone-probe] address:  ${addr}`);
  say(`[clone-probe] network:  ${opts.network}`);
  say(`[clone-probe] source:   ${opts.source}`);
  say(`[clone-probe] fee:      ${opts.feeRate} sat/vB\n`);

  // ---- Step 1: fetch source bytes ----
  say(`[step 1] fetching source inscription bytes`);
  const sourceUrl = `${opts.contentBase}${opts.source}`;
  const resp = await fetch(sourceUrl);
  if (!resp.ok) {
    say(`[fatal] source fetch ${resp.status} ${resp.statusText}`);
    process.exit(3);
  }
  const contentType = resp.headers.get("content-type") ?? "text/html";
  const buffer = Buffer.from(await resp.arrayBuffer());
  say(`         ${buffer.byteLength} bytes, content-type=${contentType}`);

  // Sanity: cap the body. The testnet root is ~30-100 KB inlined;
  // anything much larger is probably the wrong source id.
  if (buffer.byteLength > 5 * 1024 * 1024) {
    say(`[fatal] source body ${buffer.byteLength} B is implausibly large for a root HTML`);
    process.exit(3);
  }

  // ---- Step 2: estimate fee + confirm funds ----
  const utxos = await hydrateUtxos(electrs, await electrs.utxos(addr));
  const totalIn = utxos.reduce((s, u) => s + u.value, 0);
  say(`[step 2] ${utxos.length} UTXO(s), ${totalIn} sats total`);
  const estScriptLen = buffer.byteLength + 64;
  const estRevealFee = Math.ceil(10 + 41 + 43 + (64 + estScriptLen + 33 + 10) / 4) * opts.feeRate;
  const estCommitFee = 3000;
  say(`[step 2] estimated fee: reveal ~${estRevealFee}, commit ~${estCommitFee}, total ~${estRevealFee + estCommitFee} sats`);
  if (totalIn < estRevealFee + estCommitFee + UTXO_MIN_VALUE) {
    say(`[fatal] insufficient balance for clone inscription`);
    process.exit(3);
  }

  // ---- Step 3: inscribe the clone ----
  say(`\n[step 3] inscribing clone (byte-identical to ${opts.source.slice(0, 16)}…)`);
  const r = await inscribe({
    data: buffer, contentType,
    destAddress: addr, signer, network: net, feeRate: opts.feeRate,
    utxos, srcAddress: addr,
  });
  say(`[step 3] clone id       ${r.inscriptionId}`);
  say(`         commit=${r.commitTxid.slice(0, 16)}… reveal=${r.revealTxid.slice(0, 16)}…`);
  say(`         fees: commit=${r.commitFee} reveal=${r.revealFee} total=${r.commitFee + r.revealFee}`);

  await electrs.broadcast(r.commitHex);
  await electrs.broadcast(r.revealHex);
  await waitForConfirmation(electrs, r.revealTxid, "clone reveal ");

  // ---- Step 4: print operator instructions ----
  say("\n======================================================================");
  say("CLONE INJECTION PROBE — operator follow-up");
  say("======================================================================");
  say(`Source inscription (real PokeBells root):`);
  say(`  ${opts.contentBase}${opts.source}`);
  say(`Clone inscription (byte-identical, different id):`);
  say(`  ${opts.contentBase}${r.inscriptionId}`);
  say("");
  say("Open the CLONE URL in a NEW browser tab + dev-tools console and run:");
  say("");
  say('  console.log("nintondo on clone?", typeof window.nintondo);');
  say('  if (window.nintondo) {');
  say('    try { console.log("auto-account:", await window.nintondo.getAccount()); }');
  say('    catch (e) { console.log("getAccount threw:", e.message); }');
  say('  }');
  say("");
  say("Interpretation:");
  say("  - typeof === 'undefined' → extension keys on URL/id/allowlist. STRONGEST isolation.");
  say("  - typeof === 'object' with silent getAccount → extension keys on content;");
  say("    a clone can auto-connect. Mitigated by signPsbt popup + multi-tab lock,");
  say("    but we should communicate origin safety more conservatively in docs.");
  say("  - typeof === 'object' with getAccount throw / popup → extension injects");
  say("    but scopes permission per-inscription. Reasonable isolation.");
  say("======================================================================");

  if (opts.log) {
    fs.writeFileSync(opts.log, log.join("\n") + "\n", "utf8");
    console.log(`\nLog saved to ${opts.log}`);
  }
}

main().catch((e) => {
  console.error(`\n[fatal] ${e?.message ?? e}`);
  console.error(e?.stack);
  process.exit(1);
});
