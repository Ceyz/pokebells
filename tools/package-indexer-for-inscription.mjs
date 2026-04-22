// Package the indexer source as inscription-ready bundles. Produces two
// artifacts in tools/indexer-bundle/:
//
//   1. Individual files  — worker.js, validator.js, db.js, schema.sql,
//      package.json, wrangler.toml, README.md — each fingerprinted and
//      ready to inscribe standalone. Good for chunked inscription across
//      multiple transactions.
//
//   2. A single pokebells-indexer-bundle.json — a manifest that lists all
//      files, their sha256 hashes, their on-chain-content-type metadata,
//      and placeholder inscription ids. After inscribing the files, fill
//      the ids and inscribe the manifest itself. Gives consumers a single
//      root to fetch; the manifest tells them which ids make up the
//      "full indexer source package" and how to verify their integrity.
//
// Why? So a community member can run the indexer from scratch even if
// GitHub disappears: they fetch the manifest inscription from any Bells
// content host, follow the child ids, save the files locally, run
// `npm install + wrangler deploy`. See OPEN_SOURCE.md for the full
// resilience model.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO, 'tools', 'indexer-bundle');

// Canonical file list. Content-type hints reflect what makes sense for
// the file being inscribed — the indexer itself treats content-type as
// informational (inscriptions are fetched via `/content/<id>` which
// returns bytes; content-type is set by the inscriber tool).
//
// NOTE: Nintondo's inscriber UI rejects `.js` / `.mjs` uploads. Inscribe
// JavaScript files as `.txt` (see memory/bootloader_blob_import_pattern.md)
// but keep their original logical filename in this bundle for local use.
const FILES = [
  { src: 'game/indexer/src/worker.js',      inscribeAs: 'indexer-worker.txt',     mime: 'text/plain' },
  { src: 'game/indexer/src/validator.js',   inscribeAs: 'indexer-validator.txt',  mime: 'text/plain' },
  { src: 'game/indexer/src/db.js',          inscribeAs: 'indexer-db.txt',         mime: 'text/plain' },
  { src: 'game/indexer/schema.sql',         inscribeAs: 'indexer-schema.sql',     mime: 'application/sql' },
  { src: 'game/indexer/package.json',       inscribeAs: 'indexer-package.json',   mime: 'application/json' },
  { src: 'game/indexer/wrangler.toml',      inscribeAs: 'indexer-wrangler.toml',  mime: 'text/plain' },
  { src: 'game/indexer/README.md',          inscribeAs: 'indexer-README.md',      mime: 'text/markdown' },
  { src: 'game/indexer/DEPLOY.md',          inscribeAs: 'indexer-DEPLOY.md',      mime: 'text/markdown', optional: true },
  { src: 'LICENSE',                         inscribeAs: 'LICENSE',                mime: 'text/plain' },
  { src: 'OPEN_SOURCE.md',                  inscribeAs: 'OPEN_SOURCE.md',         mime: 'text/markdown' },
  // Wallet-bridge host page: deployable anywhere the Nintondo wallet
  // extension injects window.nintondo. Embeds the on-chain game iframe
  // and relays wallet calls via postMessage. Inscribing it means anyone
  // can recover the "play URL" without depending on bellforge.app. See
  // OPEN_SOURCE.md § The 100% decentralized play URL.
  { src: 'companion/pokebells/play-bridge.html', inscribeAs: 'pokebells-play-bridge.html', mime: 'text/html' },
];

async function fingerprint(absPath) {
  const bytes = await readFile(absPath);
  return {
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const entries = [];
  let totalBytes = 0;
  for (const file of FILES) {
    const absPath = join(REPO, file.src);
    let fp;
    try { fp = await fingerprint(absPath); }
    catch (error) {
      if (file.optional) {
        console.warn(`Skipping optional file ${file.src}: ${error.code ?? error.message}`);
        continue;
      }
      throw new Error(`Required file ${file.src} is missing: ${error.code ?? error.message}`);
    }
    const bytes = await readFile(absPath);
    const outPath = join(OUT_DIR, file.inscribeAs);
    await writeFile(outPath, bytes);
    totalBytes += fp.bytes;
    entries.push({
      logical_path: file.src,
      inscribe_as: file.inscribeAs,
      content_type_hint: file.mime,
      bytes: fp.bytes,
      sha256: fp.sha256,
      inscription_id: null,
    });
  }

  const manifest = {
    p: 'pokebells-indexer-source',
    v: 1,
    name: 'PokeBells indexer source bundle',
    description:
      'Inscription-ready bundle of the PokeBells indexer Worker, schema, '
      + 'and deploy metadata. Allows recovery without GitHub.',
    license: 'MIT',
    generated_at: new Date().toISOString(),
    canonical_repo: 'https://github.com/Ceyz/pokebells',
    total_files: entries.length,
    total_bytes: totalBytes,
    files: entries,
    deploy_hint: [
      'Fetch each file via bells-{mainnet,testnet}-content.nintondo.io/content/<inscription_id>',
      'Save to game/indexer/... (strip the inscribe_as prefix if needed)',
      'Ensure package.json is valid (ignore content_type .json rewrap)',
      'npm install && wrangler login && wrangler d1 create pokebells-indexer',
      'Paste the new D1 id into wrangler.toml',
      'wrangler d1 execute pokebells-indexer --remote --file=schema.sql',
      'wrangler deploy',
    ],
  };

  const manifestPath = join(OUT_DIR, 'pokebells-indexer-bundle.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Wrote ${entries.length} files + manifest to ${OUT_DIR}`);
  console.log(`Total bytes: ${totalBytes} (~${(totalBytes / 1024).toFixed(1)} KB)`);
  console.log('Inscribe each file then paste its id into pokebells-indexer-bundle.json placeholders, finally inscribe the manifest itself as application/json.');
}

await main().catch((error) => {
  console.error('[package-indexer-for-inscription] fatal:', error?.stack ?? error);
  process.exit(1);
});
