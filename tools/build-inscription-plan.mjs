// Generate a complete ordered inscription checklist for the Gen 2 testnet
// dry-run. The bootloader-level manifest (manifest.template.json) holds
// child inscription ids that reference every asset, so inscription order
// matters: leaves first (ROM chunks, sprites, runtime, ES modules), then
// intermediate manifests, then the root HTML.
//
// Output:
//   game/inscription-checklist.testnet.md  (human-readable step-by-step)
//   game/inscription-checklist.testnet.json (machine-readable for future
//                                            automated inscribe tooling)

import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function fingerprint(absPath) {
  const buffer = await readFile(absPath);
  const sha = createHash('sha256').update(buffer).digest('hex');
  return { bytes: buffer.byteLength, sha256: sha, relPath: relative(REPO, absPath).replaceAll('\\', '/') };
}

async function main() {
  const assets = [];

  // ---- Tier 1: raw binary leaves (no dependencies) ----
  // ROM chunks
  const romManifest = JSON.parse(await readFile(join(REPO, 'game/manifest.local.json'), 'utf8'));
  for (const chunk of romManifest.chunks) {
    const abs = join(REPO, 'game', chunk.source.path);
    const fp = await fingerprint(abs);
    assets.push({
      role: 'rom-chunk',
      index: chunk.index,
      inscribeAs: `pokecrystal.part${String(chunk.index).padStart(3, '0')}.bin`,
      contentType: 'application/octet-stream',
      file: fp.relPath,
      bytes: fp.bytes,
      sha256: fp.sha256,
      dependsOn: [],
      placeholder: `ROM_CHUNK_${String(chunk.index).padStart(3, '0')}_INSCRIPTION_ID`,
    });
  }

  // Binjgb runtime
  for (const role of ['runtime-js', 'runtime-wasm']) {
    const filePath = role === 'runtime-js' ? 'poc/binjgb.js' : 'poc/binjgb.wasm';
    const fp = await fingerprint(join(REPO, filePath));
    assets.push({
      role,
      // binjgb.js is ES module code that must reach import() via the blob
      // trampoline → inscribe as .txt (Nintondo rejects .js upload).
      // binjgb.wasm is loaded via fetch + WebAssembly.instantiate, content
      // type doesn't matter → inscribe as .bin.
      inscribeAs: role === 'runtime-js' ? 'binjgb.txt' : 'binjgb.wasm',
      contentType: role === 'runtime-js' ? 'text/plain' : 'application/octet-stream',
      file: fp.relPath,
      bytes: fp.bytes,
      sha256: fp.sha256,
      dependsOn: [],
      placeholder: role === 'runtime-js' ? 'BINJGB_JS_INSCRIPTION_ID' : 'BINJGB_WASM_INSCRIPTION_ID',
    });
  }

  // Sprite PNGs (502)
  const spritePack = JSON.parse(
    await readFile(join(REPO, 'tools/sprites-out-gen2/sprite-pack.manifest.template.json'), 'utf8'),
  );
  for (const [dex, entry] of Object.entries(spritePack.sprites)) {
    const dexStr = dex.padStart(3, '0');
    const normalPath = `tools/sprites-out-gen2/${dexStr}-normal.png`;
    const shinyPath = `tools/sprites-out-gen2/${dexStr}-shiny.png`;
    assets.push({
      role: 'sprite-normal',
      dex: Number(dex),
      inscribeAs: `${dexStr}-normal.png`,
      contentType: 'image/png',
      file: normalPath,
      bytes: entry.normal_bytes,
      sha256: entry.normal_sha256,
      dependsOn: [],
      placeholder: `SPRITE_${dexStr}_NORMAL_INSCRIPTION_ID`,
    });
    assets.push({
      role: 'sprite-shiny',
      dex: Number(dex),
      inscribeAs: `${dexStr}-shiny.png`,
      contentType: 'image/png',
      file: shinyPath,
      bytes: entry.shiny_bytes,
      sha256: entry.shiny_sha256,
      dependsOn: [],
      placeholder: `SPRITE_${dexStr}_SHINY_INSCRIPTION_ID`,
    });
  }

  // ES modules (inscribe as .txt per Nintondo constraint; blob-import handles MIME).
  // The pokebells_inscriber bundle (420+ KB) is chunked by its build
  // script into N pieces at companion/pokebells/inscriber/
  // pokebells-inscriber.browser.chunk{N}.txt. Each chunk gets its own
  // inscription; the manifest advertises them as a
  // `pokebells_inscriber_chunks` array; boot.js fetches all pieces,
  // concatenates the bytes in order, and blob-imports the result.
  const esModules = [
    { path: 'game/capture-core.mjs', key: 'capture_core' },
    { path: 'game/gen2-species.mjs', key: 'gen2_species' },
    { path: 'game/gen2-pc-storage.mjs', key: 'gen2_pc_storage' },
    { path: 'game/pending-captures.mjs', key: 'pending_captures' },
    { path: 'game/wallet-adapter.mjs', key: 'wallet_adapter' },
    { path: 'game/signin-verify.mjs', key: 'signin_verify' },
    { path: 'game/pbrp/session-key.mjs', key: 'pbrp_session_key' },
    { path: 'game/shell.js', key: 'shell' },
  ];
  for (const mod of esModules) {
    const fp = await fingerprint(join(REPO, mod.path));
    assets.push({
      role: 'es-module',
      key: mod.key,
      inscribeAs: `${mod.key}.txt`,
      contentType: 'text/plain',
      file: fp.relPath,
      bytes: fp.bytes,
      sha256: fp.sha256,
      dependsOn: [],
      placeholder: `${mod.key.toUpperCase()}_INSCRIPTION_ID`,
    });
  }

  // pokebells_inscriber — chunked bundle. Each chunk is its own
  // inscription. If chunks exist next to the bundle (build.mjs output),
  // emit per-chunk assets. If no chunks exist (bundle ≤200 KB), emit
  // a single es-module asset like the others.
  const inscriberDir = 'companion/pokebells/inscriber';
  const chunkTemplate = join(REPO, inscriberDir, 'pokebells-inscriber.chunks.template.json');
  let chunkTemplateExists = true;
  try { await stat(chunkTemplate); } catch { chunkTemplateExists = false; }

  if (chunkTemplateExists) {
    const chunkMeta = JSON.parse(await readFile(chunkTemplate, 'utf8'));
    for (const chunk of chunkMeta.chunks) {
      const chunkPath = `${inscriberDir}/${chunk.inscribeAs}`;
      const fp = await fingerprint(join(REPO, chunkPath));
      assets.push({
        role: 'es-module-chunk',
        key: 'pokebells_inscriber',
        chunkIndex: chunk.index,
        chunkCount: chunkMeta.chunk_count,
        inscribeAs: chunk.inscribeAs,
        contentType: 'text/plain',
        file: fp.relPath,
        bytes: fp.bytes,
        sha256: fp.sha256,
        dependsOn: [],
        placeholder: `POKEBELLS_INSCRIBER_CHUNK_${chunk.index}_INSCRIPTION_ID`,
      });
    }
  } else {
    // Fallback: bundle fit in one inscription
    const fp = await fingerprint(join(REPO, inscriberDir, 'pokebells-inscriber.browser.mjs'));
    assets.push({
      role: 'es-module',
      key: 'pokebells_inscriber',
      inscribeAs: 'pokebells_inscriber.txt',
      contentType: 'text/plain',
      file: fp.relPath,
      bytes: fp.bytes,
      sha256: fp.sha256,
      dependsOn: [],
      placeholder: 'POKEBELLS_INSCRIBER_INSCRIPTION_ID',
    });
  }

  // ---- Tier 2: aggregate manifests (reference ids from tier 1) ----
  // After tier 1 is inscribed, fill ids into:
  //   manifest.testnet-template.json  -> ROM manifest (rom-chunks + runtime + sprite_pack ref)
  //   sprite-pack.manifest.template.json -> filled with sprite ids
  //   collection metadata JSON (p:pokebells-collection) — NEW, see below

  assets.push({
    role: 'rom-manifest',
    inscribeAs: 'pokecrystal-rom.json',
    contentType: 'application/json',
    file: 'game/manifest.testnet-template.json',
    // Filled after tier 1 — bytes + sha256 recomputed at inscribe time.
    bytes: null,
    sha256: null,
    dependsOn: ['rom-chunk', 'runtime-js', 'runtime-wasm'],
    placeholder: 'ROM_MANIFEST_INSCRIPTION_ID',
    note: 'After tier 1: open this JSON, replace every ROM_CHUNK_*/BINJGB_*_INSCRIPTION_ID with the real i0 strings, recompute bytes+sha256, then inscribe.',
  });

  assets.push({
    role: 'sprite-pack-manifest',
    inscribeAs: 'sprite-pack.json',
    contentType: 'application/json',
    file: 'tools/sprites-out-gen2/sprite-pack.manifest.template.json',
    bytes: null,
    sha256: null,
    dependsOn: ['sprite-normal', 'sprite-shiny'],
    placeholder: 'SPRITE_PACK_INSCRIPTION_ID',
    note: 'After tier 1 sprites: fill in every sprite id, inscribe.',
  });

  assets.push({
    role: 'collection-metadata',
    inscribeAs: 'pokebells-collection.json',
    contentType: 'application/json',
    file: 'game/collection.template.json',
    bytes: null,
    sha256: null,
    dependsOn: [],
    placeholder: 'COLLECTION_INSCRIPTION_ID',
    note: 'Write a fresh {"p":"pokebells-collection","v":1,"name":"PokeBells","slug":"pokebells",...} JSON and inscribe. See the main manifest for the exact schema consumers expect.',
  });

  // ---- Tier 3: bootloader manifest ----
  assets.push({
    role: 'main-manifest',
    inscribeAs: 'pokebells-manifest.json',
    contentType: 'application/json',
    file: 'game/manifest.template.json',
    bytes: null,
    sha256: null,
    dependsOn: [
      'es-module', 'rom-manifest', 'sprite-pack-manifest', 'collection-metadata',
    ],
    placeholder: 'MAIN_MANIFEST_INSCRIPTION_ID',
    note: 'After tier 2: fill every *_inscription_id (capture_core, gen2_*, wallet_adapter, signin_verify, pbrp_session_key, pokebells_inscriber, shell, rom_manifest, collection) with real i0 strings, inscribe.',
  });

  // ---- Tier 4: root HTML (bootloader) ----
  // The root HTML contains boot.js + the HTML shell. It needs the main
  // manifest id baked as DEFAULT_TESTNET_MANIFEST_ID.
  assets.push({
    role: 'root-html',
    inscribeAs: 'pokebells.html',
    contentType: 'text/html',
    file: 'game/index.html',
    bytes: null,
    sha256: null,
    dependsOn: ['main-manifest'],
    placeholder: 'ROOT_INSCRIPTION_ID',
    note: 'Edit boot.js DEFAULT_TESTNET_MANIFEST_ID to the main manifest id from tier 3, bundle with index.html (inline or concat), inscribe as a single .html file. Keep the same file for mainnet (with DEFAULT_MAINNET_MANIFEST_ID).',
  });

  // Stats
  const totalBytes = assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0);
  const count = assets.length;

  await writeFile(
    join(REPO, 'game/inscription-checklist.testnet.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      network: 'bells-testnet',
      assetCount: count,
      tier1KnownBytes: totalBytes,
      notes: [
        'Inscribe in tier order (1 → 4). Inside tier 1 the order doesn\'t matter.',
        'Nintondo Inscriber rejects .js/.mjs uploads → inscribe ES modules as .txt.',
        'Content-Type at origin does not matter for ES modules (bootloader wraps in Blob with explicit MIME) — only the bytes must be verbatim.',
        'Track the i0 id returned by the inscriber against the corresponding placeholder.',
      ],
      assets,
    }, null, 2)}\n`,
  );

  // Human-readable checklist
  const byTier = {
    'tier-1-chunks': assets.filter((a) => a.role === 'rom-chunk'),
    'tier-1-runtime': assets.filter((a) => a.role.startsWith('runtime-')),
    'tier-1-sprites': assets.filter((a) => a.role === 'sprite-normal' || a.role === 'sprite-shiny'),
    'tier-1-modules': assets.filter((a) => a.role === 'es-module'),
    'tier-2-manifests': assets.filter((a) => ['rom-manifest', 'sprite-pack-manifest', 'collection-metadata'].includes(a.role)),
    'tier-3-manifest': assets.filter((a) => a.role === 'main-manifest'),
    'tier-4-root': assets.filter((a) => a.role === 'root-html'),
  };

  const lines = [];
  lines.push('# PokeBells Gen 2 Testnet Inscription Checklist');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Assets total: ${count}`);
  lines.push(`Tier 1 known bytes: ${totalBytes} (≈ ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
  lines.push('');
  lines.push('## Workflow');
  lines.push('');
  lines.push('1. Open `https://nintondo.io/inscriber` on Bells testnet with a funded tBEL wallet.');
  lines.push('2. For each row in a tier, upload the file (renamed as shown in `inscribeAs`), confirm, record the `<64hex>i0` id next to the row.');
  lines.push('3. Before inscribing a tier-2+ manifest, open the template JSON and replace every `REPLACE_ME_*` / `*_INSCRIPTION_ID` placeholder with the real ids collected in earlier tiers.');
  lines.push('4. When all tiers are done, open `https://bellforge.app/pokebells/?manifest=<MAIN_MANIFEST_INSCRIPTION_ID>&network=bells-testnet` and confirm the bootloader loads end-to-end (console log: `[boot] shell evaluated`).');
  lines.push('');
  lines.push('## Tier 1 — Leaves (order inside the tier does not matter)');
  lines.push('');
  lines.push(`### 1a. ROM chunks (${byTier['tier-1-chunks'].length}, ${byTier['tier-1-chunks'].reduce((s, a) => s + a.bytes, 0)} bytes)`);
  lines.push('');
  lines.push('| Index | Inscribe as | Bytes | sha256 | Source |');
  lines.push('|---|---|---|---|---|');
  for (const a of byTier['tier-1-chunks']) {
    lines.push(`| ${a.index} | \`${a.inscribeAs}\` | ${a.bytes} | \`${a.sha256.slice(0, 16)}…\` | \`${a.file}\` |`);
  }
  lines.push('');
  lines.push(`### 1b. Binjgb runtime (${byTier['tier-1-runtime'].length}, ${byTier['tier-1-runtime'].reduce((s, a) => s + a.bytes, 0)} bytes)`);
  lines.push('');
  lines.push('| Role | Inscribe as | Bytes | sha256 | Source |');
  lines.push('|---|---|---|---|---|');
  for (const a of byTier['tier-1-runtime']) {
    lines.push(`| ${a.role} | \`${a.inscribeAs}\` | ${a.bytes} | \`${a.sha256.slice(0, 16)}…\` | \`${a.file}\` |`);
  }
  lines.push('');
  lines.push(`### 1c. Sprites (${byTier['tier-1-sprites'].length} PNGs, ${byTier['tier-1-sprites'].reduce((s, a) => s + a.bytes, 0)} bytes)`);
  lines.push('');
  lines.push('502 PNGs — one entry per dex × {normal, shiny}. Full list in `inscription-checklist.testnet.json`.');
  lines.push('');
  lines.push(`### 1d. ES modules (${byTier['tier-1-modules'].length}, ${byTier['tier-1-modules'].reduce((s, a) => s + a.bytes, 0)} bytes)`);
  lines.push('');
  lines.push('**Inscribe each as `.txt`** (the Inscriber rejects `.js`/`.mjs`).');
  lines.push('');
  lines.push('| Key | Inscribe as | Bytes | sha256 | Source |');
  lines.push('|---|---|---|---|---|');
  for (const a of byTier['tier-1-modules']) {
    lines.push(`| \`${a.key}\` | \`${a.inscribeAs}\` | ${a.bytes} | \`${a.sha256.slice(0, 16)}…\` | \`${a.file}\` |`);
  }
  lines.push('');
  lines.push('## Tier 2 — Aggregate manifests (fill tier-1 ids first)');
  lines.push('');
  for (const a of byTier['tier-2-manifests']) {
    lines.push(`### ${a.role}`);
    lines.push('');
    lines.push(`- Inscribe as: \`${a.inscribeAs}\``);
    lines.push(`- Source template: \`${a.file}\``);
    lines.push(`- Placeholder: \`${a.placeholder}\``);
    lines.push(`- Note: ${a.note}`);
    lines.push('');
  }
  lines.push('## Tier 3 — Main bootloader manifest');
  lines.push('');
  for (const a of byTier['tier-3-manifest']) {
    lines.push(`- Inscribe as: \`${a.inscribeAs}\``);
    lines.push(`- Source template: \`${a.file}\``);
    lines.push(`- Placeholder: \`${a.placeholder}\``);
    lines.push(`- Note: ${a.note}`);
  }
  lines.push('');
  lines.push('## Tier 4 — Root HTML');
  lines.push('');
  for (const a of byTier['tier-4-root']) {
    lines.push(`- Inscribe as: \`${a.inscribeAs}\``);
    lines.push(`- Source template: \`${a.file}\``);
    lines.push(`- Placeholder: \`${a.placeholder}\``);
    lines.push(`- Note: ${a.note}`);
  }
  lines.push('');

  await writeFile(join(REPO, 'game/inscription-checklist.testnet.md'), `${lines.join('\n')}\n`);

  console.log(`Wrote game/inscription-checklist.testnet.md and .json`);
  console.log(`Asset count: ${count}`);
  console.log(`Tier 1 known bytes: ${totalBytes} B (~${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
}

await main().catch((error) => {
  console.error('[build-inscription-plan] fatal:', error?.stack ?? error);
  process.exit(1);
});
