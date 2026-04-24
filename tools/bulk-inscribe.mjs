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
    skipKeys: [],
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
      case "--skip": opts.skipKeys.push(v()); break;
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
  --skip <key>           Skip an asset by key or inscribeAs filename (can
                         pass multiple times). Useful for assets that
                         exceed the 400K WU standard-tx limit and need
                         chunking (e.g. --skip pokebells_inscriber).

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
// Tier-2 template filler
// ======================================================================
// rom-manifest and main-manifest are JSON templates whose *_INSCRIPTION_ID
// placeholders must be replaced with real tier-1 inscription ids before
// inscribing. Placeholders match the `placeholder` field of each tier-1
// asset in the checklist, so we walk progress, build a map, and do N
// substring replaces. If any placeholder in the template is still
// present after substitution, we defer the asset — the caller can
// re-run once the missing tier-1 ids land in progress.
//
// main-manifest additionally depends on rom-manifest being inscribed
// first (via ROM_MANIFEST_INSCRIPTION_ID). The single-pass loop handles
// this naturally because rom-manifest comes first in checklist order
// and its progress entry is persisted before the main-manifest
// iteration reads it.
//
// For pokebells_inscriber_chunks (array field in main-manifest), each
// element is a separate placeholder string; they resolve independently.
function fillTier2FromProgress(asset, checklist, progress, network) {
  // Role-specific fillers for tier-2 assets whose template doesn't have
  // unique placeholder strings (e.g. sprite-pack has 502 identical
  // `REPLACE_ME_AFTER_INSCRIBE_i0` placeholders, disambiguated by dex
  // number + "normal"/"shiny" key).
  if (asset.role === "sprite-pack-manifest") {
    return fillSpritePackManifest(asset, progress);
  }
  if (asset.role === "root-html") {
    return fillRootHtml(asset, progress, network);
  }
  if (asset.role === "collection-metadata") {
    return fillCollectionMetadata(asset, progress);
  }

  const filePath = path.resolve(REPO_ROOT, asset.file);
  let text = fs.readFileSync(filePath, "utf8");

  // Build placeholder -> inscription_id map from tier-1 entries already
  // persisted in progress. We also add the current asset's own OWN
  // placeholder mapped to null so we know not to self-reference.
  const map = new Map();
  for (const a of checklist.assets) {
    if (!a.placeholder) continue;
    const key = `${a.role}:${a.inscribeAs}`;
    const entry = progress.inscriptions[key];
    if (entry?.inscription_id) map.set(a.placeholder, entry.inscription_id);
  }

  let replaced = 0;
  for (const [placeholder, id] of map.entries()) {
    const before = text.length;
    text = text.split(placeholder).join(id);
    if (text.length !== before) replaced++;
  }

  // Find unresolved *_INSCRIPTION_ID tokens (anything matching the
  // placeholder shape that's still in the text).
  const unresolvedSet = new Set();
  for (const a of checklist.assets) {
    if (a.placeholder && text.includes(a.placeholder)) {
      unresolvedSet.add(a.placeholder);
    }
  }

  return { text, replaced, unresolved: Array.from(unresolvedSet) };
}

// Build the root-html inscription body:
//   1. Read game/boot.js, replace DEFAULT_{network}_MANIFEST_ID with the
//      currently-inscribed main-manifest id (from progress.json).
//   2. Read game/index.html, replace the <script type="module" src="boot.js">
//      tag with an inline module <script> whose body is the patched boot.js.
// Result is a fully self-contained HTML file: opening
// https://bells-<net>-content.nintondo.io/content/<root-id> in a browser
// loads the game without any off-chain dependency (aside from the Nintondo
// content host itself). The baked default means `?manifest=` URL param is
// optional; pass one to override for testing a new manifest revision.
export function fillRootHtml(asset, progress, network) {
  const htmlPath = path.resolve(REPO_ROOT, asset.file);  // game/index.html
  const bootPath = path.resolve(REPO_ROOT, "game/boot.js");
  const mainManifestEntry = progress.inscriptions["main-manifest:pokebells-manifest.json"];
  if (!mainManifestEntry?.inscription_id) {
    return { text: "", replaced: 0, unresolved: ["main-manifest not yet inscribed (main-manifest:pokebells-manifest.json missing from progress)"] };
  }
  const mainId = mainManifestEntry.inscription_id;

  let boot = fs.readFileSync(bootPath, "utf8");
  const placeholder = network === "bells-mainnet"
    ? "REPLACE_ME_BEFORE_MAINNET_MINT"
    : "REPLACE_ME_BEFORE_TESTNET_MINT";
  if (!boot.includes(placeholder)) {
    return {
      text: "",
      replaced: 0,
      unresolved: [`boot.js is missing the ${placeholder} placeholder — cannot bake default manifest id`],
    };
  }
  // Must be BEFORE the manifest-id substitution because the manifest
  // placeholder is a prefix of the collection placeholder
  // ("REPLACE_ME_BEFORE_MAINNET_MINT" vs
  // "REPLACE_ME_BEFORE_MAINNET_MINT_COLLECTION"). Substituting the
  // shorter string first would corrupt the longer one.
  //
  // HARD GATE (Phase C round-5 finding): the collection id MUST be
  // present. If we let the placeholder survive into the minted root,
  // that root is permanently broken for Phase C discovery (the
  // inscription bytes are immutable; the baked placeholder can never
  // be replaced). Refuse to emit a root that would be born missing
  // its collection binding. The checklist now declares root-html
  // dependsOn collection-metadata; this is the defense-in-depth.
  const collectionPlaceholder = network === "bells-mainnet"
    ? "REPLACE_ME_BEFORE_MAINNET_MINT_COLLECTION"
    : "REPLACE_ME_BEFORE_TESTNET_MINT_COLLECTION";
  const collectionEntry = progress.inscriptions["collection-metadata:pokebells-collection.json"];
  if (boot.includes(collectionPlaceholder)) {
    if (!collectionEntry?.inscription_id) {
      return {
        text: "",
        replaced: 0,
        unresolved: [
          `root-html requires collection-metadata:pokebells-collection.json `
          + `but it is not in progress yet. Inscribe main-manifest then `
          + `collection-metadata (filled via fillCollectionMetadata) before `
          + `inscribing root-html. Refusing to bake ${collectionPlaceholder} `
          + `into a permanent root inscription — Phase C discovery would be `
          + `dead on arrival.`,
        ],
      };
    }
    boot = boot.split(collectionPlaceholder).join(collectionEntry.inscription_id);
  }
  boot = boot.split(placeholder).join(mainId);

  let html = fs.readFileSync(htmlPath, "utf8");
  // Inline the patched boot.js. We also drop the `src=` + replace the
  // whole script tag in one go to avoid residual whitespace oddities.
  const scriptTagRe = /<script\s+type="module"\s+src="boot\.js"\s*>\s*<\/script>/;
  if (!scriptTagRe.test(html)) {
    return {
      text: "",
      replaced: 0,
      unresolved: ["index.html does not contain the expected <script type=\"module\" src=\"boot.js\"></script> tag"],
    };
  }
  // Escape `</script>` inside boot body just in case. Boot doesn't contain
  // the string but this keeps the transform robust against future edits.
  const inlineBody = boot.replace(/<\/script>/gi, "<\\/script>");
  html = html.replace(scriptTagRe, `<script type="module">\n${inlineBody}\n</script>`);

  return { text: html, replaced: 1, unresolved: [] };
}

// Fill game/collection.template.json by substituting
// REPLACE_WITH_MANIFEST_V1_INSCRIPTION_ID_BEFORE_MINT (the only
// placeholder in the collection body) with the real main-manifest
// inscription id from the inscription progress.
//
// Phase C mint choreography (see game/ROOT-APP-DESIGN.md "Mint
// choreography"): main-manifest MUST be inscribed before
// collection-metadata. The reverse order makes the first collection
// body ingest-incompatible — the strict Phase A validator rejects
// REPLACE_ placeholders in app_manifest_ids, so POST /api/collections
// would return 422 and the whole Phase C discovery chain would have
// nothing to discover.
export function fillCollectionMetadata(asset, progress) {
  const filePath = path.resolve(REPO_ROOT, asset.file);
  const originalText = fs.readFileSync(filePath, "utf8");

  const mainManifest = progress.inscriptions?.["main-manifest:pokebells-manifest.json"];
  if (!mainManifest?.inscription_id) {
    return {
      text: "",
      replaced: 0,
      unresolved: [
        "main-manifest:pokebells-manifest.json not yet inscribed — "
        + "cannot fill collection.app_manifest_ids[0]. Inscribe the "
        + "main manifest first (see inscription-checklist dependency).",
      ],
    };
  }

  const placeholder = "REPLACE_WITH_MANIFEST_V1_INSCRIPTION_ID_BEFORE_MINT";
  if (!originalText.includes(placeholder)) {
    return {
      text: "",
      replaced: 0,
      unresolved: [
        `${asset.file} does not contain the expected placeholder `
        + `"${placeholder}". Either the template drifted or the body `
        + `is already filled.`,
      ],
    };
  }

  const text = originalText.split(placeholder).join(mainManifest.inscription_id);

  // Sanity: filled body must still be valid JSON. Catches manifest
  // ids that (somehow) include characters that break JSON parsing.
  try { JSON.parse(text); }
  catch (e) {
    return {
      text: "",
      replaced: 0,
      unresolved: [`filled collection body is not valid JSON: ${e.message}`],
    };
  }

  return { text, replaced: 1, unresolved: [] };
}

// Per-dex walker for sprite-pack.manifest.template.json. The template
// shape is:
//   { "p": "pokebells-sprites", "v": 1, "sprites": { "1": {...}, ... } }
// where each species entry has normal_inscription_id + shiny_inscription_id
// fields. We look up the two tier-1 entries for that dex
// (sprite-normal:NNN-normal.png + sprite-shiny:NNN-shiny.png) in progress
// and substitute the ids in-place.
function fillSpritePackManifest(asset, progress) {
  const filePath = path.resolve(REPO_ROOT, asset.file);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!raw.sprites || typeof raw.sprites !== "object") {
    return { text: "", replaced: 0, unresolved: ["sprite-pack template has no `sprites` object"] };
  }

  const missing = [];
  let replaced = 0;
  for (const [dex, entry] of Object.entries(raw.sprites)) {
    const dexStr = String(dex).padStart(3, "0");
    const normalKey = `sprite-normal:${dexStr}-normal.png`;
    const shinyKey = `sprite-shiny:${dexStr}-shiny.png`;
    const normal = progress.inscriptions[normalKey];
    const shiny = progress.inscriptions[shinyKey];
    if (normal?.inscription_id) { entry.normal_inscription_id = normal.inscription_id; replaced++; }
    else missing.push(normalKey);
    if (shiny?.inscription_id) { entry.shiny_inscription_id = shiny.inscription_id; replaced++; }
    else missing.push(shinyKey);
  }

  // Serialize deterministically (2-space indent) so the sha256 is stable
  // across runs of the same progress file.
  const text = JSON.stringify(raw, null, 2) + "\n";
  return { text, replaced, unresolved: missing.slice(0, 5) };
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
  // --skip entries match on asset.key (for ES modules) or asset.inscribeAs
  // (for anything else). Skipped assets are never fetched/signed.
  const skipSet = new Set(opts.skipKeys);
  function isSkipped(a) {
    return skipSet.has(a.key ?? "") || skipSet.has(a.inscribeAs ?? "");
  }
  const remaining = checklist.assets.filter((a) => !alreadyDone.has(assetKey(a)) && !isSkipped(a));
  const skippedCount = checklist.assets.filter((a) => !alreadyDone.has(assetKey(a)) && isSkipped(a)).length;
  console.log(`[plan] done: ${alreadyDone.size} / pending: ${remaining.length}${skippedCount ? ` / skipped: ${skippedCount}` : ""}`);
  if (skippedCount) {
    console.log(`[plan] skipping: ${opts.skipKeys.join(", ")}`);
  }

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
  // Supported tier-2 manifests. For other tier-2 roles (sprite-pack-manifest,
  // root-html) we defer — they need role-specific fill logic or bigger
  // structural changes.
  //
  //   rom-manifest: fills ROM_CHUNK_* + BINJGB_* placeholders
  //   main-manifest: fills module + chunks + rom + collection placeholders
  //   collection-metadata: template is static (no placeholders), inscribes
  //     as-is — included here so it's not incorrectly deferred.
  const AUTO_FILL_ROLES = new Set([
    "rom-manifest",
    "main-manifest",
    "collection-metadata",
    "sprite-pack-manifest",
    "root-html",
  ]);

  let tier2Deferred = 0;
  for (const asset of remaining) {
    idx++;
    const key = assetKey(asset);
    let data;
    let assetSha = asset.sha256;
    let assetBytes = asset.bytes;

    // Tier-2+ manifests have sha256=null in the checklist — their content
    // depends on tier-1 inscription ids being filled first. Auto-fill the
    // ones we know how to handle; defer the rest.
    if (assetSha == null || assetBytes == null) {
      if (!AUTO_FILL_ROLES.has(asset.role)) {
        tier2Deferred++;
        console.log(`[${idx}/${remaining.length}] ${asset.role} ${asset.inscribeAs} — DEFERRED (no auto-fill strategy)`);
        continue;
      }
      const filled = fillTier2FromProgress(asset, checklist, progress, opts.network);
      if (filled.unresolved.length > 0) {
        tier2Deferred++;
        console.log(
          `[${idx}/${remaining.length}] ${asset.role} ${asset.inscribeAs} — DEFERRED `
          + `(${filled.unresolved.length} placeholders still unresolved: `
          + `${filled.unresolved.slice(0, 3).join(", ")}${filled.unresolved.length > 3 ? "…" : ""})`,
        );
        continue;
      }
      data = Buffer.from(filled.text, "utf8");
      assetSha = crypto.createHash("sha256").update(data).digest("hex");
      assetBytes = data.length;
      console.log(
        `[${idx}/${remaining.length}] ${asset.role} ${asset.inscribeAs} `
        + `(FILLED ${assetBytes}B sha=${assetSha.slice(0, 16)}…, `
        + `replaced ${filled.replaced} placeholders)`,
      );
    } else {
      console.log(`[${idx}/${remaining.length}] ${asset.role} ${asset.inscribeAs} (${asset.bytes}B sha=${asset.sha256.slice(0, 16)}…)`);

      // Load + verify content
      const filePath = path.resolve(REPO_ROOT, asset.file);
      data = fs.readFileSync(filePath);
      const actualSha = crypto.createHash("sha256").update(data).digest("hex");
      if (actualSha !== asset.sha256) {
        console.error(`  sha256 mismatch, refusing. expected=${asset.sha256} got=${actualSha}`);
        process.exit(1);
      }
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
  if (tier2Deferred > 0) {
    console.log(`\n[tier2] ${tier2Deferred} tier-2+ asset(s) deferred. Fill their templates with tier-1 ids via:`);
    console.log(`[tier2]   node tools/fill-tier2-manifests.mjs --network ${opts.network}`);
    console.log(`[tier2] Then re-run this command to inscribe the filled manifests.`);
  }
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

// Only run the CLI when invoked directly as a script; not when
// imported (e.g. from tools/bulk-inscribe-collection.test.mjs, which
// needs to reach into fillCollectionMetadata without triggering the
// --checklist argv guard).
const isMainEntry = (() => {
  try {
    const here = fileURLToPath(import.meta.url);
    const argv1 = process.argv[1] ? path.resolve(process.argv[1]) : "";
    return path.resolve(here) === argv1;
  } catch { return false; }
})();

if (isMainEntry) {
  main().catch((e) => {
    console.error("[fatal]", e?.stack ?? e?.message ?? String(e));
    process.exit(1);
  });
}
