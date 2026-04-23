#!/usr/bin/env node
// Generate a fresh Bells wallet. Prints the address + writes the WIF to
// a file you control. Nothing leaves your machine. Use this to create a
// throwaway inscription wallet:
//
//   node tools/gen-bells-wallet.mjs --network bells-testnet --out /tmp/inscribe.key
//
// Then fund the printed address with exactly-enough BEL and run
// tools/bulk-inscribe.mjs.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pkg from "./pokebells-inscriber/node_modules/belcoinjs-lib/src/index.js";
const { payments, networks } = pkg;
import * as ecc from "./pokebells-inscriber/node_modules/bells-secp256k1/lib/index.js";
import bs58check from "./pokebells-inscriber/node_modules/bs58check/index.js";

function parseArgs(argv) {
  const opts = { network: "bells-testnet", out: null, compressed: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    switch (a) {
      case "--network": opts.network = v(); break;
      case "--out": opts.out = v(); break;
      case "-h": case "--help":
        console.log(`Usage: node tools/gen-bells-wallet.mjs --network bells-testnet --out /tmp/inscribe.key`);
        process.exit(0);
      default: console.error(`unknown flag: ${a}`); process.exit(2);
    }
  }
  return opts;
}

function toWif(priv, wifVersion, compressed = true) {
  const payload = compressed
    ? Buffer.concat([Buffer.from([wifVersion]), priv, Buffer.from([0x01])])
    : Buffer.concat([Buffer.from([wifVersion]), priv]);
  return bs58check.encode(payload);
}

const opts = parseArgs(process.argv.slice(2));
const network = opts.network === "bells-mainnet" ? networks.bellcoin
  : opts.network === "bells-testnet" ? networks.testnet
  : null;
if (!network) { console.error(`bad network: ${opts.network}`); process.exit(2); }

let priv;
do { priv = crypto.randomBytes(32); } while (!ecc.isPrivate(priv));
const pub = Buffer.from(ecc.pointFromScalar(priv, true));
const address = payments.p2pkh({ pubkey: pub, network }).address;
const wif = toWif(priv, network.wif, true);

console.log(`[wallet] network: ${opts.network}`);
console.log(`[wallet] address (P2PKH): ${address}`);
console.log(`[wallet] public key (compressed hex): ${pub.toString("hex")}`);

if (opts.out) {
  fs.writeFileSync(path.resolve(opts.out), wif + "\n", { mode: 0o600 });
  console.log(`[wallet] WIF written to ${opts.out} (0600)`);
  console.log(`[wallet] Fund this address and run tools/bulk-inscribe.mjs --key-file ${opts.out}`);
  console.log(`[wallet] After the run:  shred -u ${opts.out}  (or equivalent on Windows)`);
} else {
  console.log(`[wallet] WIF: ${wif}`);
  console.log(`[wallet] (add --out <path> to save to a file with 0600 perms)`);
}
