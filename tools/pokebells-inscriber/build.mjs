#!/usr/bin/env node
// Bundles src/index.mjs + belcoinjs-lib + Buffer polyfill into a single
// browser ESM file at dist/pokebells-inscriber.browser.mjs.
//
// When the bundle exceeds CHUNK_SIZE_BYTES it is also split into N
// chunks written next to the bundle as
// pokebells-inscriber.browser.chunkN.txt plus a chunk manifest template.
// Why: Bells (like Bitcoin) rejects any standard tx above 400,000 WU. A
// single-inscription reveal containing the full 420+ KB bundle would be
// non-standard and refused by nodes. Chunking lets the bootloader fetch
// each piece, concat, and blob-import the result.
//
// Local dev still imports the single-file bundle (LOCAL_MODULE_PATHS in
// boot.js points at the full .mjs). Chunks are only for inscription mode.

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { mkdir, stat, copyFile, readFile, writeFile, readdir, unlink } from "node:fs/promises";

const CHUNK_SIZE_BYTES = 200_000;  // safe under 400k WU standard-tx weight

const here = dirname(fileURLToPath(import.meta.url));
// Output into companion/ so GitHub Pages' deploy artifact (path: companion)
// includes the bundle. Also a local copy in ./dist for dev convenience.
const companionOut = resolve(
  here,
  "../../companion/pokebells/inscriber/pokebells-inscriber.browser.mjs",
);
const localOut = resolve(here, "dist/pokebells-inscriber.browser.mjs");
const outFile = companionOut;

await mkdir(dirname(companionOut), { recursive: true });
await mkdir(dirname(localOut), { recursive: true });

await build({
  entryPoints: [resolve(here, "src/index.mjs")],
  outfile: outFile,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  // Minify for on-chain inscription size budget. Bells per-inscription
  // soft limit is ~400 KB (mirrors Bitcoin ord); minified bundle should
  // land well under. Sourcemap stays for local devtools but doesn't ship
  // on-chain — the inscription contains only the .mjs body.
  minify: true,
  sourcemap: true,
  legalComments: "none",
  // inject bundles the shim and rewrites bare `Buffer` identifiers to import
  // from it. The shim also sets globalThis.Buffer as a side effect.
  inject: [resolve(here, "src/buffer-shim.mjs")],
  define: { "process.env.NODE_ENV": '"production"' },
});

await copyFile(companionOut, localOut);
const { size } = await stat(outFile);
process.stdout.write(
  `built ${outFile} (${size} bytes)\n  mirrored to ${localOut}\n`,
);

// ---------------------------------------------------------------------
// Chunk if over the per-inscription size budget.
// ---------------------------------------------------------------------

// Clean any stale chunks from a previous build (avoids off-by-one if the
// bundle shrinks across builds).
const outDir = dirname(companionOut);
for (const entry of await readdir(outDir)) {
  if (/^pokebells-inscriber\.browser\.chunk\d+\.txt$/.test(entry)) {
    await unlink(resolve(outDir, entry));
  }
}

const bundleBytes = await readFile(outFile);

if (bundleBytes.length <= CHUNK_SIZE_BYTES) {
  process.stdout.write(
    `  fits in one inscription (${bundleBytes.length} / ${CHUNK_SIZE_BYTES} B), skipping chunk split\n`,
  );
} else {
  const chunkCount = Math.ceil(bundleBytes.length / CHUNK_SIZE_BYTES);
  const chunks = [];
  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE_BYTES;
    const end = Math.min(start + CHUNK_SIZE_BYTES, bundleBytes.length);
    const slice = bundleBytes.subarray(start, end);
    const chunkPath = resolve(outDir, `pokebells-inscriber.browser.chunk${i}.txt`);
    await writeFile(chunkPath, slice);
    const sha = createHash("sha256").update(slice).digest("hex");
    chunks.push({ index: i, path: chunkPath, bytes: slice.length, sha256: sha });
    process.stdout.write(`  wrote chunk ${i} — ${slice.length} B sha=${sha.slice(0, 16)}…\n`);
  }
  // Write a manifest template next to the chunks. Inscription-ids are
  // `REPLACE_ME_i0` placeholders filled after bulk-inscribe.mjs emits
  // real ids. build-inscription-plan.mjs reads this to emit per-chunk
  // assets in the checklist instead of the monolithic module entry.
  const chunkManifest = {
    p: "pokebells-module-chunks",
    v: 1,
    key: "pokebells_inscriber",
    total_bytes: bundleBytes.length,
    chunk_count: chunkCount,
    chunks: chunks.map((c) => ({
      index: c.index,
      inscribeAs: `pokebells-inscriber.browser.chunk${c.index}.txt`,
      bytes: c.bytes,
      sha256: c.sha256,
      inscription_id: `REPLACE_ME_CHUNK_${c.index}_i0`,
    })),
  };
  const chunkManifestPath = resolve(outDir, "pokebells-inscriber.chunks.template.json");
  await writeFile(chunkManifestPath, JSON.stringify(chunkManifest, null, 2));
  process.stdout.write(
    `  chunk manifest template: ${chunkManifestPath}\n`
    + `  total: ${chunkCount} chunk(s), ${bundleBytes.length} B bundle\n`,
  );
}
