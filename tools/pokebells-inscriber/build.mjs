#!/usr/bin/env node
// Bundles src/index.mjs + belcoinjs-lib + Buffer polyfill into a single
// browser ESM file at dist/pokebells-inscriber.browser.mjs.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, stat, copyFile } from "node:fs/promises";

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
