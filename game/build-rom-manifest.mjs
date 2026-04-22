#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const DEFAULT_CHUNK_SIZE = 240 * 1024;
const DEFAULT_CONTENT_BASE_URL = 'https://bells-mainnet-content.nintondo.io/content/';
const DEFAULT_RUNTIME_JS = '../poc/binjgb.js';
const DEFAULT_RUNTIME_WASM = '../poc/binjgb.wasm';

function usage() {
  console.log(`
Usage:
  node phase1/build-rom-manifest.mjs --rom <path-to-rom> [options]

Options:
  --out <dir>              Output directory (default: phase1/)
  --chunk-size <bytes>     Max bytes per ROM chunk (default: 245760)
  --runtime-js <path>      Runtime JS path relative to manifest (default: ../poc/binjgb.js)
  --runtime-wasm <path>    Runtime WASM path relative to manifest (default: ../poc/binjgb.wasm)
  --content-base-url <url> Base URL for inscription content fetches
  --network <name>         Network label (default: bells-testnet)
  --help                   Show this help
`);
}

function parseArgs(argv) {
  const options = {
    outDir: scriptDir,
    chunkSize: DEFAULT_CHUNK_SIZE,
    runtimeJs: DEFAULT_RUNTIME_JS,
    runtimeWasm: DEFAULT_RUNTIME_WASM,
    contentBaseUrl: DEFAULT_CONTENT_BASE_URL,
    network: 'bells-testnet',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    switch (key) {
      case 'rom':
        options.romPath = value;
        break;
      case 'out':
        options.outDir = value;
        break;
      case 'chunk-size':
        options.chunkSize = Number.parseInt(value, 10);
        break;
      case 'runtime-js':
        options.runtimeJs = value;
        break;
      case 'runtime-wasm':
        options.runtimeWasm = value;
        break;
      case 'content-base-url':
        options.contentBaseUrl = value;
        break;
      case 'network':
        options.network = value;
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  return options;
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function sanitizeBaseName(filename) {
  const stem = path.basename(filename, path.extname(filename));
  return stem.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'rom';
}

async function writeJson(filePath, data) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, json, 'utf8');
}

function makePlaceholder(prefix, index) {
  return `${prefix}_${String(index).padStart(3, '0')}_INSCRIPTION_ID`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  if (!options.romPath) {
    usage();
    throw new Error('Missing required --rom argument.');
  }
  if (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0) {
    throw new Error(`Invalid --chunk-size value: ${options.chunkSize}`);
  }

  const outputDir = path.resolve(options.outDir);
  const romPath = path.resolve(options.romPath);
  const romBuffer = await fs.readFile(romPath);
  const romSha256 = sha256Hex(romBuffer);
  const romSize = romBuffer.byteLength;
  const romName = path.basename(romPath);
  const romSlug = sanitizeBaseName(romName);
  const romDirName = `${romSlug}-${romSha256.slice(0, 12)}`;
  const chunkDir = path.join(outputDir, 'chunks', romDirName);

  const runtimeJsAbsolute = path.resolve(outputDir, options.runtimeJs);
  const runtimeWasmAbsolute = path.resolve(outputDir, options.runtimeWasm);
  const runtimeJsBuffer = await fs.readFile(runtimeJsAbsolute);
  const runtimeWasmBuffer = await fs.readFile(runtimeWasmAbsolute);

  await fs.mkdir(chunkDir, { recursive: true });

  const chunkEntries = [];
  const chunkPlanEntries = [];
  for (let offset = 0, index = 0; offset < romSize; offset += options.chunkSize, index += 1) {
    const end = Math.min(offset + options.chunkSize, romSize);
    const chunkBuffer = romBuffer.subarray(offset, end);
    const chunkFileName = `${romSlug}.part${String(index).padStart(3, '0')}.bin`;
    const chunkFilePath = path.join(chunkDir, chunkFileName);
    await fs.writeFile(chunkFilePath, chunkBuffer);

    const chunkRelativePath = toPosix(path.relative(outputDir, chunkFilePath));
    const chunkSha256 = sha256Hex(chunkBuffer);
    const placeholder = makePlaceholder('ROM_CHUNK', index);

    chunkEntries.push({
      index,
      byteOffset: offset,
      byteLength: chunkBuffer.byteLength,
      sha256: chunkSha256,
      source: {
        type: 'file',
        path: chunkRelativePath,
      },
    });

    chunkPlanEntries.push({
      role: 'rom-chunk',
      index,
      placeholder,
      file: chunkRelativePath,
      byteOffset: offset,
      byteLength: chunkBuffer.byteLength,
      sha256: chunkSha256,
    });
  }

  const generatedAt = new Date().toISOString();
  const runtimeLocal = {
    js: {
      type: 'file',
      path: options.runtimeJs,
      byteLength: runtimeJsBuffer.byteLength,
      sha256: sha256Hex(runtimeJsBuffer),
    },
    wasm: {
      type: 'file',
      path: options.runtimeWasm,
      byteLength: runtimeWasmBuffer.byteLength,
      sha256: sha256Hex(runtimeWasmBuffer),
    },
  };

  const runtimeTemplate = {
    js: {
      type: 'inscription',
      inscriptionId: 'BINJGB_JS_INSCRIPTION_ID',
      byteLength: runtimeJsBuffer.byteLength,
      sha256: runtimeLocal.js.sha256,
    },
    wasm: {
      type: 'inscription',
      inscriptionId: 'BINJGB_WASM_INSCRIPTION_ID',
      byteLength: runtimeWasmBuffer.byteLength,
      sha256: runtimeLocal.wasm.sha256,
    },
  };

  const baseManifest = {
    format: 'pokebells-rom-manifest-v1',
    generatedAt,
    network: options.network,
    chunkByteLimit: options.chunkSize,
    contentBaseUrl: options.contentBaseUrl,
    rom: {
      name: romName,
      byteLength: romSize,
      sha256: romSha256,
      chunkCount: chunkEntries.length,
      cacheKey: `rom:${romSha256}`,
    },
  };

  const localManifest = {
    ...baseManifest,
    mode: 'local-files',
    runtime: runtimeLocal,
    chunks: chunkEntries,
  };

  const inscriptionManifest = {
    ...baseManifest,
    mode: 'inscription-template',
    runtime: runtimeTemplate,
    chunks: chunkEntries.map((chunk) => ({
      index: chunk.index,
      byteOffset: chunk.byteOffset,
      byteLength: chunk.byteLength,
      sha256: chunk.sha256,
      source: {
        type: 'inscription',
        inscriptionId: makePlaceholder('ROM_CHUNK', chunk.index),
      },
    })),
  };

  const inscriptionPlan = {
    format: 'pokebells-inscription-plan-v1',
    generatedAt,
    network: options.network,
    contentBaseUrl: options.contentBaseUrl,
    notes: [
      'Fill inscriptionId placeholders after each asset is inscribed on Bells testnet.',
      'The shell can load either manifest.local.json or manifest.testnet-template.json.',
    ],
    assets: [
      {
        role: 'runtime-js',
        placeholder: 'BINJGB_JS_INSCRIPTION_ID',
        file: options.runtimeJs,
        byteLength: runtimeJsBuffer.byteLength,
        sha256: runtimeLocal.js.sha256,
      },
      {
        role: 'runtime-wasm',
        placeholder: 'BINJGB_WASM_INSCRIPTION_ID',
        file: options.runtimeWasm,
        byteLength: runtimeWasmBuffer.byteLength,
        sha256: runtimeLocal.wasm.sha256,
      },
      ...chunkPlanEntries,
    ],
  };

  await writeJson(path.join(outputDir, 'manifest.local.json'), localManifest);
  await writeJson(path.join(outputDir, 'manifest.testnet-template.json'), inscriptionManifest);
  await writeJson(path.join(outputDir, 'inscription-plan.template.json'), inscriptionPlan);

  console.log(`ROM manifest written to ${path.join(outputDir, 'manifest.local.json')}`);
  console.log(`Inscription template written to ${path.join(outputDir, 'manifest.testnet-template.json')}`);
  console.log(`Inscription plan written to ${path.join(outputDir, 'inscription-plan.template.json')}`);
  console.log(`Chunks: ${chunkEntries.length} x <= ${options.chunkSize} bytes`);
  console.log(`ROM SHA-256: ${romSha256}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
