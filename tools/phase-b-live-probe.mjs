#!/usr/bin/env node
// PokeBells Phase B + Phase C end-to-end live probe (Bells testnet).
//
// Proves the full collection indirection pipeline on-chain:
//   1. Build a p:pokebells-collection body with a valid-looking
//      (but fake) manifest id in app_manifest_ids[0].
//   2. Inscribe it as application/json on testnet.
//   3. POST /api/collections — verify the deployed indexer accepts it
//      in strict ingestion mode (no REPLACE_ placeholders).
//   4. Build an op:"collection_update" body whose commit tx will spend
//      the collection inscription's UTXO (sat-spend-v1 authority).
//   5. Inscribe it, with the greedy picker naturally including the
//      collection's 1000-sat UTXO as commit tx vin[0] (same mechanic
//      proved by tools/probe-sat-spend.mjs on 2026-04-24).
//   6. POST /api/collection-updates — verify the indexer accepts the
//      update, writes an accepted row, and propagates the new satpoint.
//   7. GET /api/collection/latest — verify the aggregated view has
//      applied the update (app_manifest_ids prepended, current_satpoint
//      updated, stats.applied_updates === 1).
//
// What this probe does NOT do:
//   - Inscribe any real module / root-html (those are full mint
//     choreography; this just proves the Phase B + C mechanics).
//   - Use real manifest inscription ids (fake ids pass the format
//     regex; the validator does not verify on-chain existence).
//
// Usage:
//   node tools/phase-b-live-probe.mjs \
//     --key-file /z/tmp/inscribe.key \
//     --network bells-testnet \
//     --fee-rate 3 \
//     --log tools/phase-b-live-probe.log

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

const DEFAULT_ELECTRS = {
  "bells-mainnet": "https://api.nintondo.io",
  "bells-testnet": "https://bells-testnet-api.nintondo.io",
};
const DEFAULT_CONTENT = {
  "bells-mainnet": "https://bells-mainnet-content.nintondo.io/content/",
  "bells-testnet": "https://bells-testnet-content.nintondo.io/content/",
};
const DEFAULT_INDEXER = {
  "bells-testnet": "https://pokebells-indexer.ceyzcrypto.workers.dev",
};
const BELLS_NETWORKS = {
  "bells-mainnet": networks.bellcoin,
  "bells-testnet": networks.testnet,
};

const FAKE_MANIFEST_ID_INITIAL = `${"a".repeat(64)}i0`;
const FAKE_MANIFEST_ID_PREPEND = `${"b".repeat(64)}i0`;

// --------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------
function parseArgs(argv) {
  const o = {
    keyFile: null, network: "bells-testnet", electrs: null,
    contentBase: null, indexer: null, feeRate: 3, log: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; const v = () => argv[++i];
    if (a === "--key-file") o.keyFile = v();
    else if (a === "--network") o.network = v();
    else if (a === "--electrs") o.electrs = v();
    else if (a === "--content-base") o.contentBase = v();
    else if (a === "--indexer") o.indexer = v();
    else if (a === "--fee-rate") o.feeRate = parseInt(v(), 10);
    else if (a === "--log") o.log = v();
    else if (a === "--help" || a === "-h") { usage(); process.exit(0); }
  }
  if (!o.keyFile) { usage(); process.exit(2); }
  o.electrs ??= DEFAULT_ELECTRS[o.network];
  o.contentBase ??= DEFAULT_CONTENT[o.network];
  o.indexer ??= DEFAULT_INDEXER[o.network];
  if (!o.electrs || !o.contentBase || !o.indexer) {
    console.error(`[fatal] unknown network "${o.network}" (no default electrs/content/indexer)`);
    process.exit(2);
  }
  return o;
}

function usage() {
  console.log(
    "Usage: node tools/phase-b-live-probe.mjs --key-file <path> [--network bells-testnet] [--fee-rate 3] [--log <path>]\n"
    + "  Needs ~30,000 sats in the WIF's address for two inscriptions.",
  );
}

// --------------------------------------------------------------------
// Wallet + electrs + inscriber (same shape as probe-sat-spend.mjs)
// --------------------------------------------------------------------
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

async function waitForConfirmation(electrs, txid, logLine, label = "") {
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
    pickedInputs: picked.map((u) => ({ txid: u.txid, vout: u.vout, value: u.value })),
  };
}

async function hydrateUtxos(electrs, raw) {
  const out = [];
  for (const u of raw) out.push({ ...u, hex: await electrs.txHex(u.txid) });
  return out;
}

// --------------------------------------------------------------------
// Indexer helpers
// --------------------------------------------------------------------
async function postIndexer(indexer, path, body) {
  const r = await fetch(`${indexer.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: r.status, body: parsed ?? text };
}

async function getIndexer(indexer, path) {
  const r = await fetch(`${indexer.replace(/\/$/, "")}${path}`);
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: r.status, body: parsed ?? text };
}

// --------------------------------------------------------------------
// Body builders
// --------------------------------------------------------------------
function buildCollectionBody() {
  return {
    p: "pokebells-collection",
    v: 1,
    name: "PokeBells Phase-B Live Probe",
    slug: "pokebells-phase-b-probe",
    description: "End-to-end Phase B + C live probe — NOT the canonical PokeBells collection.",
    website: "https://github.com/Ceyz/pokebells",
    networks: ["bells-testnet"],
    schema: {
      capture_commit: "p:pokebells + op:capture_commit",
      mint: "p:pokebells + op:mint",
      evolve: "p:pokebells + op:evolve",
    },
    indexer_urls: ["https://pokebells-indexer.ceyzcrypto.workers.dev"],
    companion_urls: [],
    bridge_urls: [],
    root_app_urls: [],
    app_manifest_ids: [FAKE_MANIFEST_ID_INITIAL],
    update_authority: {
      scheme: "sat-spend-v1",
      comment: "phase-b live probe",
    },
    license: "MIT",
  };
}

function buildUpdateBody({ collectionInscriptionId, updateSequence }) {
  return {
    p: "pokebells",
    op: "collection_update",
    v: 1,
    network: "bells-testnet",
    collection_inscription_id: collectionInscriptionId,
    update_sequence: updateSequence,
    issued_at: new Date().toISOString(),
    set: { app_manifest_ids_prepend: [FAKE_MANIFEST_ID_PREPEND] },
  };
}

// --------------------------------------------------------------------
// Main
// --------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const net = BELLS_NETWORKS[opts.network];
  const electrs = new Electrs(opts.electrs);
  const wif = loadWif(opts.keyFile);
  const signer = wifToKeyPair(wif, net);
  const addr = deriveP2pkhAddress(signer.publicKey, net);

  const log = [];
  const say = (s) => { console.log(s); log.push(s); };

  say(`[live-probe] address: ${addr}`);
  say(`[live-probe] network: ${opts.network}`);
  say(`[live-probe] electrs: ${opts.electrs}`);
  say(`[live-probe] indexer: ${opts.indexer}`);
  say(`[live-probe] content: ${opts.contentBase}`);
  say(`[live-probe] fee:     ${opts.feeRate} sat/vB\n`);

  // ---- Step 1: inscribe collection root ----
  say("[step 1] fetch UTXOs + inscribe collection body");
  const utxos1 = await hydrateUtxos(electrs, await electrs.utxos(addr));
  say(`         ${utxos1.length} UTXO(s), ${utxos1.reduce((s, u) => s + u.value, 0)} sats`);
  const collectionBody = buildCollectionBody();
  const r1 = await inscribe({
    data: Buffer.from(JSON.stringify(collectionBody), "utf8"),
    contentType: "application/json",
    destAddress: addr, signer, network: net, feeRate: opts.feeRate,
    utxos: utxos1, srcAddress: addr,
  });
  say(`[step 1] collection id ${r1.inscriptionId}`);
  say(`         commit=${r1.commitTxid.slice(0, 16)}… reveal=${r1.revealTxid.slice(0, 16)}…`);
  await electrs.broadcast(r1.commitHex);
  await electrs.broadcast(r1.revealHex);
  await waitForConfirmation(electrs, r1.revealTxid, say, "collection reveal ");

  // ---- Step 2: POST /api/collections ----
  say("\n[step 2] POST /api/collections");
  // Small delay to let the content host index the new inscription.
  say("         waiting 10 s for content host to index…");
  await new Promise((r) => setTimeout(r, 10_000));
  const post1 = await postIndexer(opts.indexer, "/api/collections", {
    inscription_id: r1.inscriptionId,
    network: "bells-testnet",
  });
  say(`         HTTP ${post1.status} ${JSON.stringify(post1.body).slice(0, 200)}`);
  const collectionAccepted = post1.status === 200 && post1.body?.status === "registered";
  const collectionQueued = post1.status === 202 && post1.body?.status === "queued";
  if (!collectionAccepted && !collectionQueued) {
    say("[fatal] collection was rejected by indexer");
    await flushLog(opts.log, log);
    process.exit(3);
  }
  if (collectionQueued) {
    say("         queued (content host lag); waiting 60 s then retrying once…");
    await new Promise((r) => setTimeout(r, 60_000));
    const retry = await postIndexer(opts.indexer, "/api/collections", {
      inscription_id: r1.inscriptionId,
      network: "bells-testnet",
    });
    say(`         retry HTTP ${retry.status} ${JSON.stringify(retry.body).slice(0, 200)}`);
    if (retry.status !== 200 || retry.body?.status !== "registered") {
      say("[fatal] collection still not registered after retry");
      await flushLog(opts.log, log);
      process.exit(3);
    }
  }

  // ---- Step 3: inscribe collection_update ----
  say("\n[step 3] fetch UTXOs + inscribe collection_update with sat-spend-v1");
  const utxos2Raw = await hydrateUtxos(electrs, await electrs.utxos(addr));
  // Inject the inscription UTXO (electrs filters 1000-sat dust from
  // /address/:addr/utxo — same finding as probe-sat-spend.mjs).
  const inscriptionUtxo = {
    txid: r1.revealTxid, vout: 0, value: UTXO_MIN_VALUE, hex: r1.revealHex,
  };
  const utxos2 = [inscriptionUtxo, ...utxos2Raw];
  say(`         ${utxos2.length} UTXO(s) in pool (incl. injected inscription UTXO), smallest=${Math.min(...utxos2.map((u) => u.value))}`);
  const updateBody = buildUpdateBody({
    collectionInscriptionId: r1.inscriptionId,
    updateSequence: 1,
  });
  const r2 = await inscribe({
    data: Buffer.from(JSON.stringify(updateBody), "utf8"),
    contentType: "application/json",
    destAddress: addr, signer, network: net, feeRate: opts.feeRate,
    utxos: utxos2, srcAddress: addr,
  });
  say(`[step 3] update id ${r2.inscriptionId}`);
  say(`         commit inputs: ${r2.pickedInputs.map((u) => `${u.txid.slice(0, 8)}:${u.vout}(${u.value})`).join(", ")}`);
  const spendsInscriptionAtVin0 = r2.pickedInputs[0]?.txid === r1.revealTxid
    && r2.pickedInputs[0]?.vout === 0;
  say(`         sat-spend check: commit.vin[0] == collection satpoint? ${spendsInscriptionAtVin0 ? "YES ✓" : "NO ✗"}`);
  if (!spendsInscriptionAtVin0) {
    say("[fatal] commit tx did not put the collection sat at vin[0] — authority check would reject");
    await flushLog(opts.log, log);
    process.exit(4);
  }
  await electrs.broadcast(r2.commitHex);
  await electrs.broadcast(r2.revealHex);
  await waitForConfirmation(electrs, r2.revealTxid, say, "update reveal ");

  // ---- Step 4: POST /api/collection-updates ----
  say("\n[step 4] POST /api/collection-updates");
  say("         waiting 10 s for content host + electrs to index…");
  await new Promise((r) => setTimeout(r, 10_000));
  let post2 = await postIndexer(opts.indexer, "/api/collection-updates", {
    inscription_id: r2.inscriptionId,
    network: "bells-testnet",
  });
  say(`         HTTP ${post2.status} ${JSON.stringify(post2.body).slice(0, 300)}`);
  // Retry once if queued (content host lag).
  if (post2.status === 202 && post2.body?.status === "queued") {
    say("         queued; waiting 60 s then retrying once…");
    await new Promise((r) => setTimeout(r, 60_000));
    post2 = await postIndexer(opts.indexer, "/api/collection-updates", {
      inscription_id: r2.inscriptionId,
      network: "bells-testnet",
    });
    say(`         retry HTTP ${post2.status} ${JSON.stringify(post2.body).slice(0, 300)}`);
  }
  const updateAccepted = post2.status === 200 && post2.body?.status === "accepted";
  if (!updateAccepted) {
    say("[fatal] update was not accepted by indexer");
    await flushLog(opts.log, log);
    process.exit(5);
  }

  // ---- Step 5: GET /api/collection/latest ----
  say("\n[step 5] GET /api/collection/latest");
  const get1 = await getIndexer(
    opts.indexer,
    `/api/collection/latest?id=${encodeURIComponent(r1.inscriptionId)}&network=bells-testnet`,
  );
  say(`         HTTP ${get1.status}`);
  const agg = get1.body?.aggregated;
  const stats = get1.body?.stats;
  const sat = get1.body?.current_satpoint;
  say(`         applied_updates=${stats?.applied_updates}`);
  say(`         app_manifest_ids=${JSON.stringify(agg?.app_manifest_ids)}`);
  say(`         current_satpoint=${sat?.reveal_txid}:${sat?.vout} last_sequence=${sat?.last_sequence}`);

  const okAgg = get1.status === 200 && get1.body?.ok === true;
  const okStats = stats?.applied_updates === 1;
  const okIds = Array.isArray(agg?.app_manifest_ids)
    && agg.app_manifest_ids[0] === FAKE_MANIFEST_ID_PREPEND
    && agg.app_manifest_ids[1] === FAKE_MANIFEST_ID_INITIAL;
  const okSat = sat?.reveal_txid === r2.revealTxid
    && sat?.vout === 0
    && sat?.last_sequence === 1;

  // ---- Report ----
  say("\n======================================================================");
  say("PHASE B + C LIVE ROUND-TRIP RESULT");
  say("======================================================================");
  say(`Collection inscription id:     ${r1.inscriptionId}`);
  say(`Update inscription id:         ${r2.inscriptionId}`);
  say(`Collection registered (POST)?  ${collectionAccepted || collectionQueued ? "YES ✓" : "NO ✗"}`);
  say(`Commit tx vin[0] = satpoint?   ${spendsInscriptionAtVin0 ? "YES ✓" : "NO ✗"}`);
  say(`Update accepted (POST)?        ${updateAccepted ? "YES ✓" : "NO ✗"}`);
  say(`GET /api/collection/latest:    ${okAgg ? "YES ✓" : "NO ✗"}`);
  say(`  stats.applied_updates === 1  ${okStats ? "YES ✓" : "NO ✗"}`);
  say(`  app_manifest_ids prepended   ${okIds ? "YES ✓" : "NO ✗"}`);
  say(`  current_satpoint updated     ${okSat ? "YES ✓" : "NO ✗"}`);
  const pass = collectionAccepted && spendsInscriptionAtVin0 && updateAccepted
    && okAgg && okStats && okIds && okSat;
  say(`\nOverall:                       ${pass ? "PASS ✓" : "FAIL ✗"}`);
  say("======================================================================");
  if (pass) {
    say("\nPhase B + Phase C are validated end-to-end on testnet. The");
    say("collection + update inscription ids above can be persisted as");
    say("fixtures for regression testing.");
  }

  await flushLog(opts.log, log);
  process.exit(pass ? 0 : 1);
}

async function flushLog(filePath, lines) {
  if (!filePath) return;
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
  console.log(`\nLog saved to ${filePath}`);
}

main().catch((e) => {
  console.error(`\n[fatal] ${e?.message ?? e}`);
  console.error(e?.stack);
  process.exit(1);
});
