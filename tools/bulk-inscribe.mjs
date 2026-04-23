#!/usr/bin/env node
// PokeBells bulk inscriber — Node CLI that burns a throwaway Bells wallet
// through the inscription-checklist.<network>.json in one headless run.
//
// Reads a WIF/hex private key from a FILE you control (never argv, never
// stdin echo, never env var committed to a dotfile) and signs every
// inscription locally. Seeds never cross Claude's context by design —
// this script is meant to run standalone on your machine.
//
// Recommended workflow:
//   1. Generate a fresh Bells wallet (offline preferred)
//   2. Transfer just enough BEL for the inscription batch (~1 BEL testnet,
//      ~2-5 BEL mainnet depending on fee rate)
//   3. Write the WIF to a key file (e.g. /tmp/inscribe.key)
//   4. Run:  node tools/bulk-inscribe.mjs \
//        --checklist game/inscription-checklist.testnet.json \
//        --network bells-testnet \
//        --dest-address <your-display-wallet-addr> \
//        --key-file /tmp/inscribe.key \
//        --fee-rate 3 \
//        --dry-run
//   5. Inspect the printed plan, drop --dry-run, re-run
//   6. Shred the key file  (  shred -u /tmp/inscribe.key  )
//
// Progress is persisted to tools/bulk-inscribe-state.<network>.json so
// a crash mid-run resumes from the last confirmed inscription.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

import pkg from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";
const { Psbt, payments, networks, Transaction, address: baddress } = pkg;
import * as ecc from "./pokebells-inscriber/node_modules/bells-secp256k1/lib/index.js";
import bs58check from "./pokebells-inscriber/node_modules/bs58check/index.js";

import { inscribe as _unused } from "./pokebells-inscriber/src/inscribe.mjs";
import { MAX_CHUNK_LEN, UTXO_MIN_VALUE } from "./pokebells-inscriber/src/consts.mjs";
import { script as bscript } from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ======================================================================
// CLI arg parsing
// ======================================================================
function parseArgs(argv) {
  const opts = {
    checklist: null,
    network: null,
    destAddress: null,
    keyFile: null,
    feeRate: 3,
    dryRun: true,
    limit: null,
    resume: true,
    electrsBase: null,
    confirm: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    switch (a) {
      case "--checklist": opts.checklist = v(); break;
      case "--network": opts.network = v(); break;
      case "--dest-address": opts.destAddress = v(); break;
      case "--key-file": opts.keyFile = v(); break;
      case "--fee-rate": opts.feeRate = parseInt(v(), 10); break;
      case "--limit": opts.limit = parseInt(v(), 10); break;
      case "--dry-run": opts.dryRun = true; break;
      case "--live": opts.dryRun = false; break;
      case "--no-resume": opts.resume = false; break;
      case "--electrs": opts.electrsBase = v(); break;
      case "--yes": opts.confirm = true; break;
      case "-h": case "--help":
        printUsage(); process.exit(0); break;
      default:
        console.error(`unknown flag: ${a}`); printUsage(); process.exit(2);
    }
  }
  return opts;
}

function printUsage() {
  console.log(`
PokeBells bulk inscriber

Usage:
  node tools/bulk-inscribe.mjs \\
    --checklist game/inscription-checklist.testnet.json \\
    --network bells-testnet \\
    --dest-address <addr-that-receives-inscriptions> \\
    --key-file /tmp/inscribe.key \\
    --fee-rate 3 \\
    [--limit 5] [--live] [--no-resume] [--yes]

Flags:
  --checklist <path>     JSON checklist produced by tools/build-inscription-plan.mjs
  --network <name>       bells-testnet | bells-mainnet
  --dest-address <addr>  Address that ends up owning each inscription
  --key-file <path>      File containing a Bells WIF (or 64-hex privkey).
                         The script reads and discards; it never writes back.
  --fee-rate <sat/vB>    Default 3. Bump if mempool is busy.
  --limit <N>            Only inscribe the first N pending assets (smoke test)
  --live                 Actually broadcast. Default is --dry-run (no broadcast).
  --no-resume            Ignore the progress file and start from scratch.
  --electrs <url>        Override electrs base (defaults to Nintondo).
  --yes                  Skip the confirmation prompt.

Never commit your key file to git. Wipe it after the run.
`);
}

// ======================================================================
// Key handling — local only, NEVER logged
// ======================================================================
function loadPrivateKey(keyFilePath) {
  if (!keyFilePath) throw new Error("--key-file required");
  const raw = fs.readFileSync(path.resolve(keyFilePath), "utf8").trim();
  if (!raw) throw new Error("key file is empty");

  // Case 1: 64-hex = raw privkey
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return { priv: Buffer.from(raw, "hex"), source: "hex" };
  }
  // Case 2: WIF (base58check)
  try {
    const decoded = Buffer.from(bs58check.decode(raw));
    // [version(1)][priv(32)][compressed?(1)][checksum(4)], checksum already stripped
    if (decoded.length === 33 || decoded.length === 34) {
      return { priv: decoded.slice(1, 33), source: "wif" };
    }
  } catch {
    /* fall through */
  }
  throw new Error("key file must contain a WIF or a 64-hex privkey (one line)");
}

// Signer interface compatible with belcoinjs-lib's Psbt.signInput.
// Implements ECDSA .sign + Schnorr .signSchnorr via bells-secp256k1.
function makeSigner(privBuf, network) {
  const publicKey = Buffer.from(ecc.pointFromScalar(privBuf, true));
  return {
    publicKey,
    network,
    sign(hash, _lowR) {
      return Buffer.from(ecc.sign(new Uint8Array(hash), new Uint8Array(privBuf)));
    },
    signSchnorr(hash) {
      return Buffer.from(ecc.signSchnorr(new Uint8Array(hash), new Uint8Array(privBuf)));
    },
  };
}

function deriveP2pkhAddress(publicKey, network) {
  return payments.p2pkh({ pubkey: publicKey, network }).address;
}

// ======================================================================
// Electrs client (Nintondo-compatible Esplora fork)
// ======================================================================
const DEFAULT_ELECTRS = {
  "bells-mainnet": "https://api.nintondo.io",
  "bells-testnet": "https://bells-testnet-api.nintondo.io",
};

class Electrs {
  constructor(base) { this.base = base.replace(/\/$/, ""); }
  async _get(path, asText = false) {
    const r = await fetch(`${this.base}${path}`);
    if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${await r.text()}`);
    return asText ? r.text() : r.json();
  }
  async utxos(addr) { return this._get(`/address/${addr}/utxo`); }
  async balance(addr) { return this._get(`/address/${addr}`); }
  async txHex(txid) { return this._get(`/tx/${txid}/hex`, true); }
  async txStatus(txid) { return this._get(`/tx/${txid}/status`); }
  async tipHeight() { return parseInt(await this._get(`/blocks/tip/height`, true), 10); }
  async broadcast(hex) {
    const r = await fetch(`${this.base}/tx`, { method: "POST", body: hex });
    const text = await r.text();
    if (!r.ok) throw new Error(`broadcast failed (${r.status}): ${text}`);
    return text.trim();
  }
}

// Poll /tx/:txid/status until confirmed or timeout. Used to drain the
// mempool chain when we hit Bells's descendant-size limit (101 KB by
// default) — i.e. every ~1 block for big ROM-chunk reveals.
async function waitForConfirmation(electrs, txid, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts++;
    try {
      const s = await electrs.txStatus(txid);
      if (s?.confirmed) return { confirmed: true, height: s.block_height, attempts };
    } catch (e) {
      // 404 while unconfirmed is normal on some electrs variants — keep polling.
      if (!/404/.test(String(e.message))) throw e;
    }
    // Small backoff, cap at 15s
    const delay = Math.min(5000 + attempts * 1000, 15_000);
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error(`confirmation timeout for ${txid} after ${timeoutMs}ms`);
}

// Swallow "already on chain / already in mempool" errors — they happen
// when a tx we thought failed was actually accepted (e.g. the wait loop
// below races with a block confirmation). Returns "already" so the caller
// knows it was a no-op; throws for any other failure.
async function safeBroadcast(electrs, hex) {
  try {
    await electrs.broadcast(hex);
    return "broadcast";
  } catch (e) {
    const m = String(e.message);
    if (/already in (utxo set|block|chain|mempool)|Transaction already|-27/i.test(m)) {
      return "already";
    }
    throw e;
  }
}

async function broadcastPairWithRetry(electrs, commitHex, revealHex, commitTxid, revealTxid, waitOnTxid) {
  async function attempt() {
    const c = await safeBroadcast(electrs, commitHex);
    const r = await safeBroadcast(electrs, revealHex);
    return { commitTxid, revealTxid, commitStatus: c, revealStatus: r };
  }
  try {
    return await attempt();
  } catch (e) {
    if (!/too-long-mempool-chain/i.test(String(e.message))) throw e;
    if (!waitOnTxid) {
      throw new Error(`mempool chain limit hit and no prior tx to wait on: ${e.message}`);
    }
    console.log(`  mempool chain full, waiting for ${waitOnTxid.slice(0, 16)}… to confirm…`);
    const c = await waitForConfirmation(electrs, waitOnTxid);
    console.log(`  confirmed at height ${c.height} after ${c.attempts} polls, retrying broadcast`);
    return await attempt();
  }
}

// ======================================================================
// Inscribe one asset — local version of bells-inscriber.inscribe() that
// accepts a pre-fetched UTXO list + returns both signed tx hexes + the
// change output so the next asset can chain off it without waiting for
// block confirmation.
// ======================================================================
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

function toXOnly(pub) {
  return pub.length === 32 ? pub : pub.slice(1, 33);
}

// Signed reveal vsize is deterministic wrt script, so we can precompute
// it without a real sign call to avoid a wasted round-trip.
function estimateRevealVsize(inscriptionScript) {
  // Taproot witness: sig (64-65) + script (variable) + controlBlock (33).
  // Base tx ≈ 10 vbytes; input ≈ 41 vbytes (outpoint + sequence);
  // witness gets discounted to 1/4. Script bytes are the bulk — this is
  // an over-estimate by ~10% to stay safe on fee.
  const scriptLen = inscriptionScript.length;
  const witnessBytes = 64 + scriptLen + 33 + 10;
  const baseBytes = 10 + 41 + 43;
  return Math.ceil(baseBytes + witnessBytes / 4);
}

function inscribeLocal({
  data,
  contentType,
  destAddress,
  signer,
  network,
  feeRate,
  utxos,
  srcAddress,
}) {
  const xOnlyPubKey = toXOnly(signer.publicKey);
  const inscriptionScript = buildInscriptionScript(xOnlyPubKey, contentType, data);
  const payment = buildP2TR(inscriptionScript, xOnlyPubKey, network);

  const revealVsize = estimateRevealVsize(inscriptionScript);
  const revealFee = revealVsize * feeRate;
  const commitmentValue = revealFee + UTXO_MIN_VALUE;

  // Pick UTXOs greedily (smallest first to avoid wasting big UTXOs on
  // tiny inscriptions).
  const sorted = [...utxos].sort((a, b) => a.value - b.value);
  const picked = [];
  let totalIn = 0;
  for (const u of sorted) {
    picked.push(u);
    totalIn += u.value;
    // Rough upper bound on commit fee: 10 + 148*nIn + 43*2 ≈ 10+n*148+86
    const estCommitFee = (10 + picked.length * 148 + 86) * feeRate;
    if (totalIn >= commitmentValue + estCommitFee) break;
  }
  if (totalIn < commitmentValue) {
    throw new Error(`insufficient funds: have ${totalIn}, need ≥ ${commitmentValue} + commit fee`);
  }

  // Build commit tx (fund the taproot commitment output)
  const commitPsbt = new Psbt({ network });
  for (const u of picked) {
    commitPsbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(u.hex, "hex"),
    });
  }
  commitPsbt.addOutput({ address: payment.address, value: commitmentValue });

  // Compute commit fee by signing a scratch copy
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

  // Build reveal tx (spend the commitment output with tapscript)
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
  const revealHex = revealTx.toHex();
  const revealTxid = revealTx.getId();

  return {
    commitTxid,
    commitHex,
    revealTxid,
    revealHex,
    inscriptionId: `${revealTxid}i0`,
    spentUtxos: picked.map((u) => `${u.txid}:${u.vout}`),
    changeUtxo: change >= UTXO_MIN_VALUE
      ? { txid: commitTxid, vout: 1, value: change, hex: commitHex }
      : null,
    fees: { commit: commitFee, reveal: revealFee, total: commitFee + revealFee },
    commitmentValue,
  };
}

// ======================================================================
// Progress file
// ======================================================================
function progressFilePath(network) {
  return path.join(REPO_ROOT, "tools", `bulk-inscribe-state.${network}.json`);
}

function loadProgress(network, resume) {
  const p = progressFilePath(network);
  if (!resume || !fs.existsSync(p)) return { inscriptions: {}, spentOutpoints: [] };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function saveProgress(network, state) {
  fs.writeFileSync(progressFilePath(network), JSON.stringify(state, null, 2));
}

// ======================================================================
// Main
// ======================================================================
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.checklist) { console.error("--checklist required"); process.exit(2); }
  if (!opts.network) { console.error("--network required"); process.exit(2); }
  if (!opts.destAddress) { console.error("--dest-address required"); process.exit(2); }
  if (!opts.keyFile) { console.error("--key-file required"); process.exit(2); }

  const network = opts.network === "bells-mainnet" ? networks.bellcoin
    : opts.network === "bells-testnet" ? networks.testnet
    : null;
  if (!network) { console.error(`bad network: ${opts.network}`); process.exit(2); }

  // Guardrail: refuse mainnet unless explicitly live + confirmed
  if (opts.network === "bells-mainnet" && !opts.dryRun && !opts.confirm) {
    console.error("mainnet live run requires --yes to confirm");
    process.exit(2);
  }

  const electrsBase = opts.electrsBase ?? DEFAULT_ELECTRS[opts.network];
  const electrs = new Electrs(electrsBase);

  // Load + validate checklist
  const checklistPath = path.resolve(REPO_ROOT, opts.checklist);
  const checklist = JSON.parse(fs.readFileSync(checklistPath, "utf8"));
  console.log(`[plan] checklist: ${opts.checklist}`);
  console.log(`[plan] network: ${opts.network}`);
  console.log(`[plan] electrs: ${electrsBase}`);
  console.log(`[plan] assets total: ${checklist.assets.length}`);

  // Load key + derive address
  const { priv, source } = loadPrivateKey(opts.keyFile);
  const signer = makeSigner(priv, network);
  const srcAddress = deriveP2pkhAddress(signer.publicKey, network);
  console.log(`[plan] key source: ${source}`);
  console.log(`[plan] src address: ${srcAddress}`);
  console.log(`[plan] dest address: ${opts.destAddress}`);
  console.log(`[plan] fee rate: ${opts.feeRate} sat/vB`);

  // Balance probe
  const initialUtxos = await electrs.utxos(srcAddress);
  if (!initialUtxos.length) {
    console.error(`[err] no UTXOs at ${srcAddress}. Fund this address first.`);
    process.exit(1);
  }
  let balance = 0;
  for (const u of initialUtxos) balance += u.value;
  console.log(`[plan] balance: ${balance} sats (${(balance / 1e8).toFixed(8)} BEL) across ${initialUtxos.length} UTXO(s)`);

  // Hydrate UTXOs with hex (needed for nonWitnessUtxo on P2PKH)
  for (const u of initialUtxos) {
    if (!u.hex) u.hex = await electrs.txHex(u.txid);
  }

  // Load progress
  const progress = loadProgress(opts.network, opts.resume);
  const alreadyDone = new Set(Object.keys(progress.inscriptions));
  const remaining = checklist.assets.filter((a) => !alreadyDone.has(assetKey(a)));
  console.log(`[plan] done: ${alreadyDone.size} / pending: ${remaining.length}`);

  if (opts.limit && remaining.length > opts.limit) remaining.length = opts.limit;

  // Estimate total size + cost
  let totalContentBytes = 0;
  for (const a of remaining) totalContentBytes += a.bytes ?? 0;
  const roughPerTx = 200 + Math.ceil(totalContentBytes / remaining.length / MAX_CHUNK_LEN) * 20;
  const roughTotalFee = remaining.length * roughPerTx * opts.feeRate * 2;
  console.log(`[plan] to inscribe: ${remaining.length} assets, ~${totalContentBytes} content bytes, rough fee ≈ ${roughTotalFee} sats (${(roughTotalFee / 1e8).toFixed(8)} BEL)`);
  console.log(`[plan] mode: ${opts.dryRun ? "DRY RUN (no broadcast)" : "LIVE (will broadcast)"}`);

  if (!opts.confirm && !opts.dryRun) {
    if (!await confirmPrompt("Proceed with LIVE broadcast?")) {
      console.log("aborted"); process.exit(0);
    }
  }

  // Run
  let utxoPool = initialUtxos.filter((u) => !progress.spentOutpoints.includes(`${u.txid}:${u.vout}`));
  let idx = 0;
  // Track the last successfully-broadcast reveal so we can wait on it
  // if Bells rejects the next commit for exceeding the mempool-chain
  // descendant-size limit (101 KB default).
  let lastRevealTxid = null;
  for (const asset of remaining) {
    idx++;
    const key = assetKey(asset);
    console.log(`[${idx}/${remaining.length}] ${asset.role} ${asset.inscribeAs} (${asset.bytes}B sha=${asset.sha256.slice(0, 16)}…)`);

    // Load + verify content
    const filePath = path.resolve(REPO_ROOT, asset.file);
    const data = fs.readFileSync(filePath);
    const actualSha = crypto.createHash("sha256").update(data).digest("hex");
    if (actualSha !== asset.sha256) {
      console.error(`  sha256 mismatch, refusing. expected=${asset.sha256} got=${actualSha}`);
      process.exit(1);
    }

    let result;
    try {
      result = inscribeLocal({
        data,
        contentType: asset.contentType,
        destAddress: opts.destAddress,
        signer,
        network,
        feeRate: opts.feeRate,
        utxos: utxoPool,
        srcAddress,
      });
    } catch (e) {
      console.error(`  build failed: ${e.message}`);
      process.exit(1);
    }
    console.log(`  commit ${result.commitTxid.slice(0, 16)}… reveal ${result.revealTxid.slice(0, 16)}… fees=${result.fees.total} sats`);
    console.log(`  inscription id: ${result.inscriptionId}`);

    if (!opts.dryRun) {
      try {
        const bc = await broadcastPairWithRetry(
          electrs,
          result.commitHex, result.revealHex,
          result.commitTxid, result.revealTxid,
          lastRevealTxid,
        );
        const tag = (s) => s === "already" ? "(already-on-chain)" : "";
        console.log(`  broadcast ok: commit=${bc.commitTxid.slice(0, 16)}… ${tag(bc.commitStatus)} reveal=${bc.revealTxid.slice(0, 16)}… ${tag(bc.revealStatus)}`);
        lastRevealTxid = bc.revealTxid;
      } catch (e) {
        console.error(`  broadcast failed: ${e.message}`);
        console.error(`  state NOT saved; safe to re-run with --resume`);
        process.exit(1);
      }
    } else {
      console.log(`  dry-run: skipping broadcast`);
    }

    // Update UTXO pool: remove spent, add change
    const spentSet = new Set(result.spentUtxos);
    utxoPool = utxoPool.filter((u) => !spentSet.has(`${u.txid}:${u.vout}`));
    if (result.changeUtxo) utxoPool.push(result.changeUtxo);

    // Persist progress ONLY on a live run. Dry-run entries must NOT
    // block a subsequent live run from re-inscribing the same asset.
    if (!opts.dryRun) {
      progress.inscriptions[key] = {
        inscription_id: result.inscriptionId,
        commit_txid: result.commitTxid,
        reveal_txid: result.revealTxid,
        fees: result.fees,
        asset_role: asset.role,
        placeholder: asset.placeholder ?? null,
        inscribed_at: new Date().toISOString(),
      };
      progress.spentOutpoints = Array.from(new Set([...progress.spentOutpoints, ...result.spentUtxos]));
      saveProgress(opts.network, progress);
    }
  }

  console.log(`\n[done] ${idx} asset(s) processed. Progress: ${progressFilePath(opts.network)}`);
  console.log(`[done] Remaining UTXO pool: ${utxoPool.length} entries, ${utxoPool.reduce((s, u) => s + u.value, 0)} sats`);
}

function assetKey(asset) {
  return `${asset.role}:${asset.inscribeAs}`;
}

async function confirmPrompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(`${question} [y/N] `, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

main().catch((e) => {
  console.error("[fatal]", e?.stack ?? e?.message ?? String(e));
  process.exit(1);
});
