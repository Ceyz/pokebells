// PokeBells root bootloader — lives INSIDE the root inscription on mainnet.
// Everything locked forever once that inscription is minted:
//   - this file's code
//   - the default manifest inscription IDs below
//   - the module ordering + the dependency contract with shell.js
// Everything else (shell.js, capture-core, species, PC storage, wallet adapter,
// signin verify, ROM chunks) lives in child inscriptions referenced by a
// `p:pokebells-manifest` JSON inscription. Patch-to-fix post-mainnet = mint a
// new manifest + new child modules, update the companion to emit URLs with
// `?manifest=<new_id>`, keep the same root.
//
// Local-dev mode: no `?manifest` param AND host is not nintondo.io → resolve
// modules to relative paths (./capture-core.mjs, ./shell.js, ...). Same HTML
// works as a local testbed and as a root inscription.
//
// Mint-time requirements (2026-04-22, revised after testnet probe):
//   - CORS: inscription bodies must be served with access-control-allow-origin
//     that permits the root's origin. Nintondo's content host (verified)
//     returns `*` so this is automatic for every child inscription.
//   - Content-Type: no longer required to be application/javascript. The
//     bootloader fetches module bytes and wraps them in a Blob with an
//     explicit JS MIME before import(), so the origin's content-type is
//     ignored. This unblocks operators who had to inscribe modules under
//     alternate extensions (e.g. .txt) because the Nintondo Inscriber UI
//     rejects .js/.mjs uploads (verified 2026-04-22).
//   - Manifest inscription: body must be valid JSON; response.json() parses
//     regardless of content-type header.
//   - Inscribed bytes must be verbatim copies of the source files (no
//     truncation, encoding mangle, or transformation). The bootloader
//     evaluates them as ES module source.

// ---- Hardcoded defaults — replace BEFORE minting the root to mainnet ----
// These must point to real `p:pokebells-manifest` inscriptions. Until they
// exist, local dev is the only working mode; inscription mode throws a
// friendly error with the placeholder visible to the user.
const DEFAULT_MAINNET_MANIFEST_ID = 'REPLACE_ME_BEFORE_MAINNET_MINT';
const DEFAULT_TESTNET_MANIFEST_ID = 'REPLACE_ME_BEFORE_TESTNET_MINT';

// Nintondo serves inscription bytes (JSON, JS, binary) at these origins.
// `/content/<id>` returns the raw inscription body with the correct MIME —
// this is what dynamic import() and manifest fetch need. `/html/<id>` is a
// different endpoint that wraps the inscription in an HTML viewer page and
// must NOT be used for module loading.
// Probed 2026-04-22: `ord.nintondo.io` + `ord-testnet.nintondo.io` are not
// real endpoints (502 / DNS fail); these content hosts are the working ones
// with permissive CORS (Access-Control-Allow-Origin: *).
const CONTENT_BASES = {
  'bells-mainnet': 'https://bells-mainnet-content.nintondo.io/content/',
  'bells-testnet': 'https://bells-testnet-content.nintondo.io/content/',
};

const LOCAL_MODULE_PATHS = Object.freeze({
  capture_core: './capture-core.mjs',
  gen2_species: './gen2-species.mjs',
  gen2_pc_storage: './gen2-pc-storage.mjs',
  pending_captures: './pending-captures.mjs',
  wallet_adapter: './wallet-adapter.mjs',
  signin_verify: './signin-verify.mjs',
  pbrp_session_key: './pbrp/session-key.mjs',
  // Client-side ordinals PSBT builder (fork of bells-inscriber@0.2.8 with
  // the Nintondo service-fee output stripped). shell.js loads it lazily
  // when the user clicks "Mint here (direct)" so the wallet can sign +
  // broadcast capture_commit + mint without going through the Nintondo
  // Inscriber UI. The on-chain inscription bundles src/index.mjs +
  // belcoinjs-lib + Buffer polyfill into a single ESM blob — see
  // companion/pokebells/inscriber/pokebells-inscriber.browser.mjs.
  pokebells_inscriber: '../companion/pokebells/inscriber/pokebells-inscriber.browser.mjs',
  shell: './shell.js',
});

// Eager-loaded modules (await imported at boot, in order). The inscriber
// bundle is intentionally excluded — it's 660 KB and only needed when
// the user clicks "Mint here". shell.js dynamically imports it via
// window.PokeBellsBoot.resolveModuleUrl('pokebells_inscriber') on demand.
const MODULE_LOAD_ORDER = Object.freeze([
  'capture_core',
  'gen2_species',
  'gen2_pc_storage',
  'pending_captures',
  'wallet_adapter',
  'signin_verify',
  'pbrp_session_key',
]);

function detectNetwork() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('network');
  if (explicit) {
    return explicit.toLowerCase().includes('testnet') ? 'bells-testnet' : 'bells-mainnet';
  }
  const host = window.location.hostname.toLowerCase();
  if (host.includes('testnet')) return 'bells-testnet';
  return 'bells-mainnet';
}

function detectMode() {
  const host = window.location.hostname.toLowerCase();
  const isNintondoHost = host.endsWith('nintondo.io');
  const hasManifestParam = new URLSearchParams(window.location.search).has('manifest');
  if (isNintondoHost || hasManifestParam) return 'inscription';
  return 'local';
}

function resolveManifestId(network) {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('manifest');
  if (explicit) return explicit.trim();
  return network === 'bells-testnet' ? DEFAULT_TESTNET_MANIFEST_ID : DEFAULT_MAINNET_MANIFEST_ID;
}

function assertValidInscriptionId(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}i\d+$/i.test(value)) {
    throw new Error(
      `${label} is not a valid inscription id (${JSON.stringify(value)}). `
      + 'Three ways to fix:\n'
      + '  (a) For local dev: drop `?manifest=` from the URL entirely '
      + '(boot.js then loads modules from relative paths). The shell\'s '
      + '"Manifest URL" textbox is independent of boot.js — type your '
      + 'local manifest filename there + click "Load manifest".\n'
      + '  (b) For inscription mode with a freshly-minted root: set '
      + 'DEFAULT_TESTNET_MANIFEST_ID / DEFAULT_MAINNET_MANIFEST_ID in '
      + 'boot.js to the inscribed `p:pokebells-manifest` id.\n'
      + '  (c) For ad-hoc inscription mode: append `?manifest=<inscriptionId>` '
      + 'where <inscriptionId> is a 64-char hex string + `iN` suffix '
      + '(e.g. `?manifest=0a1b2c…ef0i0`).',
    );
  }
}

const MANIFEST_FETCH_TIMEOUT_MS = 15_000;

async function fetchManifest(manifestId, contentBase) {
  assertValidInscriptionId(manifestId, 'manifest id');
  const url = `${contentBase}${manifestId}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MANIFEST_FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { cache: 'no-cache', signal: controller.signal });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === 'AbortError') {
      throw new Error(`Manifest fetch timed out after ${MANIFEST_FETCH_TIMEOUT_MS} ms: ${url}`);
    }
    throw new Error(`Manifest fetch failed (${error?.message ?? error}): ${url}`);
  }
  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new Error(`Manifest fetch failed (HTTP ${response.status}): ${url}`);
  }
  let manifest;
  try {
    manifest = await response.json();
  } catch (error) {
    throw new Error(`Manifest is not valid JSON (${error?.message ?? error}): ${url}`);
  }
  if (manifest?.p !== 'pokebells-manifest') {
    throw new Error(`Fetched object is not a pokebells-manifest (p=${manifest?.p}).`);
  }
  if (manifest.v !== 1) {
    throw new Error(`Unsupported manifest version v=${manifest.v}. Bootloader only understands v1.`);
  }
  return manifest;
}

function resolveModuleUrl(mode, contentBase, manifest, key) {
  const urls = resolveModuleUrlList(mode, contentBase, manifest, key);
  if (urls.length !== 1) {
    throw new Error(
      `Module "${key}" is chunked (${urls.length} pieces). `
      + 'Use window.PokeBellsBoot.loadModule() instead of resolveModuleUrl().',
    );
  }
  return urls[0];
}

// Returns an ordered list of URLs that together form the module body:
//  - local mode: 1 URL, pointing to the on-disk .mjs/.js
//  - inscription mode single: 1 URL, pointing to /content/<id>
//  - inscription mode chunked: N URLs, bytes concatenated in array order
// Chunked modules are inscribed one piece per inscription because a
// single-inscription reveal containing the full bundle would exceed the
// Bells standard-tx 400K WU weight limit. The manifest advertises them
// as `<key>_chunks: ["<id1>i0", "<id2>i0", ...]`.
function resolveModuleUrlList(mode, contentBase, manifest, key) {
  if (mode === 'local') {
    const p = LOCAL_MODULE_PATHS[key];
    if (!p) throw new Error(`Unknown local module key: ${key}`);
    return [p];
  }
  const chunksField = `${key}_chunks`;
  const chunks = manifest?.[chunksField];
  if (Array.isArray(chunks) && chunks.length > 0) {
    for (const id of chunks) assertValidInscriptionId(id, `manifest.${chunksField}[]`);
    return chunks.map((id) => `${contentBase}${id}`);
  }
  const singleField = `${key}_inscription_id`;
  const single = manifest?.[singleField];
  assertValidInscriptionId(single, `manifest.${singleField}`);
  return [`${contentBase}${single}`];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[ch]);
}

function showBootError(error) {
  const message = String(error?.message ?? error ?? 'unknown error');
  console.error('[boot] fatal', error);
  const html = '<strong>PokeBells bootloader failed.</strong><br>' + escapeHtml(message);
  const attach = () => {
    if (!document.body) return false;
    const banner = document.createElement('div');
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:14px 18px;'
      + 'background:#a71d1d;color:#fff;font:14px/1.5 system-ui,sans-serif';
    banner.innerHTML = html;
    document.body.insertAdjacentElement('afterbegin', banner);
    return true;
  };
  if (!attach()) {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  }
}

// Load an ES module from either a local relative path (dev) or a Nintondo
// content URL (inscription mode). For inscription mode we use fetch → Blob →
// import() instead of direct import() because:
//   1. The inscriber UI at nintondo.io/inscriber rejects .js/.mjs uploads
//      (verified 2026-04-22), forcing operators to inscribe modules under
//      alternate extensions (e.g. .txt) with non-JS content-type.
//   2. Direct import(contentUrl) requires the response Content-Type to be
//      application/javascript or text/javascript. With a wrong MIME it fails
//      with a generic "Failed to fetch dynamically imported module" error
//      (verified via probe-combined.html on testnet 2026-04-22).
//   3. Wrapping the fetched bytes in a Blob({ type: 'application/javascript' })
//      and importing the blob URL forces the module loader to treat the bytes
//      as JS regardless of origin MIME. Probe tests 3 + 4 confirmed blob-URL
//      import works inside the Nintondo sandboxed iframe.
// Local dev uses the same path — node servers generally serve .mjs with the
// right MIME, but the round-trip through blob costs microseconds and keeps
// the two code paths identical.
async function fetchAsBlobUrl(url) {
  let response;
  try {
    response = await fetch(url, { cache: 'no-cache' });
  } catch (error) {
    throw new Error(`fetch failed (${error?.message ?? error}): ${url}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  const code = await response.text();
  if (!code) {
    throw new Error(`empty response body: ${url}`);
  }
  const blob = new Blob([code], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

async function importModule(key, url) {
  return loadAndImport(key, [url]);
}

// Load a module from 1+ URLs. For single-URL local dev, direct-imports.
// For HTTP URLs (inscription mode), fetches each URL, concatenates the
// bytes in order, and imports the result via a Blob URL with an
// application/javascript MIME. Works for both monolithic and chunked
// modules — a single-element `urls` is the trivial case.
async function loadAndImport(key, urls) {
  if (urls.length === 0) throw new Error(`No URLs resolved for module "${key}"`);
  if (urls.length === 1 && !/^https?:\/\//i.test(urls[0])) {
    // Local dev fast path — keeps stack traces clean in devtools.
    try {
      return await import(/* @vite-ignore */ urls[0]);
    } catch (error) {
      throw new Error(`Failed to load local module "${key}" from ${urls[0]}: ${error?.message ?? error}`);
    }
  }

  let parts;
  try {
    parts = await Promise.all(urls.map(async (u, i) => {
      const response = await fetch(u, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status} on chunk ${i}: ${u}`);
      const text = await response.text();
      if (!text) throw new Error(`empty body on chunk ${i}: ${u}`);
      return text;
    }));
  } catch (error) {
    throw new Error(
      `Failed to fetch module "${key}" (${urls.length} chunk${urls.length > 1 ? 's' : ''}): ${error?.message ?? error}. `
      + 'Verify the inscription id(s) are correct and the content host is reachable.',
    );
  }

  const body = parts.length === 1 ? parts[0] : parts.join('');
  const blob = new Blob([body], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await import(/* @vite-ignore */ blobUrl);
  } catch (error) {
    throw new Error(
      `Failed to evaluate module "${key}" loaded from ${urls.length} chunk(s): ${error?.message ?? error}. `
      + (urls.length > 1
        ? 'Chunks may have been concatenated in wrong order or one is truncated — '
        : 'The inscription bytes are not valid ES module syntax — ')
      + 'check the source .mjs file was inscribed verbatim (no truncation or encoding mangle).',
    );
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function boot() {
  const network = detectNetwork();
  const mode = detectMode();
  const contentBase = CONTENT_BASES[network] ?? CONTENT_BASES['bells-mainnet'];

  let manifest = null;
  if (mode === 'inscription') {
    const manifestId = resolveManifestId(network);
    manifest = await fetchManifest(manifestId, contentBase);
    console.info('[boot] inscription mode', { network, manifestId, manifestVersion: manifest.v });
  } else {
    console.info('[boot] local dev mode — relative module paths');
  }

  for (const key of MODULE_LOAD_ORDER) {
    const urls = resolveModuleUrlList(mode, contentBase, manifest, key);
    await loadAndImport(key, urls);
    console.info('[boot] loaded', key, urls.length === 1 ? urls[0] : `(${urls.length} chunks)`);
  }

  // Expose the resolver so shell.js can lazy-import non-critical modules
  // (e.g. pokebells_inscriber, 420+ KB, only needed at Mint-click time)
  // via the same network/mode resolution path used at boot.
  //
  // - resolveModuleUrl(key): legacy single-URL API, throws for chunked
  //   modules. Keep as a hint to callers that need to migrate.
  // - loadModule(key): new chunked-aware API. Fetches all pieces,
  //   concats, blob-imports, returns the module namespace promise.
  window.PokeBellsBoot = Object.freeze({
    network,
    mode,
    contentBase,
    manifest,
    resolveModuleUrl(key) {
      return resolveModuleUrl(mode, contentBase, manifest, key);
    },
    resolveModuleUrlList(key) {
      return resolveModuleUrlList(mode, contentBase, manifest, key);
    },
    async loadModule(key) {
      const urls = resolveModuleUrlList(mode, contentBase, manifest, key);
      return loadAndImport(key, urls);
    },
    importModule,
  });

  // shell.js runs immediately on evaluation — it expects window.PokeBells*
  // globals to already be populated by the earlier imports. Load it last.
  const shellUrls = resolveModuleUrlList(mode, contentBase, manifest, 'shell');
  await loadAndImport('shell', shellUrls);
  console.info('[boot] shell evaluated');
}

boot().catch(showBootError);
