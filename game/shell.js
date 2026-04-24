const core = window.PokeBellsCaptureCore;
if (!core) {
  throw new Error('capture-core.mjs must load before shell.js');
}

const speciesTools = window.PokeBellsGen2Species;
if (!speciesTools) {
  throw new Error('gen2-species.mjs must load before shell.js');
}

const pcStorageTools = window.PokeBellsGen2PcStorage;
if (!pcStorageTools) {
  throw new Error('gen2-pc-storage.mjs must load before shell.js');
}

const walletTools = window.PokeBellsWalletAdapters;
if (!walletTools) {
  throw new Error('wallet-adapter.mjs must load before shell.js');
}

const signinTools = window.PokeBellsSigninVerify;
if (!signinTools) {
  throw new Error('signin-verify.mjs must load before shell.js');
}

const {
  CAPTURE_FRAMES_REQUIRED,
  PARTY_OFFSETS,
  RAM_ADDRS,
  SRAM_TOTAL_BYTE_LENGTH,
  buildCaptureCommitRecord,
  buildCaptureProvenance,
  buildCapturedPokemonRecord,
  buildPokemonMintRecord,
  buildRevealRecord,
  buildSaveSnapshotRecord,
  buildSpriteImageResolver,
  byteToHex,
  catchChancePercent,
  computeCatchChance,
  decodeBase64,
  isGen2Shiny,
  parseGbcDvs,
  parsePartySlotFromSnapshot,
  readSramSnapshot,
  readWord,
  statusNameFromByte,
  validateCaptureCommitRecord,
  validateCapturedPokemonRecord,
  validatePokemonMintRecord,
  wordToHex,
  writeSramSnapshot,
} = core;

const {
  getSpeciesByInternalId,
  getGen2SpeciesCatalog,
} = speciesTools;

const {
  PC_SYNC_ENABLED,
  GAME_DATA_LENGTH,
  GAME_DATA_OFFSET,
  CURRENT_BOX_NUM_OFFSET,
  CURRENT_BOX_INITIALIZED_FLAG,
  DEFAULT_TRAINER_NAME,
  MAIN_DATA_CHECKSUM_OFFSET,
  calcChecksum,
  syncOwnedCollectionToPcBoxes,
} = pcStorageTools;

const {
  createWalletAdapterRegistry,
  normalizeOwnedCollection,
} = walletTools;

const {
  fetchOwnedPokebellsCollection,
  parseSigninParamsFromLocation,
  verifySigninRequest,
} = signinTools;

const CPU_TICKS_PER_SECOND = 4194304;
const EVENT_NEW_FRAME = 1;
const EVENT_AUDIO_BUFFER_FULL = 2;
const EVENT_UNTIL_TICKS = 4;
const AUDIO_FRAMES = 4096;
const DEFAULT_CONTENT_BASE_URL = 'https://bells-mainnet-content.nintondo.io/content/';

// Companion URL resolution. Kept as a list (not a single const) so the game
// keeps working if the primary host goes down. Resolution order per
// resolveCompanionBase(): ?companion=<url> > localStorage > fallback list.
// Anyone self-hosting a companion clone (see docs) can point users at their
// deployment via either mechanism without needing a new shell inscription.
const COMPANION_URL_STORAGE_KEY = 'pokebells:companion_url';
const COMPANION_URL_FALLBACKS = [
  'https://bellforge.app/pokebells/',
];

// Indexer URL resolution: mirrors the companion pattern. ?indexer=<url>
// overrides localStorage which overrides the hardcoded default. Lets
// operators point the shell at a forked indexer without re-inscribing.
const INDEXER_URL_STORAGE_KEY = 'pokebells:indexer_url';
const INDEXER_URL_FALLBACKS = [
  'https://pokebells-indexer.ceyzcrypto.workers.dev',
];
function resolveIndexerBaseUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get('indexer');
  if (fromParam) return fromParam;
  try {
    const fromStorage = localStorage.getItem(INDEXER_URL_STORAGE_KEY);
    if (fromStorage) return fromStorage;
  } catch { /* sandboxed iframe */ }
  return INDEXER_URL_FALLBACKS[0];
}

const POKEBALL_COOLDOWN_BLOCKS = 360;
const POKEBALL_STORAGE_KEY = 'pokebells:pokeball:last_mint_block';
const BLOCK_TIP_HEIGHT_TTL_MS = 30_000;
const SRAM_PERSIST_DEBOUNCE_MS = 250;

const state = {
  module: null,
  emulator: 0,
  romPtr: 0,
  joypadPtr: 0,
  manifest: null,
  manifestUrl: null,
  runtimePromise: null,
  rafId: 0,
  lastRafSec: 0,
  leftoverTicks: 0,
  imageData: null,
  dbPromise: null,
  storage: {
    mode: 'pending',
    warningShown: false,
    memory: {
      roms: new Map(),
      chunks: new Map(),
      saves: new Map(),
      // v1.4 legacy: per-attestation { ivs, salt, ram_snapshot }
      // preimage cache used by buildRevealRecord. Read-only in v1.5.
      captureReveals: new Map(),
      // v1.5 capture-to-mint state machine — see SHELL-V1.5-PIPELINE.md.
      // Each row = one in-flight capture, keyed by attestation.
      pendingCaptures: new Map(),
    },
  },
  gb: null,
  speciesCatalog: null,
  spritePack: {
    manifest: null,
    resolver: null,
    source: null,
  },
  signin: {
    request: null,
    parseError: null,
    session: null,
    collection: null,
  },
  save: {
    lastInscribedVersion: 0,
    lastInscribedSha256: null,
    localVersion: 0,
    lastLocalSha256: null,
    pending: false,
  },
  capture: {
    prevTeamCount: -1,
    captureFrames: 0,
    prevBattleMode: 0,
    battleEndedFramesAgo: 9999,
    lastChance: null,
    lastPayload: null,
    sessionSequenceNumber: 0,
    inFlight: false,
  },
  wallet: {
    registry: createWalletAdapterRegistry(),
    adapter: null,
    connected: false,
    lastMint: null,
    providerProbe: null,
    lastSignature: null,
    pcSyncMessage: 'Waiting for a save file.',
    mintFlow: {
      phase: 'idle',
      message: 'Idle',
      quote: null,
      txid: null,
      inscriptionId: null,
    },
  },
  sram: {
    pendingPersist: false,
    lastPersistMs: 0,
  },
  ui: {
    busy: 0,
    mintResolver: null,
    captureHandoff: {
      payload: null,
      copied: false,
      slotIndex: null,
      mandatory: false,
      ivsMasked: true,
    },
    saveHandoff: {
      record: null,
      copied: false,
    },
  },
  pokeball: {
    lastMintBlock: null,
    tipHeight: null,
    tipFetchedAt: 0,
    tipInFlight: null,
  },
  audio: {
    ctx: null,
    bufferPtr: 0,
    bufferCapacity: 0,
    buffer: null,
    nextStartSec: 0,
  },
};

const dom = {
  manifestUrl: document.getElementById('manifest-url'),
  loadManifest: document.getElementById('load-manifest'),
  clearCache: document.getElementById('clear-cache'),
  copyDurableUrl: document.getElementById('copy-durable-url'),
  openCompanion: document.getElementById('open-companion'),
  reloadRom: document.getElementById('reload-rom'),
  toggleFullscreen: document.getElementById('toggle-fullscreen'),
  loadDevSave: document.getElementById('load-dev-save'),
  walletAdapterSelect: document.getElementById('wallet-adapter-select'),
  walletConnect: document.getElementById('wallet-connect'),
  walletProbe: document.getElementById('wallet-probe'),
  walletSignTest: document.getElementById('wallet-sign-test'),
  walletMint: document.getElementById('wallet-mint'),
  walletSyncPc: document.getElementById('wallet-sync-pc'),
  walletReset: document.getElementById('wallet-reset'),
  walletResyncIndexer: document.getElementById('wallet-resync-indexer'),
  overlay: document.getElementById('screen-overlay'),
  log: document.getElementById('log'),
  screenWrap: document.querySelector('.screen-wrap'),
  screen: document.getElementById('screen'),
  captureJson: document.getElementById('capture-json'),
  ownedParty: document.getElementById('owned-party'),
  ownedBoxes: document.getElementById('owned-boxes'),
  ownedPokemon: document.getElementById('owned-pokemon'),
  live: {
    teamCount: document.getElementById('live-team-count'),
    battleStatus: document.getElementById('live-battle-status'),
    enemyHp: document.getElementById('live-enemy-hp'),
    catchRate: document.getElementById('live-catch-rate'),
    catchChance: document.getElementById('live-catch-chance'),
    context: document.getElementById('live-context'),
  },
  battleHud: {
    root: document.getElementById('battle-hud'),
    species: document.getElementById('hud-species'),
    hpFill: document.getElementById('hud-hp-fill'),
    hpText: document.getElementById('hud-hp-text'),
    catchPct: document.getElementById('hud-catch-pct'),
    status: document.getElementById('hud-status'),
  },
  playerNametag: document.getElementById('player-nametag'),
  syncSave: document.getElementById('sync-save'),
  restoreSave: document.getElementById('restore-save'),
  saveStatus: document.getElementById('save-status'),
  saveHandoffModal: {
    root: document.getElementById('save-handoff-modal'),
    lines: document.getElementById('save-handoff-lines'),
    subtitle: document.getElementById('save-handoff-subtitle'),
    open: document.getElementById('save-handoff-open'),
    cancel: document.getElementById('save-handoff-cancel'),
  },
  status: {
    manifest: document.getElementById('status-manifest'),
    rom: document.getElementById('status-rom'),
    cache: document.getElementById('status-cache'),
    storage: document.getElementById('status-storage'),
    runtime: document.getElementById('status-runtime'),
    emulator: document.getElementById('status-emulator'),
    watch: document.getElementById('status-watch'),
    pageMode: document.getElementById('status-page-mode'),
  },
  wallet: {
    adapter: document.getElementById('wallet-adapter'),
    availability: document.getElementById('wallet-availability'),
    address: document.getElementById('wallet-address'),
    balance: document.getElementById('wallet-balance'),
    network: document.getElementById('wallet-network'),
    providerPath: document.getElementById('wallet-provider-path'),
    providerVersion: document.getElementById('wallet-provider-version'),
    accountName: document.getElementById('wallet-account-name'),
    signatureStatus: document.getElementById('wallet-signature-status'),
    ownedCount: document.getElementById('wallet-owned-count'),
    partyCount: document.getElementById('wallet-party-count'),
    boxedCount: document.getElementById('wallet-boxed-count'),
    boxCount: document.getElementById('wallet-box-count'),
    partyMeta: document.getElementById('wallet-party-meta'),
    boxMeta: document.getElementById('wallet-box-meta'),
    lastMint: document.getElementById('wallet-last-mint'),
    mintPhase: document.getElementById('wallet-mint-phase'),
    mintQuote: document.getElementById('wallet-mint-quote'),
    mintTx: document.getElementById('wallet-mint-tx'),
    pcSync: document.getElementById('wallet-pc-sync'),
    pokeball: document.getElementById('wallet-pokeball'),
    providerLog: document.getElementById('wallet-provider-log'),
  },
  busy: {
    overlay: document.getElementById('busy-overlay'),
    text: document.getElementById('busy-text'),
  },
  mintModal: {
    root: document.getElementById('mint-modal'),
    lines: document.getElementById('mint-modal-lines'),
    subtitle: document.getElementById('mint-modal-subtitle'),
    confirm: document.getElementById('mint-modal-confirm'),
    cancel: document.getElementById('mint-modal-cancel'),
  },
  captureHandoffModal: {
    root: document.getElementById('capture-handoff-modal'),
    lines: document.getElementById('capture-handoff-lines'),
    subtitle: document.getElementById('capture-handoff-subtitle'),
    open: document.getElementById('capture-handoff-open'),
    resume: document.getElementById('capture-handoff-resume'),
    cancel: document.getElementById('capture-handoff-cancel'),
    mintDirect: document.getElementById('capture-handoff-mint-direct'),
    mintStatus: document.getElementById('capture-handoff-mint-status'),
    manualSection: document.getElementById('capture-handoff-manual'),
    manualCopyCommit: document.getElementById('capture-handoff-manual-copy-commit'),
    manualCommitId: document.getElementById('capture-handoff-manual-commit-id'),
    manualCommitStatus: document.getElementById('capture-handoff-manual-commit-status'),
    manualStep2: document.getElementById('capture-handoff-manual-step-2'),
    manualCopyMint: document.getElementById('capture-handoff-manual-copy-mint'),
    manualMintId: document.getElementById('capture-handoff-manual-mint-id'),
    manualMintStatus: document.getElementById('capture-handoff-manual-mint-status'),
  },
};

const ctx2d = dom.screen.getContext('2d');
state.imageData = new ImageData(160, 144);
state.wallet.adapter = state.wallet.registry.getCurrentAdapter();

try {
  state.signin.request = parseSigninParamsFromLocation(window.location);
} catch (error) {
  state.signin.parseError = error;
}

try {
  const stored = sessionStorage.getItem(POKEBALL_STORAGE_KEY);
  const parsed = stored ? Number.parseInt(stored, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    state.pokeball.lastMintBlock = parsed;
  }
} catch {
  // sessionStorage may be unavailable in the sandboxed iframe; pokeball stub stays in-memory only.
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function log(message, level = 'accent') {
  const time = new Date().toISOString().slice(11, 19);
  dom.log.insertAdjacentHTML(
    'beforeend',
    `<span class="${level}">[${time}] ${escapeHtml(message)}</span>\n`,
  );
  dom.log.scrollTop = dom.log.scrollHeight;
}

function setStatus(name, value) {
  dom.status[name].textContent = value;
}

function pushBusy(message) {
  state.ui.busy += 1;
  if (message) {
    dom.busy.text.textContent = message;
  }
  dom.busy.overlay.classList.remove('hidden');
}

function popBusy() {
  state.ui.busy = Math.max(0, state.ui.busy - 1);
  if (state.ui.busy === 0) {
    dom.busy.overlay.classList.add('hidden');
  }
}

async function withBusy(message, action) {
  pushBusy(message);
  try {
    return await action();
  } finally {
    popBusy();
  }
}

function isModalOpen(root) {
  return Boolean(root && !root.classList.contains('hidden'));
}

function isUiLocked() {
  return state.ui.busy > 0
    || isModalOpen(dom.mintModal.root)
    || isModalOpen(dom.captureHandoffModal.root);
}

function isGameplayPaused() {
  return isUiLocked();
}

function isTopLevelDocument() {
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

function getDirectContentUrl() {
  return window.location.href;
}

function getInscriptionIdFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const explicitId = params.get('inscription') ?? params.get('inscription_id') ?? params.get('id');
  if (explicitId) {
    return explicitId.trim();
  }

  const match = window.location.pathname.match(/\/(?:html|content|inscriptions)\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : '';
}

function getNetworkFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const explicitNetwork = params.get('network');
  if (explicitNetwork === 'bellsMainnet' || explicitNetwork === 'bellsTestnet') {
    return explicitNetwork;
  }

  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '') {
    return 'bellsTestnet';
  }
  return host.includes('testnet') ? 'bellsTestnet' : 'bellsMainnet';
}

function resolveCompanionBase() {
  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get('companion');
  if (fromParam) return fromParam;

  try {
    const fromStorage = localStorage.getItem(COMPANION_URL_STORAGE_KEY);
    if (fromStorage) return fromStorage;
  } catch {
    // localStorage blocked (sandboxed iframe) — fall through to fallbacks.
  }

  // Future: p:pokebells-collection inscription may declare canonical
  // companion_urls[]. Shell can fetch + cache that list here and pick the
  // first reachable entry. Until the collection is minted we use the
  // hardcoded fallback list; anyone can add their mirror to a new shell
  // inscription without re-minting the root bootloader.
  return COMPANION_URL_FALLBACKS[0];
}

function getCompanionUrl(options = {}) {
  const configuredBase = resolveCompanionBase();
  const url = new URL(configuredBase, window.location.href);
  const inscriptionId = getInscriptionIdFromLocation();

  if (inscriptionId) {
    url.searchParams.set('inscription', inscriptionId);
  }
  url.searchParams.set('network', getNetworkFromLocation());
  url.searchParams.set('return', getDirectContentUrl());
  if (options.hash) {
    url.hash = options.hash;
  }
  return url.href;
}

function updatePageModeStatus() {
  const mode = isTopLevelDocument()
    ? 'Direct/top-level - storage + fullscreen available'
    : 'Sandboxed iframe - open direct URL';
  setStatus('pageMode', mode);
}

function updateStorageStatus() {
  updatePageModeStatus();

  if (state.storage.mode === 'indexeddb') {
    setStatus('storage', 'Durable local (IndexedDB)');
    dom.copyDurableUrl.disabled = true;
    dom.copyDurableUrl.textContent = 'Durable mode active';
    return;
  }

  if (state.storage.mode === 'memory') {
    const embedded = !isTopLevelDocument();
    setStatus('storage', embedded ? 'Session only - open durable URL' : 'Session memory only');
    dom.copyDurableUrl.disabled = !embedded;
    dom.copyDurableUrl.textContent = embedded ? 'Copy durable URL' : 'Storage blocked';
    return;
  }

  setStatus('storage', 'Checking');
  dom.copyDurableUrl.disabled = true;
  dom.copyDurableUrl.textContent = 'Copy durable URL';
}

function setLiveValue(name, value) {
  dom.live[name].textContent = value;
}

function formatBelAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });
}

function formatWalletBalance(walletState) {
  if (typeof walletState.balanceBel !== 'number' || !Number.isFinite(walletState.balanceBel)) {
    return '--';
  }

  if (walletState.balanceUnit === 'sats' && typeof walletState.balanceRaw === 'number') {
    return `${formatBelAmount(walletState.balanceBel)} BEL (${walletState.balanceRaw.toLocaleString('en-US')} sats)`;
  }

  return `${formatBelAmount(walletState.balanceBel)} BEL`;
}

function resolveElectrsBaseUrl() {
  const network = state.manifest?.network ?? getNetworkFromLocation();
  return network === 'bellsTestnet'
    ? 'https://bells-testnet-api.nintondo.io'
    : 'https://api.nintondo.io';
}

async function fetchBlockTipHeight({ force = false } = {}) {
  const now = Date.now();
  if (!force && state.pokeball.tipHeight !== null
      && (now - state.pokeball.tipFetchedAt) < BLOCK_TIP_HEIGHT_TTL_MS) {
    return state.pokeball.tipHeight;
  }
  if (state.pokeball.tipInFlight) {
    return state.pokeball.tipInFlight;
  }

  state.pokeball.tipInFlight = (async () => {
    try {
      const response = await fetch(`${resolveElectrsBaseUrl()}/blocks/tip/height`, {
        headers: { accept: 'text/plain' },
      });
      if (!response.ok) {
        throw new Error(`tip-height fetch failed (${response.status})`);
      }
      const height = Number.parseInt((await response.text()).trim(), 10);
      if (!Number.isFinite(height) || height <= 0) {
        throw new Error('tip-height response is not a positive integer');
      }
      state.pokeball.tipHeight = height;
      state.pokeball.tipFetchedAt = Date.now();
      return height;
    } finally {
      state.pokeball.tipInFlight = null;
    }
  })();
  return state.pokeball.tipInFlight;
}

function recordPokeballMint(blockHeight) {
  if (!Number.isFinite(blockHeight) || blockHeight <= 0) {
    return;
  }
  state.pokeball.lastMintBlock = blockHeight;
  try {
    sessionStorage.setItem(POKEBALL_STORAGE_KEY, String(blockHeight));
  } catch {
    // sessionStorage unavailable (sandboxed iframe) — keep the value in-memory for the session.
  }
}

function getPokeballCooldownStatus(currentHeight) {
  const last = state.pokeball.lastMintBlock;
  if (!Number.isFinite(last) || last <= 0) {
    return {
      ready: true,
      blocksRemaining: 0,
      blocksElapsed: null,
      note: 'Ready (no mint yet this session).',
    };
  }

  if (!Number.isFinite(currentHeight) || currentHeight <= 0) {
    return {
      ready: false,
      blocksRemaining: null,
      blocksElapsed: null,
      note: `Last mint at block ${last.toLocaleString('en-US')}, tip height unknown.`,
    };
  }

  const elapsed = currentHeight - last;
  const remaining = POKEBALL_COOLDOWN_BLOCKS - elapsed;
  if (remaining <= 0) {
    return {
      ready: true,
      blocksRemaining: 0,
      blocksElapsed: elapsed,
      note: `Ready (${elapsed.toLocaleString('en-US')} blocks since last mint).`,
    };
  }

  const hours = (remaining * 60) / 3600;
  return {
    ready: false,
    blocksRemaining: remaining,
    blocksElapsed: elapsed,
    note: `${remaining.toLocaleString('en-US')} blocks remaining (~${hours.toFixed(1)}h).`,
  };
}

function renderPokeballStatus(status) {
  if (!dom.wallet.pokeball) {
    return;
  }
  dom.wallet.pokeball.textContent = status.note;
  dom.wallet.pokeball.style.color = status.ready ? '' : 'var(--warn)';
}

async function refreshPokeballStatus() {
  if (!state.pokeball.lastMintBlock) {
    const initialStatus = getPokeballCooldownStatus(state.pokeball.tipHeight);
    renderPokeballStatus(initialStatus);
    return initialStatus;
  }

  let tipHeight = state.pokeball.tipHeight;
  try {
    tipHeight = await fetchBlockTipHeight();
  } catch (error) {
    log(`Block tip height fetch failed: ${error.message}`, 'warn');
  }

  const status = getPokeballCooldownStatus(tipHeight);
  renderPokeballStatus(status);
  return status;
}

function renderWalletProviderLog() {
  if (state.wallet.lastSignature) {
    dom.wallet.providerLog.textContent = `${JSON.stringify(state.wallet.lastSignature, null, 2)}\n`;
    return;
  }

  if (state.wallet.providerProbe) {
    dom.wallet.providerLog.textContent = `${JSON.stringify(state.wallet.providerProbe, null, 2)}\n`;
    return;
  }

  dom.wallet.providerLog.textContent = 'No provider probe yet.';
}

function canProbeWallet() {
  return typeof state.wallet.adapter?.probeProvider === 'function';
}

function resolveManifestUrl(input) {
  return new URL(input, window.location.href).href;
}

function createMemoryDb() {
  return {
    __memory: true,
    stores: state.storage.memory,
  };
}

function isMemoryDb(db) {
  return Boolean(db?.__memory);
}

function cloneStoredRecord(value) {
  if (!value || typeof value !== 'object') {
    return value ?? null;
  }

  const clone = {
    ...value,
  };
  if (value.buffer instanceof ArrayBuffer) {
    clone.buffer = value.buffer.slice(0);
  }
  return clone;
}

function getStorageBackendLabel() {
  return state.storage.mode === 'indexeddb' ? 'IndexedDB' : 'session memory';
}

function formatStorageBackendLabel() {
  const label = getStorageBackendLabel();
  return state.storage.mode === 'indexeddb' ? label : `${label} (not persisted after close)`;
}

function noteStorageFallback(error) {
  state.storage.mode = 'memory';
  updateStorageStatus();
  if (!state.storage.warningShown) {
    const message = error?.message ?? String(error ?? 'unknown storage error');
    const durableHint = isTopLevelDocument()
      ? ''
      : ` Open this inscription directly for durable local storage: ${getDirectContentUrl()}`;
    log(`Persistent storage unavailable in this sandbox (${message}). Falling back to session memory only.${durableHint}`, 'warn');
    state.storage.warningShown = true;
  }
}

function openDb() {
  if (!state.dbPromise) {
    state.dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        noteStorageFallback(new Error('indexedDB is undefined'));
        resolve(createMemoryDb());
        return;
      }

      let request;
      try {
        request = indexedDB.open('pokebells-phase1', 4);
      } catch (error) {
        noteStorageFallback(error);
        resolve(createMemoryDb());
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('roms')) {
          db.createObjectStore('roms', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('chunks')) {
          db.createObjectStore('chunks', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('saves')) {
          db.createObjectStore('saves', { keyPath: 'key' });
        }
        // captureReveals stores the IV + salt + ram_snapshot pre-image for
        // each v1.4 capture so the op:"reveal" inscription can be built
        // later. Read-only in v1.5 (kept for legacy testnet records);
        // v1.5 captures populate `pendingCaptures` instead.
        if (!db.objectStoreNames.contains('captureReveals')) {
          db.createObjectStore('captureReveals', { keyPath: 'attestation' });
        }
        // v1.5 capture-to-mint state machine. One row per in-flight
        // capture, keyed by attestation. Drives the "Pending mints"
        // panel + boot-time resume per SHELL-V1.5-PIPELINE.md.
        if (!db.objectStoreNames.contains('pendingCaptures')) {
          db.createObjectStore('pendingCaptures', { keyPath: 'attestation' });
        }
      };
      request.onsuccess = () => {
        state.storage.mode = 'indexeddb';
        updateStorageStatus();
        resolve(request.result);
      };
      request.onerror = () => {
        noteStorageFallback(request.error);
        resolve(createMemoryDb());
      };
      request.onblocked = () => {
        noteStorageFallback(new Error('indexedDB open blocked'));
        resolve(createMemoryDb());
      };
    });
  }
  return state.dbPromise;
}

// Map of store name → keyPath used by the memory-mode fallback. IDB
// itself reads the keyPath from its own schema; the fallback Map needs
// the lookup since `Map.set(key, value)` requires extracting the key
// explicitly.
const IDB_STORE_KEY_PATHS = {
  roms: 'key',
  chunks: 'key',
  saves: 'key',
  captureReveals: 'attestation',
  pendingCaptures: 'attestation',
};

function dbGet(db, storeName, key) {
  if (isMemoryDb(db)) {
    return Promise.resolve(cloneStoredRecord(db.stores[storeName].get(key) ?? null));
  }
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(db, storeName, value) {
  if (isMemoryDb(db)) {
    const keyPath = IDB_STORE_KEY_PATHS[storeName] ?? 'key';
    const key = value?.[keyPath];
    if (key == null) {
      return Promise.reject(new Error(`dbPut: ${storeName} record missing keyPath "${keyPath}"`));
    }
    db.stores[storeName].set(key, cloneStoredRecord(value));
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function dbDelete(db, storeName, key) {
  if (isMemoryDb(db)) {
    db.stores[storeName].delete(key);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function dbGetAll(db, storeName) {
  if (isMemoryDb(db)) {
    return Promise.resolve(Array.from(db.stores[storeName].values()).map(cloneStoredRecord));
  }
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

function dbClear(db, storeName) {
  if (isMemoryDb(db)) {
    db.stores[storeName].clear();
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getSaveKey(suffix = 'live') {
  const romHash = state.manifest?.rom?.sha256 ?? 'unknown-rom';
  return `save:${romHash}:${suffix}`;
}

function makeWasmBuffer(ptr, size) {
  return new Uint8Array(state.module.HEAPU8.buffer, ptr, size);
}

function withNewFileData(fileDataPtr, callback) {
  const buffer = makeWasmBuffer(
    state.module._get_file_data_ptr(fileDataPtr),
    state.module._get_file_data_size(fileDataPtr),
  );
  try {
    return callback(fileDataPtr, buffer);
  } finally {
    state.module._file_data_delete(fileDataPtr);
  }
}

function withNewExtRamFileData(callback) {
  return withNewFileData(state.module._ext_ram_file_data_new(state.emulator), callback);
}

async function readStoredExtRamSnapshot() {
  const db = await openDb();
  return dbGet(db, 'saves', getSaveKey());
}

function hasValidMainSave(extRamBuffer) {
  if (!extRamBuffer || extRamBuffer.byteLength <= MAIN_DATA_CHECKSUM_OFFSET) {
    return false;
  }

  return extRamBuffer[MAIN_DATA_CHECKSUM_OFFSET] === calcChecksum(
    extRamBuffer,
    GAME_DATA_OFFSET,
    GAME_DATA_LENGTH,
  );
}

function canSyncPcBoxes() {
  // Crystal PC box writer is not implemented yet (see gen2-pc-storage.mjs
  // TODO_CRYSTAL_SAVE). Short-circuit here so we don't call into binjgb's
  // _emulator_write_ext_ram with Gen 1-derived offsets, which reliably OOBs
  // on a Crystal SRAM layout (observed on fresh-game boot 2026-04-22).
  if (!PC_SYNC_ENABLED) {
    return false;
  }
  if (!state.module || !state.emulator || !state.speciesCatalog) {
    return false;
  }

  const extRam = getExtRamBuffer();
  return hasValidMainSave(extRam);
}

// Compute the SHA-256 of a Uint8Array via Web Crypto. Used for local save
// fingerprinting so restore-from-chain can detect divergences without
// comparing raw 32 KB buffers.
async function sha256HexOfBytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join('');
}

async function writeStoredExtRamSnapshot(buffer, reason = 'manual') {
  const db = await openDb();
  // Track a monotonic local_save_version + sha so the restore-from-chain
  // dialog can diff local vs chain. We read the previous row to carry its
  // synced_chain_version forward (set once by restore / sync flows).
  let prev = null;
  try { prev = await dbGet(db, 'saves', getSaveKey()); } catch {}
  const sha = await sha256HexOfBytes(buffer);
  const prevVersion = Number.isInteger(prev?.local_save_version) ? prev.local_save_version : 0;
  const nextVersion = reason === 'chain-restore' || reason === 'chain-sync-mark'
    ? prevVersion                 // chain flows don't bump local version
    : prevVersion + 1;            // every in-game save increments

  await dbPut(db, 'saves', {
    key: getSaveKey(),
    buffer: buffer.slice().buffer,
    byteLength: buffer.byteLength,
    reason,
    updatedAt: new Date().toISOString(),
    local_save_version: nextVersion,
    sram_sha256: sha,
    synced_chain_version: prev?.synced_chain_version ?? null,
    synced_chain_inscription_id: prev?.synced_chain_inscription_id ?? null,
    synced_chain_sha256: prev?.synced_chain_sha256 ?? null,
  });

  // Keep the shell state in sync for quick access (used by the UI
  // comparison + the save handoff record).
  state.save.lastInscribedVersion = prev?.synced_chain_version ?? state.save.lastInscribedVersion;
  state.save.lastLocalSha256 = sha;
  state.save.localVersion = nextVersion;
}

// Mark the current local save as "in sync with chain". Called after a
// successful POST /api/saves (companion) OR after a chain restore. Lets
// the restore dialog detect "local has diverged from chain" without the
// user having to remember when they last synced.
async function markLocalSaveSyncedWithChain({ chainVersion, chainInscriptionId, chainSha256 }) {
  const db = await openDb();
  const prev = await dbGet(db, 'saves', getSaveKey());
  if (!prev) return;
  await dbPut(db, 'saves', {
    ...prev,
    synced_chain_version: chainVersion,
    synced_chain_inscription_id: chainInscriptionId,
    synced_chain_sha256: chainSha256,
  });
}

async function backupStoredExtRamSnapshotIfMissing(buffer) {
  const db = await openDb();
  const backupKey = getSaveKey('backup-before-pc-sync');
  const existing = await dbGet(db, 'saves', backupKey);
  if (existing) {
    return;
  }

  await dbPut(db, 'saves', {
    key: backupKey,
    buffer: buffer.slice().buffer,
    byteLength: buffer.byteLength,
    reason: 'backup-before-pc-sync',
    updatedAt: new Date().toISOString(),
  });
}

async function backupNamedExtRamSnapshot(buffer, suffix) {
  const db = await openDb();
  await dbPut(db, 'saves', {
    key: getSaveKey(suffix),
    buffer: buffer.slice().buffer,
    byteLength: buffer.byteLength,
    reason: suffix,
    updatedAt: new Date().toISOString(),
  });
}

function getExtRamBuffer() {
  if (!state.module || !state.emulator) {
    return null;
  }
  // Crystal MBC3+RTC triggers a WASM trap inside binjgb's
  // _emulator_write_ext_ram path. Gate the whole buffer read here so every
  // downstream callsite (persist, backup, PC sync, capture handoff) sees
  // null consistently instead of each guard having to remember to check.
  if (isCrystalRom()) {
    return null;
  }

  return withNewExtRamFileData((fileDataPtr, buffer) => {
    state.module._emulator_write_ext_ram(state.emulator, fileDataPtr);
    return new Uint8Array(buffer);
  });
}

function loadExtRamBuffer(extRamBuffer) {
  if (!state.module || !state.emulator) {
    return false;
  }

  // Crystal MBC3+TIMER+RAM+BATTERY traps in binjgb's
  // _emulator_read_ext_ram path (same root cause as _emulator_write_ext_ram
  // — MBC3 RTC register interaction). Observed 2026-04-23: switching
  // manifests mid-session (default non-pokebells ROM → pokecrystal-pokebells
  // ROM) triggered a WASM "memory access out of bounds" trap that killed
  // the whole module; user had to delete IndexedDB + reload to recover.
  //
  // Fix: bypass binjgb's ext-ram API entirely on Crystal by driving the
  // MBC3 bank-select + ram-enable registers ourselves via writeSramSnapshot
  // (in capture-core.mjs). Same result as read_ext_ram (buffer bytes
  // loaded into the cart's banked SRAM) but never trips the trap.
  if (isCrystalRom()) {
    if (extRamBuffer.byteLength !== SRAM_TOTAL_BYTE_LENGTH) {
      log(`Stored Crystal SRAM size mismatch (${extRamBuffer.byteLength} bytes, expected ${SRAM_TOTAL_BYTE_LENGTH}); skipping restore.`, 'warn');
      return false;
    }
    try {
      writeSramSnapshot(
        state.gb.writeByte,
        state.gb.readByte,
        new Uint8Array(extRamBuffer),
      );
      return true;
    } catch (error) {
      log(`Crystal-safe SRAM restore failed: ${error.message}; proceeding without save.`, 'warn');
      return false;
    }
  }

  return withNewExtRamFileData((fileDataPtr, buffer) => {
    if (buffer.byteLength !== extRamBuffer.byteLength) {
      return false;
    }

    buffer.set(extRamBuffer);
    state.module._emulator_read_ext_ram(state.emulator, fileDataPtr);
    return true;
  });
}

// binjgb's _emulator_write_ext_ram OOBs on Crystal MBC3+TIMER+RAM+BATTERY
// carts (observed 2026-04-22 during the boot splash when the game's RTC
// init touches ext-ram, triggering _was_ext_ram_updated and our persist
// cycle). A WASM trap kills the whole module, not just the one call, so a
// try/catch is too late — we must never call write_ext_ram on Crystal.
//
// Consequence: SRAM persistence across sessions is disabled on Gen 2 while
// this is true. The mint ROM is stateless by design (captures persist as
// inscriptions, not as local saves), so losing the local save mirror is
// acceptable for the PoC. Fixing binjgb's MBC3 ext-ram path is the proper
// long-term solution.
function isCrystalRom() {
  const romName = String(state.manifest?.rom?.name ?? '').toLowerCase();
  return romName.includes('pokecrystal');
}

// Release a party member in-game to enforce the "cancel = pokemon gone"
// policy for non-starter captures. Crystal stores the party across several
// WRAM arrays (wPartySpecies, wPartyMon1..6, wPartyMonOTs, wPartyMonNicknames);
// for the PoC we do the minimum viable wipe:
//   - Set wPartySpecies[slotIdx] to 0xFF (species-array terminator).
//   - Decrement wPartyCount.
//   - Zero wPartyMon{N}.species so the slot's party-mon struct is invalid.
// The game treats a party with count=N-1 and a trailing 0xFF in species as
// having one fewer member. Nickname / OT arrays keep stale bytes but aren't
// referenced because wPartyCount gates the iteration. Full compaction
// (shifting slot N+1..5 back) is a follow-up.
function releasePokemonInGame(slotIndex) {
  if (!state.gb || !Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 6) {
    return;
  }
  const wPartySpecies = 0xdcd8; // wPartySpecies array, 6 bytes
  const slotIdx = slotIndex - 1;

  withWramBank1(() => {
    const currentCount = state.gb.readByte(RAM_ADDRS.teamCount) & 0xff;
    if (currentCount === 0) return;

    // Shift wPartySpecies left over the released slot so the remaining mons
    // stay contiguous, then terminate with 0xFF.
    for (let i = slotIdx; i < 5; i += 1) {
      const next = state.gb.readByte(wPartySpecies + i + 1);
      state.gb.writeByte(wPartySpecies + i, next);
    }
    state.gb.writeByte(wPartySpecies + 5, 0xff);

    // Zero the released party-mon struct's species byte so any stale code
    // that reads by slot sees it as empty.
    const slotBase = RAM_ADDRS.teamSlotBase + slotIdx * RAM_ADDRS.teamSlotSize;
    state.gb.writeByte(slotBase, 0x00);

    // Decrement wPartyCount.
    state.gb.writeByte(RAM_ADDRS.teamCount, currentCount - 1);
  });

  // Resync the capture watcher so the just-decremented count doesn't look
  // like a "party-shrunk" event that Resyncs prevTeamCount inconsistently.
  state.capture.prevTeamCount = Math.max(0, state.capture.prevTeamCount - 1);
  state.capture.captureFrames = 0;
  log('Pokemon released in-game: slot ' + slotIndex + ' wiped, wPartyCount decremented.', 'warn');
}

// Crystal-safe SRAM read. binjgb's _emulator_write_ext_ram OOBs on
// MBC3+RTC so we bypass it entirely by driving the CPU-visible MBC3
// registers ourselves (0x4000 bank select, 0xA000 window). This produces
// the same 32 KB buffer as ext_ram but never traps binjgb.
function readSramSafe() {
  if (!state.gb) return null;
  if (isCrystalRom()) {
    return readSramSnapshot(state.gb.readByte, state.gb.writeByte);
  }
  return getExtRamBuffer();
}

async function persistCurrentExtRam(reason = 'emulator-update') {
  // Use the Crystal-safe reader so in-game saves DO land in IndexedDB on
  // Gen 2 (previously skipped entirely — the cause of "rebuild manifest
  // wipes progress"). Gen 1 keeps the binjgb write_ext_ram path.
  const extRam = readSramSafe();
  if (!extRam) return false;

  await writeStoredExtRamSnapshot(extRam, reason);
  state.sram.lastPersistMs = performance.now();
  return true;
}

function hasUnloadSensitiveState() {
  return Boolean(
    state.sram.pendingPersist
    || state.capture.inFlight
    || state.save.pending
    || (state.wallet?.mintFlow?.phase && state.wallet.mintFlow.phase !== 'idle')
    || state.ui.captureHandoff.payload
    || state.ui.saveHandoff.record
  );
}

function flushPendingLocalState(reason = 'pagehide') {
  if (!state.sram.pendingPersist) return;
  state.sram.pendingPersist = false;
  persistCurrentExtRam(reason).catch((error) => {
    log(`Emergency SRAM persist failed during ${reason}: ${error.message}`, 'warn');
  });
}

function handleBeforeUnload(event) {
  if (!hasUnloadSensitiveState()) return;
  flushPendingLocalState('beforeunload');
  event.preventDefault();
  event.returnValue = '';
}

async function fetchBundledDevSave() {
  const response = await fetch(new URL('dev-red.sav', window.location.href));
  if (!response.ok) {
    throw new Error(`Dev save fetch failed (${response.status}).`);
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  if (!hasValidMainSave(buffer)) {
    throw new Error('Bundled dev save failed checksum validation.');
  }

  return buffer;
}

function summarizePcSyncResult(result) {
  const rangeLabel = `BOX ${result.firstManagedBox}-${result.lastManagedBox}`;
  return result.truncatedCount
    ? `${result.syncedCount} synced to ${rangeLabel}; ${result.truncatedCount} left out.`
    : `${result.syncedCount} synced to ${rangeLabel}.`;
}

async function ensureVerifiedSigninSession() {
  if (!state.signin.request) {
    return null;
  }
  if (state.signin.session) {
    return state.signin.session;
  }

  const session = await verifySigninRequest(state.signin.request, {
    network: state.manifest?.network,
    location: window.location,
  });
  state.signin.session = session;
  log(
    `Verified signed game URL for ${session.wallet} (${session.publicKeySource}).`,
    'ok',
  );
  return session;
}

async function ensureSigninCollection() {
  const session = await ensureVerifiedSigninSession();
  if (!session) {
    return null;
  }
  if (state.signin.collection) {
    return state.signin.collection;
  }

  const collection = await fetchOwnedPokebellsCollection(session.wallet, {
    network: session.services?.key ?? state.manifest?.network,
    location: window.location,
  });
  state.signin.collection = collection;
  log(
    `Loaded ${collection.records.length} PokeBells inscription${collection.records.length === 1 ? '' : 's'} `
      + `for ${session.wallet} via ${collection.source}.`,
    'ok',
  );
  return collection;
}

async function buildBootExtRamPlan() {
  if (state.signin.parseError) {
    throw state.signin.parseError;
  }

  const snapshot = await readStoredExtRamSnapshot();
  let baseBuffer = snapshot?.buffer ? new Uint8Array(snapshot.buffer) : null;
  const hasStoredBuffer = Boolean(baseBuffer);
  const hasStoredSave = hasValidMainSave(baseBuffer);

  if (!state.signin.request) {
    if (!hasStoredBuffer) {
      return {
        buffer: null,
        message: 'Waiting for a save file.',
      };
    }

    return {
      buffer: baseBuffer,
      logLevel: 'ok',
      logMessage: `SRAM restored from ${formatStorageBackendLabel()} (${snapshot.byteLength} bytes)`,
      message: hasStoredSave
        ? `SRAM restored (${snapshot.byteLength} bytes).`
        : 'SRAM restored, but no valid in-game save was detected yet.',
    };
  }

  if (!hasStoredSave) {
    baseBuffer = await fetchBundledDevSave();
    log('Bootstrapping signed-in SRAM from the bundled dev save.', 'accent');
  }

  const collection = await ensureSigninCollection();
  const ownedPokemon = collection?.records ?? [];
  const syncResult = syncOwnedCollectionToPcBoxes(baseBuffer, {
    ownedPokemon,
  }, state.speciesCatalog, {
    trainerName: DEFAULT_TRAINER_NAME,
  });
  const syncSummary = summarizePcSyncResult(syncResult);
  const session = state.signin.session;

  return {
    buffer: syncResult.buffer,
    persistReason: 'signin-verified-sync',
    logLevel: 'ok',
    logMessage: `Signed-in collection applied for ${session.wallet} (${syncSummary})`,
    message: `Signed-in wallet ${session.wallet}: ${syncSummary}`,
  };
}

async function restoreStoredExtRam() {
  const plan = await buildBootExtRamPlan();
  if (!plan?.buffer) {
    setPcSyncMessage(plan?.message ?? 'Waiting for a save file.');
    return false;
  }

  const restored = loadExtRamBuffer(plan.buffer);
  if (!restored) {
    throw new Error(`Stored SRAM size mismatch (${plan.buffer.byteLength} bytes).`);
  }

  if (plan.persistReason) {
    await writeStoredExtRamSnapshot(plan.buffer, plan.persistReason);
  }
  if (plan.message) {
    setPcSyncMessage(plan.message);
  }
  if (plan.logMessage) {
    log(plan.logMessage, plan.logLevel ?? 'ok');
  }

  // Populate state.save from the stored row so the restore-from-chain
  // comparison + "local has unsaved progress" warning have data to work
  // with as soon as the emulator boots.
  try {
    const db = await openDb();
    const stored = await dbGet(db, 'saves', getSaveKey());
    if (stored) {
      state.save.localVersion = stored.local_save_version ?? 0;
      state.save.lastLocalSha256 = stored.sram_sha256 ?? null;
      state.save.lastInscribedVersion = stored.synced_chain_version ?? 0;
      state.save.lastInscribedSha256 = stored.synced_chain_sha256 ?? null;
    }
  } catch { /* non-fatal */ }

  return true;
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function concatChunks(chunks, totalBytes) {
  const assembled = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    assembled.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return assembled;
}

function resolveAssetUrl(source, manifest, manifestUrl) {
  if (!source || typeof source !== 'object') {
    throw new Error('Invalid asset source.');
  }

  if (source.type === 'file') {
    if (!source.path) {
      throw new Error('Missing file source path.');
    }
    return new URL(source.path, manifestUrl).href;
  }

  if (source.type === 'url') {
    if (!source.url) {
      throw new Error('Missing URL source.');
    }
    return source.url;
  }

  if (source.type === 'inscription') {
    if (!source.inscriptionId) {
      throw new Error('Inscription source is missing inscriptionId.');
    }
    const baseUrl = source.contentBaseUrl || manifest.contentBaseUrl || DEFAULT_CONTENT_BASE_URL;
    return new URL(source.inscriptionId, baseUrl).href;
  }

  throw new Error(`Unsupported source type: ${source.type}`);
}

async function fetchBinary(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }
  return response.arrayBuffer();
}

async function fetchChunk(manifest, manifestUrl, chunk) {
  const db = await openDb();
  const chunkKey = `${manifest.rom.sha256}:chunk:${chunk.index}:${chunk.sha256}`;
  const cached = await dbGet(db, 'chunks', chunkKey);
  if (cached) {
    setStatus('cache', 'Warm');
    log(`Chunk ${chunk.index + 1}/${manifest.rom.chunkCount} loaded from ${formatStorageBackendLabel()} cache.`);
    return new Uint8Array(cached.buffer);
  }

  const sourceUrl = resolveAssetUrl(chunk.source, manifest, manifestUrl);
  log(`Chunk ${chunk.index + 1}/${manifest.rom.chunkCount} fetch ${sourceUrl}`);
  const buffer = await fetchBinary(sourceUrl);
  if (buffer.byteLength !== chunk.byteLength) {
    throw new Error(`Chunk ${chunk.index} size mismatch: expected ${chunk.byteLength}, got ${buffer.byteLength}`);
  }

  const hash = await sha256Hex(buffer);
  if (hash !== chunk.sha256) {
    throw new Error(`Chunk ${chunk.index} hash mismatch.`);
  }

  await dbPut(db, 'chunks', {
    key: chunkKey,
    buffer,
    byteLength: buffer.byteLength,
    sha256: hash,
    createdAt: new Date().toISOString(),
  });

  setStatus('cache', 'Filling');
  return new Uint8Array(buffer);
}

async function getRomBuffer(manifest, manifestUrl, forceRebuild = false) {
  const db = await openDb();
  const cacheKey = manifest.rom.cacheKey || `rom:${manifest.rom.sha256}`;

  if (!forceRebuild) {
    const cachedRom = await dbGet(db, 'roms', cacheKey);
    if (cachedRom && cachedRom.sha256 === manifest.rom.sha256 && cachedRom.byteLength === manifest.rom.byteLength) {
      setStatus('cache', 'ROM cache hit');
      log(`ROM cache hit for ${manifest.rom.name}`, 'ok');
      return cachedRom.buffer;
    }
  }

  const chunks = [];
  for (const chunk of manifest.chunks) {
    const chunkBytes = await fetchChunk(manifest, manifestUrl, chunk);
    chunks.push(chunkBytes);
    setStatus('rom', `Chunks ${chunk.index + 1}/${manifest.rom.chunkCount}`);
  }

  const romBytes = concatChunks(chunks, manifest.rom.byteLength);
  const romHash = await sha256Hex(romBytes.buffer);
  if (romHash !== manifest.rom.sha256) {
    throw new Error('Assembled ROM hash mismatch.');
  }

  await dbPut(db, 'roms', {
    key: cacheKey,
    buffer: romBytes.buffer,
    byteLength: romBytes.byteLength,
    sha256: romHash,
    createdAt: new Date().toISOString(),
  });

  setStatus('cache', 'ROM cached');
  log(`ROM assembled and cached in ${formatStorageBackendLabel()} (${romBytes.byteLength} bytes)`, 'ok');
  return romBytes.buffer;
}

function loadScriptOnce(url) {
  return new Promise((resolve, reject) => {
    const selector = `script[data-runtime-src="${CSS.escape(url)}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.runtimeSrc = url;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function ensureRuntime(manifest, manifestUrl) {
  if (!state.runtimePromise) {
    state.runtimePromise = (async () => {
      const runtime = manifest.runtime || {};
      const jsUrl = resolveAssetUrl(runtime.js || { type: 'file', path: '../poc/binjgb.js' }, manifest, manifestUrl);
      const wasmUrl = resolveAssetUrl(runtime.wasm || { type: 'file', path: '../poc/binjgb.wasm' }, manifest, manifestUrl);
      log(`Runtime JS ${jsUrl}`);
      log(`Runtime WASM ${wasmUrl}`);
      await loadScriptOnce(jsUrl);

      if (typeof window.Binjgb !== 'function') {
        throw new Error('binjgb runtime did not expose window.Binjgb');
      }

      setStatus('runtime', 'Loading');
      state.module = await window.Binjgb({
        locateFile(fileName) {
          if (fileName.endsWith('.wasm')) {
            return wasmUrl;
          }
          return fileName;
        },
      });
      setStatus('runtime', 'Ready');
      log('binjgb runtime ready', 'ok');
    })().catch((error) => {
      state.runtimePromise = null;
      throw error;
    });
  }

  return state.runtimePromise;
}

function createGameBoyBridge() {
  const bridge = {
    readByte(address) {
      return state.module._emulator_read_mem(state.emulator, address);
    },
    writeByte(address, value) {
      state.module._emulator_write_mem(state.emulator, address, value & 0xff);
    },
    readWord(address) {
      return readWord(bridge.readByte, address);
    },
  };

  window.pokebellsEmulator = bridge;
  return bridge;
}

function renderCapturePayload(payload) {
  dom.captureJson.textContent = payload ? `${JSON.stringify(payload, null, 2)}\n` : 'No capture yet.';
}

function getCapturePayloadJson(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function renderMintFlow() {
  const flow = state.wallet.mintFlow;
  dom.wallet.mintPhase.textContent = flow.message;
  dom.wallet.mintTx.textContent = flow.inscriptionId ?? flow.txid ?? '--';

  if (!flow.quote) {
    dom.wallet.mintQuote.textContent = '--';
    return;
  }

  const feeText = typeof flow.quote.networkFeeBel === 'number'
    ? `${flow.quote.networkFeeBel.toFixed(6)} BEL`
    : 'fee pending';
  const byteText = typeof flow.quote.inscriptionBytes === 'number'
    ? `${flow.quote.inscriptionBytes} bytes`
    : 'size pending';
  dom.wallet.mintQuote.textContent = `${feeText}\n${byteText}`;
}

function updateMintButtonState(walletState = null) {
  const hasPayload = Boolean(state.capture.lastPayload);
  const supportsAdapterMint = Boolean(walletState?.supportsMint ?? state.wallet.adapter?.supportsMint);
  const connected = Boolean(walletState?.connected ?? state.wallet.connected);

  if (supportsAdapterMint) {
    dom.walletMint.textContent = state.wallet.adapter.kind === 'mock'
      ? 'Mock mint last capture'
      : 'Mint last capture';
    dom.walletMint.disabled = !connected || !hasPayload;
    return;
  }

  dom.walletMint.textContent = 'Copy JSON + open companion';
  dom.walletMint.disabled = !hasPayload;
}

function setMintFlow(nextFlow) {
  state.wallet.mintFlow = {
    ...state.wallet.mintFlow,
    ...nextFlow,
  };
  renderMintFlow();
}

function setPcSyncMessage(message) {
  state.wallet.pcSyncMessage = message;
  dom.wallet.pcSync.textContent = message;
}

function shortId(value) {
  if (!value) {
    return 'pending inscription';
  }
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 12)}...${value.slice(-4)}`;
}

function getPokemonIdentity(pokemon) {
  return pokemon?.inscription_id ?? `${pokemon?.species ?? '--'}:${pokemon?.captured_at ?? '--'}`;
}

function getLatestOwnedPokemon(ownedPokemon) {
  if (!ownedPokemon.length) {
    return null;
  }

  return ownedPokemon
    .slice()
    .sort((left, right) => {
      const leftBlock = Number(left?.minted_at_block ?? -1);
      const rightBlock = Number(right?.minted_at_block ?? -1);
      if (leftBlock !== rightBlock) {
        return rightBlock - leftBlock;
      }

      const leftTime = Date.parse(left?.captured_at ?? '') || 0;
      const rightTime = Date.parse(right?.captured_at ?? '') || 0;
      return rightTime - leftTime;
    })[0];
}

function formatStorageLocation(pokemon) {
  if (!pokemon?.storage) {
    return pokemon?.active ? 'Party' : 'Boxed';
  }

  if (pokemon.storage.location === 'party') {
    return `Party slot ${pokemon.storage.slot ?? '--'}`;
  }

  if (pokemon.storage.location === 'box') {
    const label = pokemon.storage.box_label ?? `Box ${pokemon.storage.box_index ?? '--'}`;
    return `${label} slot ${pokemon.storage.slot ?? '--'}`;
  }

  return 'Unplaced';
}

function renderPokemonCard({
  title,
  metaLines,
  empty = false,
}) {
  return [
    `<div class="team-card${empty ? ' empty-card' : ''}">`,
    `<div class="team-title">${escapeHtml(title)}</div>`,
    `<div class="team-meta">${escapeHtml(metaLines.join('\n'))}</div>`,
    '</div>',
  ].join('');
}

async function refreshMintQuote() {
  if (!state.capture.lastPayload || !state.wallet.adapter || typeof state.wallet.adapter.quoteMint !== 'function') {
    setMintFlow({
      phase: 'idle',
      message: state.capture.lastPayload ? 'Quote unavailable' : 'Idle',
      quote: null,
      txid: null,
      inscriptionId: null,
    });
    return;
  }

  const payload = state.capture.lastPayload;
  const quote = await state.wallet.adapter.quoteMint(payload);
  if (state.capture.lastPayload !== payload) {
    return;
  }
  if (payload.inscription_id) {
    setMintFlow({
      phase: 'confirmed',
      message: `Confirmed at block ${payload.minted_at_block ?? '--'}`,
      quote,
      txid: payload.txid ?? null,
      inscriptionId: payload.inscription_id,
    });
    return;
  }
  setMintFlow({
    phase: 'ready',
    message: quote.note ?? 'Ready to mint',
    quote,
    txid: null,
    inscriptionId: null,
  });
}

function renderWalletAdapterOptions() {
  const adapters = state.wallet.registry.listAdapters();
  dom.walletAdapterSelect.innerHTML = adapters
    .map((adapter) => `<option value="${adapter.kind}">${adapter.label}</option>`)
    .join('');
  dom.walletAdapterSelect.value = state.wallet.adapter.kind;
}

function renderOwnedParty(collection) {
  dom.ownedParty.innerHTML = Array.from({ length: 6 }, (_, index) => {
    const pokemon = collection.party[index];
    if (!pokemon) {
      return renderPokemonCard({
        title: `${index + 1}. Empty slot`,
        metaLines: ['Open for the next mint.'],
        empty: true,
      });
    }

    return renderPokemonCard({
      title: `${index + 1}. ${pokemon.species_name ?? `Species ${pokemon.species}`}`,
      metaLines: [
        `#${pokemon.species ?? '--'} Lv.${pokemon.level ?? '--'}`,
        `catch ${pokemon.catch_rate ?? '--'}`,
        shortId(pokemon.inscription_id),
      ],
    });
  }).join('');
}

function renderOwnedBoxes(collection) {
  dom.ownedBoxes.innerHTML = collection.boxes
    .map((box) => {
      const cards = box.pokemon.length
        ? `<div class="team-grid">${box.pokemon.map((pokemon) => renderPokemonCard({
          title: pokemon.species_name ?? `Species ${pokemon.species}`,
          metaLines: [
            `#${pokemon.species ?? '--'} Lv.${pokemon.level ?? '--'}`,
            `slot ${pokemon.storage?.slot ?? '--'} / 20`,
            shortId(pokemon.inscription_id),
          ],
        })).join('')}</div>`
        : '<p class="subline">Empty box.</p>';

      return [
        '<section class="box-block">',
        `<div class="section-head"><div class="section-title">${escapeHtml(box.label)}</div><div class="section-meta">${box.pokemon.length} / 20 slots used</div></div>`,
        cards,
        '</section>',
      ].join('');
    })
    .join('');
}

function renderOwnedPokemon(collection) {
  renderOwnedParty(collection);
  renderOwnedBoxes(collection);
  dom.ownedPokemon.textContent = collection.totalCount
    ? `${JSON.stringify({
      party: collection.party,
      boxes: collection.boxes,
    }, null, 2)}\n`
    : 'No mock mints yet.';
}

async function getCurrentOwnedCollection() {
  return typeof state.wallet.adapter.getOwnedCollection === 'function'
    ? state.wallet.adapter.getOwnedCollection()
    : normalizeOwnedCollection({
      ownedPokemon: await state.wallet.adapter.getOwnedPokemon(),
    });
}

async function refreshWalletView() {
  const walletState = await state.wallet.adapter.getState();
  const ownedCollection = await getCurrentOwnedCollection();
  const ownedPokemon = ownedCollection.ownedPokemon;
  const supportsSignMessage = walletState.capabilities.includes('signMessage');

  state.wallet.connected = walletState.connected;
  if (!ownedPokemon.length) {
    state.wallet.lastMint = null;
  } else if (!state.wallet.lastMint) {
    state.wallet.lastMint = getLatestOwnedPokemon(ownedPokemon);
  } else {
    const currentId = getPokemonIdentity(state.wallet.lastMint);
    state.wallet.lastMint = ownedPokemon.find((pokemon) => getPokemonIdentity(pokemon) === currentId)
      ?? getLatestOwnedPokemon(ownedPokemon);
  }

  dom.walletAdapterSelect.value = state.wallet.adapter.kind;
  dom.walletConnect.textContent = walletState.connected ? 'Disconnect wallet' : 'Connect wallet';
  updateMintButtonState(walletState);
  dom.wallet.adapter.textContent = walletState.label;
  dom.wallet.availability.textContent = walletState.available ? 'Ready' : 'Extension missing';
  dom.wallet.address.textContent = walletState.connected ? walletState.address : 'Disconnected';
  dom.wallet.balance.textContent = walletState.connected ? formatWalletBalance(walletState) : '--';
  dom.wallet.network.textContent = walletState.network;
  dom.wallet.providerPath.textContent = walletState.providerPath ?? '--';
  dom.wallet.providerVersion.textContent = walletState.providerVersion ?? '--';
  dom.wallet.accountName.textContent = walletState.accountName ?? '--';
  dom.wallet.signatureStatus.textContent = state.wallet.lastSignature
    ? `Signed ${state.wallet.lastSignature.signedAt.slice(11, 19)}`
    : 'None';
  dom.wallet.ownedCount.textContent = String(ownedCollection.totalCount);
  dom.wallet.partyCount.textContent = `${ownedCollection.party.length} / 6`;
  dom.wallet.boxedCount.textContent = String(ownedCollection.boxedPokemon.length);
  dom.wallet.boxCount.textContent = String(ownedCollection.boxes.length);
  dom.wallet.partyMeta.textContent = `${ownedCollection.party.length} / 6 slots`;
  dom.wallet.boxMeta.textContent = `${ownedCollection.boxedPokemon.length} boxed across ${ownedCollection.boxes.length} box${ownedCollection.boxes.length === 1 ? '' : 'es'}`;
  dom.wallet.lastMint.textContent = state.wallet.lastMint
    ? `${state.wallet.lastMint.species_name ?? state.wallet.lastMint.species} @ block ${state.wallet.lastMint.minted_at_block} (${formatStorageLocation(state.wallet.lastMint)})`
    : 'None';

  // Indexer-registration queue size → surfaced on the Re-notify button
  // so the user sees at a glance if any of their on-chain mints haven't
  // been acknowledged by the indexer yet (e.g. indexer was down at
  // mint time). Updated on every refreshWalletView pass.
  if (dom.walletResyncIndexer) {
    try {
      const rows = await listPendingCaptures();
      const queuedCount = rows.reduce((s, r) =>
        s + (Array.isArray(r.pending_registrations) ? r.pending_registrations.length : 0), 0);
      if (queuedCount > 0) {
        dom.walletResyncIndexer.textContent = `Re-notify indexer (${queuedCount} queued)`;
        dom.walletResyncIndexer.style.borderColor = 'var(--warn)';
        dom.walletResyncIndexer.style.color = 'var(--warn)';
      } else {
        dom.walletResyncIndexer.textContent = 'Re-notify indexer';
        dom.walletResyncIndexer.style.borderColor = '';
        dom.walletResyncIndexer.style.color = '';
      }
    } catch { /* non-critical; IDB may still be initializing */ }
  }
  dom.walletConnect.disabled = !walletState.available && !walletState.connected;
  dom.walletProbe.disabled = !canProbeWallet();
  dom.walletSignTest.disabled = !walletState.connected || !supportsSignMessage;
  updateMintButtonState(walletState);
  dom.walletSyncPc.disabled = !canSyncPcBoxes();
  renderOwnedPokemon(ownedCollection);
  renderWalletProviderLog();
  await refreshMintQuote();
}

async function syncWalletToPcBoxes() {
  if (!state.module || !state.emulator || !state.speciesCatalog) {
    throw new Error('Boot the ROM before syncing wallet Pokemon into the in-game PC.');
  }

  const extRam = getExtRamBuffer();
  if (!extRam) {
    throw new Error('SRAM is unavailable in the current emulator state.');
  }
  if (!hasValidMainSave(extRam)) {
    throw new Error('Create an in-game save first, then sync wallet Pokemon into the PC.');
  }

  const ownedCollection = await getCurrentOwnedCollection();
  await backupStoredExtRamSnapshotIfMissing(extRam);

  const result = syncOwnedCollectionToPcBoxes(extRam, ownedCollection, state.speciesCatalog, {
    trainerName: DEFAULT_TRAINER_NAME,
  });

  if (!loadExtRamBuffer(result.buffer)) {
    throw new Error('Failed to push wallet boxes back into emulator SRAM.');
  }

  await writeStoredExtRamSnapshot(result.buffer, 'wallet-pc-sync');
  const summary = summarizePcSyncResult(result);

  setPcSyncMessage(summary);
  log(`Wallet -> PC sync complete (${summary})`, 'ok');

  if (!(extRam[CURRENT_BOX_NUM_OFFSET] & CURRENT_BOX_INITIALIZED_FLAG)) {
    log('PC SRAM boxes were initialized for first-time Change Box use.', 'accent');
  }
}

async function loadBundledDevSave() {
  if (!state.manifest || !state.manifestUrl) {
    throw new Error('Boot the ROM once before loading the bundled dev save.');
  }

  const devSave = await fetchBundledDevSave();
  const existingExtRam = getExtRamBuffer();
  if (existingExtRam && hasValidMainSave(existingExtRam)) {
    await backupNamedExtRamSnapshot(existingExtRam, `backup-before-dev-save-${Date.now()}`);
  }

  await writeStoredExtRamSnapshot(devSave, 'bundled-dev-save');
  setPcSyncMessage('Dev save loaded. Rebooting into Continue...');
  log(`Bundled dev save imported into ${formatStorageBackendLabel()} SRAM cache`, 'ok');

  stopEmulator();
  await loadManifestAndBoot(false);
  await refreshWalletView();
  setPcSyncMessage('Dev save ready. Use Continue, then walk to the Pokemon Center PC if needed.');
}

async function switchWalletAdapter(kind) {
  const nextAdapter = state.wallet.registry.setCurrentAdapter(kind);
  if (state.wallet.adapter?.kind !== nextAdapter.kind) {
    state.wallet.lastMint = null;
    state.wallet.providerProbe = null;
    state.wallet.lastSignature = null;
    setMintFlow({
      phase: 'idle',
      message: 'Idle',
      quote: null,
      txid: null,
      inscriptionId: null,
    });
  }
  state.wallet.adapter = nextAdapter;
  log(`Wallet adapter selected: ${nextAdapter.label}`, 'accent');
  setPcSyncMessage('Adapter changed. Sync to the in-game PC when ready.');
  renderWalletProviderLog();
  await refreshWalletView();
}

async function toggleWalletConnection() {
  const walletState = await state.wallet.adapter.getState();
  if (walletState.connected) {
    await withBusy('Disconnecting wallet...', () => state.wallet.adapter.disconnect());
    state.wallet.lastMint = null;
    log(`${walletState.label} disconnected`, 'warn');
  } else {
    const connected = await withBusy(
      'Awaiting wallet connection...',
      () => state.wallet.adapter.connectWallet(),
    );
    log(`${connected.label} connected: ${connected.address ?? 'no address yet'}`, 'ok');
  }
  await refreshWalletView();
}

async function probeWalletProvider() {
  if (typeof state.wallet.adapter.probeProvider !== 'function') {
    throw new Error('The current wallet adapter does not expose provider diagnostics.');
  }

  const probe = await state.wallet.adapter.probeProvider();
  state.wallet.providerProbe = probe;
  renderWalletProviderLog();
  log(
    probe.available
      ? `Wallet provider probe OK: ${probe.providerPath ?? 'unknown path'}`
      : 'Wallet provider probe: extension missing in this context.',
    probe.available ? 'ok' : 'warn',
  );
  await refreshWalletView();
}

async function signWalletTestMessage() {
  if (typeof state.wallet.adapter.signMessage !== 'function') {
    throw new Error('The current wallet adapter does not support signMessage().');
  }

  const message = `PokeBells wallet probe ${new Date().toISOString()}`;
  const signature = await withBusy(
    'Awaiting wallet signature...',
    () => state.wallet.adapter.signMessage(message),
  );
  state.wallet.lastSignature = {
    message,
    signature,
    signedAt: new Date().toISOString(),
  };
  renderWalletProviderLog();
  log('Wallet signature challenge approved.', 'ok');
  await refreshWalletView();
}

function renderMintModalLines(lines) {
  dom.mintModal.lines.innerHTML = lines
    .map(({ key, value, level }) => {
      const className = level ? `modal-line modal-${level}` : 'modal-line';
      return `<div class="${className}"><span class="modal-key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`;
    })
    .join('');
}

function closeMintModal(result) {
  dom.mintModal.root.classList.add('hidden');
  dom.mintModal.confirm.disabled = false;
  if (state.ui.mintResolver) {
    const resolver = state.ui.mintResolver;
    state.ui.mintResolver = null;
    resolver(result);
  }
}

function requestMintConfirmation({ payload, quote, cooldown }) {
  if (state.ui.mintResolver) {
    state.ui.mintResolver(false);
    state.ui.mintResolver = null;
  }

  const lines = [];
  lines.push({
    key: 'Species',
    value: `${payload.species_name ?? `#${payload.species}`} Lv.${payload.level ?? '--'}`,
  });
  lines.push({
    key: 'Catch rate',
    value: String(payload.catch_rate ?? '--'),
  });
  lines.push({
    key: 'Estimated fee',
    value: typeof quote?.networkFeeBel === 'number'
      ? `${quote.networkFeeBel.toFixed(6)} BEL`
      : 'fee pending',
  });
  lines.push({
    key: 'Inscription size',
    value: typeof quote?.inscriptionBytes === 'number'
      ? `${quote.inscriptionBytes} bytes`
      : 'size pending',
  });
  lines.push({
    key: '$POKEBALL (stub)',
    value: cooldown.note,
    level: cooldown.ready ? undefined : 'warn',
  });

  renderMintModalLines(lines);
  dom.mintModal.subtitle.textContent = cooldown.ready
    ? 'Review the cost and confirm to broadcast.'
    : '$POKEBALL cooldown not elapsed yet — confirming will still consume one ball (stub).';
  dom.mintModal.confirm.textContent = cooldown.ready
    ? 'Confirm mint'
    : 'Confirm anyway';
  dom.mintModal.confirm.disabled = false;
  dom.mintModal.root.classList.remove('hidden');
  dom.mintModal.confirm.focus({ preventScroll: true });

  return new Promise((resolve) => {
    state.ui.mintResolver = resolve;
  });
}

function getCaptureHandoffLines(payload, options = {}) {
  const ivsMasked = Boolean(options.ivsMasked);
  const ivs = payload.ivs ?? {};
  const spc = ivs.spc ?? ivs.spd ?? '--';
  const catchPercent = payload.context?.live_catch_percent;
  const catchText = catchPercent === null || catchPercent === undefined
    ? String(payload.catch_rate ?? '--')
    : `${payload.catch_rate ?? '--'} (${catchPercent}% live)`;
  const payloadBytes = new TextEncoder().encode(getCapturePayloadJson(payload)).byteLength;

  // Pre-mint IVs are hidden from the operator so they cannot re-roll by
  // cancelling bad-IV captures. Once the capture is inscribed, IVs are
  // readable from the JSON on-chain (any marketplace / indexer can parse
  // them). True cryptographic hiding requires a commit-reveal schema
  // bump (planned as v1.4, see CRYSTAL-MIGRATION-TODO.md).
  const ivsText = ivsMasked ? 'Hidden (revealed on mint)' : `${ivs.atk ?? '--'}/${ivs.def ?? '--'}/${ivs.spe ?? '--'}/${spc}`;

  return [
    {
      key: 'Species',
      value: `${payload.species_name ?? `#${payload.species_id ?? payload.species}`} Lv.${payload.level ?? '--'}`,
    },
    {
      key: 'IVs',
      value: ivsText,
    },
    {
      key: 'Catch',
      value: catchText,
    },
    {
      key: 'Block',
      value: shortId(payload.block_hash_at_capture),
    },
    {
      key: 'Attestation',
      value: shortId(payload.attestation),
    },
    {
      key: 'Payload',
      value: `${payloadBytes.toLocaleString('en-US')} bytes`,
    },
    {
      key: 'Mint path',
      value: 'Companion -> Nintondo Inscriber',
    },
  ];
}

function renderCaptureHandoffModal(payload) {
  const mandatory = Boolean(state.ui.captureHandoff.mandatory);
  const ivsMasked = Boolean(state.ui.captureHandoff.ivsMasked);

  dom.captureHandoffModal.lines.innerHTML = getCaptureHandoffLines(payload, { ivsMasked })
    .map(({ key, value }) => (
      `<div class="modal-line"><span class="modal-key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`
    ))
    .join('');

  dom.captureHandoffModal.subtitle.textContent = mandatory
    ? 'This is your starter — it must be minted to continue. Copy the JSON and inscribe from the companion.'
    : 'The game is paused. Copy the capture JSON, mint from the companion, then resume when you return.';

  dom.captureHandoffModal.open.textContent = state.ui.captureHandoff.copied
    ? 'Copy JSON + open again'
    : 'Copy JSON + open companion';

  // Mandatory captures (starter) cannot be cancelled; they also cannot be
  // resumed without minting. Hide both side buttons so only "Copy + open
  // companion" is available. Regular captures keep the full button set.
  if (dom.captureHandoffModal.cancel) {
    dom.captureHandoffModal.cancel.classList.toggle('hidden', mandatory);
  }
  if (dom.captureHandoffModal.resume) {
    dom.captureHandoffModal.resume.classList.toggle('hidden', mandatory);
  }
}

function showCaptureHandoff(payload, options = {}) {
  state.ui.captureHandoff.payload = payload;
  state.ui.captureHandoff.copied = false;
  state.ui.captureHandoff.slotIndex = options.slotIndex ?? null;
  state.ui.captureHandoff.mandatory = Boolean(options.mandatory);
  state.ui.captureHandoff.ivsMasked = options.ivsMasked !== false;
  renderCaptureHandoffModal(payload);

  // v1.5: surface "Mint here (direct)" only when window.nintondo.signPsbt
  // is reachable. Without it, we keep the button hidden and let the user
  // fall back to "Copy JSON + open companion" — manual fallback Step 1/
  // Step 2 lands in the next pass for the no-companion / no-wallet
  // edge case.
  if (dom.captureHandoffModal.mintDirect) {
    const cap = detectDirectMintCapability();
    dom.captureHandoffModal.mintDirect.hidden = !cap.canDirectMint;
    dom.captureHandoffModal.mintDirect.disabled = false;
  }
  if (dom.captureHandoffModal.mintStatus) {
    dom.captureHandoffModal.mintStatus.hidden = true;
    dom.captureHandoffModal.mintStatus.textContent = '';
  }

  // Manual fallback panel — populate from the persisted pending row so
  // a re-opened modal resumes at the correct step. Best-effort: if the
  // row isn't found yet (race during the producer write), the user can
  // still copy the commit JSON because the panel reads the row again
  // on click.
  resetManualFallbackPanel(payload?.attestation).catch(() => {});

  dom.captureHandoffModal.root.classList.remove('hidden');
  // Focus the primary action that's currently visible.
  const primaryFocus = (dom.captureHandoffModal.mintDirect && !dom.captureHandoffModal.mintDirect.hidden)
    ? dom.captureHandoffModal.mintDirect
    : dom.captureHandoffModal.open;
  primaryFocus.focus({ preventScroll: true });
  setStatus('emulator', state.ui.captureHandoff.mandatory
    ? 'Paused — starter mint required'
    : 'Paused for mint');
}

function closeCaptureHandoff({ clearPayload = false, silent = false } = {}) {
  dom.captureHandoffModal.root.classList.add('hidden');
  state.ui.captureHandoff.payload = null;
  state.ui.captureHandoff.copied = false;

  if (clearPayload) {
    state.capture.lastPayload = null;
    renderCapturePayload(null);
    setMintFlow({
      phase: 'idle',
      message: 'Mint cancelled',
      quote: null,
      txid: null,
      inscriptionId: null,
    });
    updateMintButtonState();
  }

  if (state.emulator) {
    setStatus('emulator', 'Running');
  }
  if (!silent) {
    log(clearPayload
      ? 'Mint handoff cancelled. The in-game capture remains local, but the JSON payload was cleared.'
      : 'Game resumed. Capture JSON is still available for companion minting.',
    clearPayload ? 'warn' : 'ok');
  }
}

// v1.5 clipboard wrapper for the companion paste flow. Carries both
// the on-chain commit body and the privateReveal preimages so the
// companion (which lives on a different origin from the game in prod
// → can't read game's IDB) can run the full direct-mint pipeline
// without re-deriving anything. The wrapper format is versioned so a
// stale companion can detect mismatch + refuse to mint instead of
// silently misinterpreting fields.
//
// SECURITY NOTE: privateReveal is sensitive (salt + RAM snapshot).
// The clipboard write happens at user-initiated handoff time only —
// the user already chose to send these fields to the companion. The
// browser clipboard is overwritten on the next copy, so the leak
// surface is limited to "until next clipboard write".
function buildCompanionClipboardBundleV15(view) {
  return {
    _pokebells_clipboard_v1: true,    // marker so companion validators recognize the format
    schema_version: '1.5',
    commit_record: null,              // filled below
    private_reveal: null,             // filled below
    preview: {
      species_id: view.species_id ?? null,
      species_name: view.species_name ?? null,
      level: view.level ?? null,
      attestation: view.attestation ?? null,
    },
  };
}

async function openCaptureHandoffCompanion() {
  const payload = state.ui.captureHandoff.payload ?? state.capture.lastPayload;
  if (!payload) {
    throw new Error('No capture payload is ready for companion minting.');
  }
  if (!payload.attestation) {
    throw new Error('Capture payload missing attestation — cannot resolve pendingCaptures row.');
  }

  // Read the v1.5 pending row to assemble the clipboard wrapper.
  // Falls back to the legacy v1.4 payload JSON if no row is found
  // (defensive — shouldn't happen post-v1.5 producer refactor, but
  // keeps the legacy "Copy + open companion" path functional if a
  // user has stale state from a pre-refactor session).
  const pendingRow = await getPendingCapture(payload.attestation).catch(() => null);
  let clipboardText;
  if (pendingRow?.commit_record && pendingRow?.private_reveal) {
    const bundle = buildCompanionClipboardBundleV15(payload);
    bundle.commit_record = pendingRow.commit_record;
    bundle.private_reveal = pendingRow.private_reveal;
    clipboardText = JSON.stringify(bundle, null, 2);
  } else {
    log('No v1.5 pendingCaptures row found — falling back to legacy v1.4 payload copy.', 'warn');
    clipboardText = getCapturePayloadJson(payload);
  }

  const copyPromise = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(clipboardText)
      .then(() => true)
      .catch((error) => {
        log(`Clipboard failed: ${error.message}. Copy the Capture JSON panel manually.`, 'warn');
        return false;
      })
    : Promise.resolve(false).then(() => {
      log('Clipboard is unavailable. Copy the Capture JSON panel manually.', 'warn');
      return false;
    });

  const url = getCompanionUrl({ hash: 'mint-section' });
  const opened = window.open(url, '_blank', 'noopener');
  if (!opened) {
    log(`Popup blocked. Open companion manually: ${url}`, 'warn');
  } else {
    log(`Companion mint opened: ${url}`, 'ok');
  }

  const copied = await copyPromise;
  if (copied) {
    state.ui.captureHandoff.copied = true;
    const kind = pendingRow?.commit_record ? 'v1.5 wrapper (commit + privateReveal)' : 'legacy v1.4 capture JSON';
    log(`${kind} copied. Paste it into the companion mint box.`, 'ok');
  }

  renderCaptureHandoffModal(payload);
  dom.captureHandoffModal.subtitle.textContent = copied
    ? 'JSON copied. Keep this tab paused until you finish or decide to resume.'
    : 'Companion opened, but clipboard failed. Copy the Capture JSON panel manually before minting.';
}

async function handleMintButton() {
  const walletState = await state.wallet.adapter.getState();
  if (walletState.supportsMint && walletState.connected) {
    await mintLastCapture();
    return;
  }

  if (!state.capture.lastPayload) {
    throw new Error('No captured Pokemon is ready to mint yet.');
  }

  showCaptureHandoff(state.capture.lastPayload);
  await openCaptureHandoffCompanion();
}

// ---- Save-snapshot handoff flow (parallels capture handoff) ----
//
// Crystal's in-game "Save" menu writes to SRAM. We detect that via binjgb's
// _emulator_was_ext_ram_updated() (safe to call even though
// _emulator_write_ext_ram OOBs — different API). When the flag goes hot,
// we enable the "Sync save to chain" button and set a pending marker. User
// clicks the button to open the handoff modal, copy the save-snapshot JSON,
// and inscribe via the companion. Load-from-chain (the symmetric restore
// flow) is triggered by the "Restore save from chain" button which appears
// when the indexer has a save matching the connected wallet + ROM.

function getSaveHandoffLines(record) {
  const payloadBytes = new TextEncoder().encode(getCapturePayloadJson(record)).byteLength;
  return [
    { key: 'Wallet',     value: shortId(record.signed_in_wallet ?? '') },
    { key: 'ROM',        value: `${record.game_rom ?? '?'} (${shortId(record.game_rom_sha256 ?? '')})` },
    { key: 'SRAM',       value: `${record.sram_byte_length} bytes, sha ${shortId(record.sram_sha256 ?? '')}` },
    { key: 'Version',    value: `#${record.save_version}` },
    { key: 'Payload',    value: `${payloadBytes.toLocaleString('en-US')} bytes` },
    { key: 'Network',    value: record.capture_network ?? '?' },
    { key: 'Mint path',  value: 'Companion -> Nintondo Inscriber' },
  ];
}

function renderSaveHandoffModal(record) {
  const root = dom.saveHandoffModal;
  if (!root.root) return;
  root.lines.innerHTML = getSaveHandoffLines(record)
    .map(({ key, value }) => (
      `<div class="modal-line"><span class="modal-key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`
    ))
    .join('');
  root.subtitle.textContent = 'Game paused. Copy the save JSON and inscribe from the companion — save is portable across devices that sign in with this wallet.';
  root.open.textContent = state.ui.saveHandoff.copied
    ? 'Copy save JSON + open again'
    : 'Copy save JSON + open companion';
}

function showSaveHandoff(record) {
  state.ui.saveHandoff.record = record;
  state.ui.saveHandoff.copied = false;
  renderSaveHandoffModal(record);
  dom.saveHandoffModal.root.classList.remove('hidden');
  dom.saveHandoffModal.open.focus({ preventScroll: true });
  setStatus('emulator', 'Paused for save sync');
}

function closeSaveHandoff() {
  dom.saveHandoffModal.root.classList.add('hidden');
  state.ui.saveHandoff.record = null;
  state.ui.saveHandoff.copied = false;
  if (state.emulator) setStatus('emulator', 'Running');
}

async function openSaveHandoffCompanion() {
  const record = state.ui.saveHandoff.record;
  if (!record) throw new Error('No save-snapshot record is ready.');
  const json = getCapturePayloadJson(record);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(json);
    }
    state.ui.saveHandoff.copied = true;
    log('Save JSON copied to clipboard. Open companion, paste into the "Save game to chain" section.', 'ok');
  } catch (error) {
    log(`Clipboard failed: ${error.message}. Copy the save JSON manually from the modal.`, 'warn');
  }
  renderSaveHandoffModal(record);
  const base = resolveCompanionBase();
  const url = `${base}#mint`;
  window.open(url, '_blank', 'noopener');

  // Kick off a background poll so the game tab learns when the companion
  // finishes the chain registration. When the indexer reports save_version
  // >= record.save_version, we mark the local save as synced. Caps at 5
  // minutes to avoid forever-polling if the user aborts.
  watchChainSaveAck(record).catch((error) => {
    log(`Save sync poll failed: ${error.message}`, 'warn');
  });
}

async function watchChainSaveAck(record) {
  const walletState = await state.wallet.adapter.getState();
  const wallet = walletState?.address;
  if (!wallet || !state.manifest?.rom?.sha256 || !state.manifest?.network) return;

  const indexerBase = resolveIndexerBaseUrl();
  const url = `${indexerBase.replace(/\/?$/, '/')}api/saves/${encodeURIComponent(wallet)}`
    + `?rom_sha=${state.manifest.rom.sha256}`
    + `&network=${encodeURIComponent(state.manifest.network)}`;

  const started = Date.now();
  while (Date.now() - started < 300_000) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) continue;
      const payload = await r.json().catch(() => null);
      const save = payload?.save;
      if (save && save.save_version >= record.save_version
          && String(save.sram_sha256 ?? '').toLowerCase() === String(record.sram_sha256).toLowerCase()) {
        await markLocalSaveSyncedWithChain({
          chainVersion: save.save_version,
          chainInscriptionId: save.save_inscription_id,
          chainSha256: String(save.sram_sha256).toLowerCase(),
        });
        state.save.lastInscribedVersion = save.save_version;
        state.save.lastInscribedSha256 = String(save.sram_sha256).toLowerCase();
        setSaveStatus(`Save v${save.save_version} confirmed on chain ✓`);
        log(`Save v${save.save_version} registered on chain (${save.save_inscription_id.slice(0, 12)}…).`, 'ok');
        // Reset the "pending sync" highlight on the button.
        if (dom.syncSave) {
          dom.syncSave.classList.remove('highlight');
          dom.syncSave.textContent = 'Sync save to chain';
        }
        state.save.pending = false;
        return;
      }
    } catch { /* transient, keep polling */ }
  }
  setSaveStatus('Save sync poll timed out — check companion Section 4 for details.');
}

function setSaveStatus(text) {
  if (dom.saveStatus) dom.saveStatus.textContent = text ?? '';
}

async function buildAndShowSaveSnapshot() {
  if (!state.gb || !state.emulator) {
    throw new Error('Emulator is not running.');
  }
  const walletState = await state.wallet.adapter.getState();
  const wallet = walletState?.address;
  if (!wallet) {
    throw new Error('Connect a wallet first — the save inscription is keyed to your address.');
  }

  setSaveStatus('Reading SRAM…');
  // Read the full 32 KB SRAM via MBC3 bank-switching. The helper uses the
  // emulator bridge's readByte/writeByte — safe on Crystal (unlike the
  // _emulator_write_ext_ram path that OOBs for MBC3+RTC carts).
  const sramBytes = readSramSnapshot(state.gb.readByte, state.gb.writeByte);

  const nextVersion = (state.save.lastInscribedVersion || 0) + 1;
  const record = await buildSaveSnapshotRecord({
    signedInWallet: wallet,
    captureNetwork: state.manifest?.network,
    gameRom: state.manifest?.rom?.name ?? null,
    gameRomSha256: state.manifest?.rom?.sha256,
    sramBytes,
    saveVersion: nextVersion,
  });
  state.save.lastInscribedSha256 = record.sram_sha256;
  state.save.pending = false;
  setSaveStatus(`Save v${record.save_version} ready to inscribe (${record.sram_byte_length} bytes).`);
  showSaveHandoff(record);
}

async function mintLastCapture() {
  if (!state.capture.lastPayload) {
    throw new Error('No captured Pokemon is ready to mint yet.');
  }

  let quote = state.wallet.mintFlow.quote;
  if (!quote && typeof state.wallet.adapter.quoteMint === 'function') {
    try {
      quote = await state.wallet.adapter.quoteMint(state.capture.lastPayload);
    } catch (error) {
      log(`Mint quote unavailable: ${error.message}`, 'warn');
    }
  }

  const cooldown = await refreshPokeballStatus();
  const confirmed = await requestMintConfirmation({
    payload: state.capture.lastPayload,
    quote,
    cooldown,
  });

  if (!confirmed) {
    log('Mint cancelled from confirmation modal.', 'warn');
    return;
  }

  const minted = await withBusy('Minting capture...', () => state.wallet.adapter.mintPokemon(state.capture.lastPayload, {
    onProgress(event) {
      const message = event.message ?? event.phase ?? 'Pending';
      if (dom.busy.text && state.ui.busy > 0) {
        dom.busy.text.textContent = message;
      }
      setMintFlow({
        phase: event.phase ?? 'pending',
        message,
        quote: event.quote ?? state.wallet.mintFlow.quote,
        txid: event.txid ?? state.wallet.mintFlow.txid,
        inscriptionId: event.inscriptionId ?? state.wallet.mintFlow.inscriptionId,
      });
    },
  }));
  state.wallet.lastMint = minted;
  state.capture.lastPayload = minted;
  renderCapturePayload(minted);
  setMintFlow({
    phase: 'confirmed',
    message: `Confirmed at block ${minted.minted_at_block}`,
    quote: minted.mint_quote ?? state.wallet.mintFlow.quote,
    txid: minted.txid ?? state.wallet.mintFlow.txid,
    inscriptionId: minted.inscription_id ?? state.wallet.mintFlow.inscriptionId,
  });
  log(
    `Mint complete: ${minted.species_name ?? minted.species} -> ${minted.inscription_id}`,
    'ok',
  );
  if (Number.isFinite(minted.minted_at_block) && minted.minted_at_block > 0) {
    recordPokeballMint(minted.minted_at_block);
  }
  setPcSyncMessage('New mint ready. Sync to the in-game PC to refresh BOX 9-12.');
  await refreshWalletView();
  refreshPokeballStatus().catch(() => {});
}

async function resetCurrentWalletAdapter() {
  await state.wallet.adapter.reset();
  state.wallet.lastMint = null;
  state.wallet.providerProbe = null;
  state.wallet.lastSignature = null;
  setMintFlow({
    phase: 'idle',
    message: 'Idle',
    quote: null,
    txid: null,
    inscriptionId: null,
  });
  log(`${state.wallet.adapter.label} reset`, 'warn');
  setPcSyncMessage('Wallet reset. Sync to the in-game PC when ready.');
  renderWalletProviderLog();
  await refreshWalletView();
}

function clearTelemetry() {
  setLiveValue('teamCount', '--');
  setLiveValue('battleStatus', '--');
  setLiveValue('enemyHp', '--');
  setLiveValue('catchRate', '--');
  setLiveValue('catchChance', '--');
  setLiveValue('context', '--');
  dom.battleHud.root.classList.add('hidden');
}

function resetCaptureState() {
  state.capture.prevTeamCount = -1;
  state.capture.captureFrames = 0;
  state.capture.prevBattleMode = 0;
  state.capture.battleEndedFramesAgo = 9999;
  state.capture.lastChance = null;
  state.capture.lastPayload = null;
  state.capture.sessionSequenceNumber = 0;
  state.capture.inFlight = false;
  closeCaptureHandoff({ silent: true });
  renderCapturePayload(null);
  setMintFlow({
    phase: 'idle',
    message: 'Idle',
    quote: null,
    txid: null,
    inscriptionId: null,
  });
  updateMintButtonState();
  setStatus('watch', 'Armed');
}

function stopEmulator() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }
  if (state.module && state.emulator) {
    state.module._emulator_delete(state.emulator);
    state.emulator = 0;
  }
  if (state.module && state.romPtr) {
    state.module._free(state.romPtr);
    state.romPtr = 0;
  }
  if (state.module && state.joypadPtr) {
    state.module._joypad_delete(state.joypadPtr);
    state.joypadPtr = 0;
  }
  state.gb = null;
  state.speciesCatalog = null;
  state.sram.pendingPersist = false;
  state.audio.bufferPtr = 0;
  state.audio.bufferCapacity = 0;
  state.audio.buffer = null;
  window.pokebellsEmulator = null;
  clearTelemetry();
  resetCaptureState();
}

function ensureAudioContext() {
  if (!state.audio.ctx) {
    try {
      state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      log(`Audio ready @ ${state.audio.ctx.sampleRate} Hz`, 'ok');
    } catch (error) {
      log(`Audio unavailable: ${error.message}`, 'warn');
      return null;
    }
  }
  return state.audio.ctx;
}

function getAudioSampleRate() {
  return ensureAudioContext()?.sampleRate ?? 44100;
}

function refreshAudioBinding() {
  if (!state.audio.ctx || !state.module || !state.emulator) {
    return;
  }
  state.audio.bufferPtr = state.module._get_audio_buffer_ptr(state.emulator);
  state.audio.bufferCapacity = state.module._get_audio_buffer_capacity(state.emulator);
  state.audio.buffer = new Uint8Array(
    state.module.HEAPU8.buffer,
    state.audio.bufferPtr,
    state.audio.bufferCapacity,
  );
  state.audio.nextStartSec = Math.max(state.audio.nextStartSec, state.audio.ctx.currentTime + 0.10);
}

function initAudio() {
  if (!state.module || !state.emulator || !ensureAudioContext()) {
    return;
  }
  refreshAudioBinding();
}

function pushAudioBuffer() {
  if (!state.audio.ctx || !state.audio.buffer || state.audio.bufferCapacity < AUDIO_FRAMES * 2) {
    return;
  }

  if (state.audio.ctx.state === 'suspended') {
    state.audio.ctx.resume().catch(() => {});
  }

  try {
    const audioBuffer = state.audio.ctx.createBuffer(2, AUDIO_FRAMES, state.audio.ctx.sampleRate);
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const src = state.audio.buffer;

    for (let index = 0; index < AUDIO_FRAMES; index += 1) {
      left[index] = src[index * 2] / 255;
      right[index] = src[index * 2 + 1] / 255;
    }

    const node = state.audio.ctx.createBufferSource();
    node.buffer = audioBuffer;
    node.connect(state.audio.ctx.destination);

    const now = state.audio.ctx.currentTime;
    if (state.audio.nextStartSec < now + 0.10) {
      state.audio.nextStartSec = now + 0.10;
    }

    node.start(state.audio.nextStartSec);
    state.audio.nextStartSec += audioBuffer.duration;
  } catch {
    // Keep the frame loop moving even if the browser drops audio.
  }
}

function renderFrame() {
  const ptr = state.module._get_frame_buffer_ptr(state.emulator);
  const size = state.module._get_frame_buffer_size(state.emulator);
  state.imageData.data.set(new Uint8ClampedArray(state.module.HEAPU8.buffer, ptr, size));
  ctx2d.putImageData(state.imageData, 0, 0);
}

// ---- Player nametag overlay (for upcoming MMO/BNS integration) ----
//
// Source of truth for the displayed name, highest priority wins:
//   1. window.pokebellsSetNickname(name) at runtime (exposed for companion
//      hooks — e.g. BNS lookup once the wallet is connected).
//   2. URL param ?pseudo=<name>.
//   3. localStorage 'pokebells:nickname'.
//   4. ROM's wPlayerName (Crystal charmap decoded).
//   5. Fallback "TRAINER".
//
// Crystal charmap: ASCII-like with offsets — 0x80-0x99 = A-Z,
// 0xA0-0xB9 = a-z, 0xF6-0xFF = 0-9, 0x7F = space, 0x50 = terminator.

const WRAM_PLAYER_NAME_ADDR = 0xd47d;
const WRAM_PLAYER_NAME_LENGTH = 11;
const WRAM_BATTLE_MODE_ADDR = 0xd22d;
const WRAM_MAP_GROUP_ADDR = 0xdcb5;

function decodeCrystalName(bytes) {
  let out = '';
  for (const raw of bytes) {
    const b = raw & 0xff;
    if (b === 0x50 || b === 0x00) break; // terminator
    if (b === 0x7f) { out += ' '; continue; }
    if (b >= 0x80 && b <= 0x99) { out += String.fromCharCode(0x41 + (b - 0x80)); continue; } // A-Z
    if (b >= 0xa0 && b <= 0xb9) { out += String.fromCharCode(0x61 + (b - 0xa0)); continue; } // a-z
    if (b >= 0xf6 && b <= 0xff) { out += String.fromCharCode(0x30 + (b - 0xf6)); continue; } // 0-9
    if (b === 0xe8) { out += '.'; continue; }
    if (b === 0xf4) { out += ','; continue; }
    if (b === 0xe0) { out += "'"; continue; }
  }
  return out.trim();
}

const nametagState = {
  runtimeOverride: null,
  urlOverride: null,
  storedOverride: null,
  lastRom: '',
  fallback: 'TRAINER',
};

// Nametag sanitizer. Runs on every source (URL, localStorage, runtime setter,
// ROM decode) so a malicious BNS inscription with invisible / bidi / RTL
// override characters can't spoof another user's nickname. Also clips to a
// safe grapheme count (not UTF-16 code units) so emoji + combining marks
// don't split into garbage. Applied everywhere — never trust the raw string.
const NAMETAG_MAX_GRAPHEMES = 16;
const NAMETAG_DANGEROUS_CODEPOINTS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\uFFFE\uFFFF]/g;
let nametagSegmenter = null;
try {
  nametagSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
} catch {
  nametagSegmenter = null;
}

function sanitizeDisplayName(raw, { maxGraphemes = NAMETAG_MAX_GRAPHEMES } = {}) {
  if (typeof raw !== 'string') return '';
  // 1. Normalize so visually-equivalent forms collapse (NFC).
  let s;
  try { s = raw.normalize('NFC'); } catch { s = raw; }
  // 2. Strip controls, bidi overrides, zero-width, BOM / non-character codepoints.
  s = s.replace(NAMETAG_DANGEROUS_CODEPOINTS, '');
  // 3. Trim leading/trailing whitespace.
  s = s.trim();
  // 4. Clip at grapheme-cluster boundary (emoji stay intact, Zalgo clipped).
  if (nametagSegmenter) {
    const graphemes = [...nametagSegmenter.segment(s)].map((g) => g.segment);
    s = graphemes.slice(0, maxGraphemes).join('');
  } else {
    // Fallback for runtimes without Intl.Segmenter: slice codepoints, still
    // safer than raw UTF-16 code-unit slicing (won't split surrogate pairs).
    s = [...s].slice(0, maxGraphemes).join('');
  }
  return s;
}

try {
  const params = new URLSearchParams(window.location.search);
  nametagState.urlOverride = sanitizeDisplayName(params.get('pseudo') || '') || null;
} catch { /* no URL context — ignore */ }
try {
  nametagState.storedOverride = sanitizeDisplayName(
    window.localStorage?.getItem('pokebells:nickname') || '',
  ) || null;
} catch { /* storage may be blocked */ }

function resolveNametag() {
  const raw = nametagState.runtimeOverride
    || nametagState.urlOverride
    || nametagState.storedOverride
    || nametagState.lastRom
    || nametagState.fallback;
  return sanitizeDisplayName(raw) || nametagState.fallback;
}

// ============================================================================
// Schema v1.5 capture-to-mint state machine — uses pending-captures.mjs
// ============================================================================
// State machine constants + helpers come from window.PokeBellsPendingCaptures
// (set by game/pending-captures.mjs which boot.js loads ahead of shell.js).
// Pure JS, tested in game/pending-captures.test.mjs. Six invariants
// enforced there: see SHELL-V1.5-PIPELINE.md.

const pendingCapturesTools = (typeof window !== 'undefined'
  && window.PokeBellsPendingCaptures)
  ?? (() => { throw new Error('PokeBellsPendingCaptures missing — boot.js must load pending-captures.mjs before shell.js'); })();

const {
  PENDING_CAPTURE_STATUSES,
  PENDING_CAPTURE_TERMINAL,
  PENDING_CAPTURE_MINT_LOCKED,
  PENDING_CAPTURE_TRANSITIONS,
  isValidPendingStatus,
  isAllowedPendingTransition,
  assertPendingTransition,
  makePendingCaptureRow,
  cancelAllowed,
  detectCommitRecoveryState,
  detectMintRecoveryState,
} = pendingCapturesTools;

// Queue helpers — pure IDB updates, never throw on indexer failures.

async function enqueueIndexerRegistration(attestation, kind) {
  if (kind !== 'commit' && kind !== 'mint') {
    throw new Error(`enqueueIndexerRegistration: unknown kind "${kind}"`);
  }
  const row = await getPendingCapture(attestation);
  if (!row) return null;
  const queue = Array.isArray(row.pending_registrations) ? row.pending_registrations : [];
  if (queue.includes(kind)) return row;
  const next = {
    ...row,
    pending_registrations: [...queue, kind],
    updated_at: new Date().toISOString(),
  };
  await persistPendingCapture(next);
  return next;
}

async function dequeueIndexerRegistration(attestation, kind) {
  const row = await getPendingCapture(attestation);
  if (!row) return null;
  const queue = Array.isArray(row.pending_registrations) ? row.pending_registrations : [];
  if (!queue.includes(kind)) return row;
  const next = {
    ...row,
    pending_registrations: queue.filter((k) => k !== kind),
    updated_at: new Date().toISOString(),
  };
  await persistPendingCapture(next);
  return next;
}

// Best-effort indexer notify. Returns true if 2xx response, false on
// any failure. Failure path appends 'commit'/'mint' to the row's
// pending_registrations queue so a future retry can drain it without
// blocking the user.
async function notifyIndexerOfInscription({ attestation, kind, inscriptionId, network }) {
  const indexerBase = indexerBaseFor(network);
  const path = kind === 'mint' ? '/api/mints' : '/api/captures';
  try {
    const r = await fetch(`${indexerBase}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inscription_id: inscriptionId, network }),
    });
    if (!r.ok) {
      await enqueueIndexerRegistration(attestation, kind);
      return false;
    }
    await dequeueIndexerRegistration(attestation, kind);
    return true;
  } catch {
    await enqueueIndexerRegistration(attestation, kind);
    return false;
  }
}

async function persistPendingCapture(row) {
  const db = await openDb();
  await dbPut(db, 'pendingCaptures', row);
}

async function getPendingCapture(attestation) {
  if (!attestation) return null;
  const db = await openDb();
  return dbGet(db, 'pendingCaptures', String(attestation).toLowerCase());
}

async function listPendingCaptures() {
  const db = await openDb();
  return dbGetAll(db, 'pendingCaptures');
}

// Enforced state transition. Throws on illegal moves so a buggy caller
// can't silently land in an impossible state. The `partial` callback
// receives a clone of the existing row and may mutate any non-status
// fields (txids, last_error, retry_count, etc.) before the new status
// is stamped on. Pure transition logic delegated to the canonical
// pending-captures.mjs (assertPendingTransition); this wrapper is the
// IDB-side effect — read existing, validate transition, persist next.
async function transitionPendingCapture(attestation, nextStatus, partial = null) {
  const existing = await getPendingCapture(attestation);
  if (!existing) {
    throw new Error(`no pendingCaptures row for attestation ${attestation}`);
  }
  const next = assertPendingTransition(existing, nextStatus, partial);
  await persistPendingCapture(next);
  return next;
}

// Patch fields on a pendingCapture row WITHOUT changing status. Used
// during runDirectMintFlow to persist intermediate artifacts (fund_txid
// after fund broadcast succeeds, reveal_txid after reveal broadcast
// succeeds, last_error during recoverable failures) so a tab refresh
// or process kill never loses track of an in-flight broadcast.
//
// Status changes still go through transitionPendingCapture(); patches
// are for intermediate book-keeping only.
async function patchPendingCapture(attestation, partial) {
  const existing = await getPendingCapture(attestation);
  if (!existing) {
    throw new Error(`no pendingCaptures row for attestation ${attestation}`);
  }
  const next = {
    ...existing,
    ...(partial ?? {}),
    updated_at: new Date().toISOString(),
  };
  await persistPendingCapture(next);
  return next;
}

// Cancel helper enforces cancel-matrix invariant 4: from mint_broadcast +
// mint_confirmed states, cancel is forbidden. Caller must also release
// the in-game Pokémon (universal rule from SHELL-V1.5-PIPELINE.md cancel
// matrix) — that part is wired in the modal handler, not here, because
// the state machine doesn't know about the emulator.
async function cancelPendingCapture(attestation) {
  const existing = await getPendingCapture(attestation);
  if (!existing) return null;
  if (PENDING_CAPTURE_MINT_LOCKED.has(existing.status)) {
    throw new Error(
      `cancel forbidden in status "${existing.status}" — mint already broadcasting/confirmed`,
    );
  }
  return transitionPendingCapture(attestation, 'cancelled');
}

// ---- Reveal builder API (exposed for devtools + companion consumers) ----
//
// Captures at schema 1.4 commit to IVs but don't publish them. To complete
// the mint cycle the owner inscribes a matching op:"reveal" record. The
// preimage (ivs + salt + ram_snapshot) lives in the game tab's IndexedDB
// keyed by capture attestation. These helpers read from that store and
// produce a reveal JSON ready for the Nintondo Inscriber.
//
// Usage from devtools console (when companion or user has the capture
// inscription id from Nintondo):
//
//   const list = await window.pokebellsListPendingReveals();
//   // pick one, then:
//   const revealJson = await window.pokebellsBuildReveal(
//     '<attestation_hex_from_capture>',
//     '<capture_inscription_id_from_nintondo>'
//   );
//   // copy-paste revealJson into the Nintondo Inscriber, inscribe as .txt,
//   // then POST /api/reveals to our indexer so IVs/EVs land on the capture.

window.pokebellsListPendingReveals = async () => {
  try {
    const db = await openDb();
    if (isMemoryDb(db)) return [];
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('captureReveals', 'readonly').objectStore('captureReveals').getAll();
      tx.onsuccess = () => {
        const rows = (tx.result ?? []).map((r) => ({
          attestation: r.attestation,
          wallet: r.wallet,
          species_id: r.capture_record?.species_id ?? null,
          species_name: r.capture_record?.species_name ?? null,
          level: r.capture_record?.level ?? null,
          capture_inscription_id: r.capture_inscription_id ?? null,
          reveal_inscription_id: r.reveal_inscription_id ?? null,
          needs_reveal: !r.reveal_inscription_id,
          created_at: r.created_at,
        }));
        resolve(rows);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('[pokebells] listPendingReveals failed:', error);
    return [];
  }
};

window.pokebellsBuildReveal = async (captureAttestation, captureInscriptionId) => {
  if (!/^[0-9a-f]{64}$/i.test(captureAttestation ?? '')) {
    throw new Error('captureAttestation must be 64-char hex');
  }
  if (!/^[0-9a-f]{64}i\d+$/i.test(captureInscriptionId ?? '')) {
    throw new Error('captureInscriptionId must look like <64hex>i<N>');
  }
  const db = await openDb();
  const row = await dbGet(db, 'captureReveals', captureAttestation.toLowerCase());
  if (!row) {
    throw new Error(`no pending reveal for attestation ${captureAttestation}. Was this capture made in this browser?`);
  }
  const reveal = buildRevealRecord({
    captureRecord: row.capture_record,
    captureInscriptionId,
    privateReveal: row.private_reveal,
  });
  // Link back for UX: mark the stored row with the capture inscription id so
  // later lookups (e.g. "pending reveals") can tell which captures still
  // need a reveal inscribed.
  try {
    await dbPut(db, 'captureReveals', {
      ...row,
      capture_inscription_id: captureInscriptionId,
    });
  } catch { /* non-fatal */ }
  return `${JSON.stringify(reveal, null, 2)}\n`;
};

window.pokebellsMarkRevealInscribed = async (captureAttestation, revealInscriptionId) => {
  const db = await openDb();
  const row = await dbGet(db, 'captureReveals', captureAttestation.toLowerCase());
  if (!row) throw new Error('no stored reveal for that attestation');
  await dbPut(db, 'captureReveals', {
    ...row,
    reveal_inscription_id: revealInscriptionId,
  });
  return true;
};

window.pokebellsSetNickname = (name) => {
  const clean = sanitizeDisplayName(name || '');
  nametagState.runtimeOverride = clean || null;
  try {
    if (nametagState.runtimeOverride) {
      window.localStorage.setItem('pokebells:nickname', nametagState.runtimeOverride);
      nametagState.storedOverride = nametagState.runtimeOverride;
    }
  } catch { /* ignore */ }
  if (dom.playerNametag) dom.playerNametag.textContent = resolveNametag();
};

function updatePlayerNametag() {
  if (!dom.playerNametag || !state.gb) return;

  const { mapGroup, battleMode, nameBytes } = withWramBank1(() => {
    const nb = new Uint8Array(WRAM_PLAYER_NAME_LENGTH);
    for (let i = 0; i < WRAM_PLAYER_NAME_LENGTH; i += 1) {
      nb[i] = state.gb.readByte(WRAM_PLAYER_NAME_ADDR + i);
    }
    return {
      mapGroup: state.gb.readByte(WRAM_MAP_GROUP_ADDR),
      battleMode: state.gb.readByte(WRAM_BATTLE_MODE_ADDR),
      nameBytes: nb,
    };
  });

  const decoded = decodeCrystalName(nameBytes);
  const safeDecoded = sanitizeDisplayName(decoded);
  if (safeDecoded && safeDecoded !== nametagState.lastRom) {
    nametagState.lastRom = safeDecoded;
  }

  const inOverworld = mapGroup > 0 && battleMode === 0;
  if (inOverworld) {
    dom.playerNametag.textContent = resolveNametag();
    dom.playerNametag.classList.remove('hidden');
  } else {
    dom.playerNametag.classList.add('hidden');
  }
}

// Run `fn` with SVBK (0xFF70) forced to bank 1. Crystal switches WRAMX banks
// during audio ticks and other subsystems, so a blind read of 0xD000..0xDFFF
// may return bytes from a non-party bank (e.g. audio state on bank 2). All
// wEnemyMon* / wParty* / wMap* addresses live in WRAM1, so forcing bank 1
// makes every HUD/telemetry read deterministic. SVBK is restored after the
// call so the emulator continues its normal bank schedule on the next tick.
function withWramBank1(fn) {
  if (!state.gb) return undefined;
  const SVBK = 0xff70;
  const prev = state.gb.readByte(SVBK) & 0xff;
  const effectivePrev = Math.max(1, prev & 0x07);
  if (effectivePrev !== 1) {
    state.gb.writeByte(SVBK, (prev & ~0x07) | 0x01);
  }
  try {
    return fn();
  } finally {
    if (effectivePrev !== 1) {
      state.gb.writeByte(SVBK, prev);
    }
  }
}

function updateTelemetry() {
  if (!state.gb) {
    return;
  }

  const snapshot = withWramBank1(() => ({
    teamCount: state.gb.readByte(RAM_ADDRS.teamCount),
    battleMode: state.gb.readByte(RAM_ADDRS.battleStatus),
    enemyMonStatusByte: state.gb.readByte(RAM_ADDRS.enemyMonStatus),
    // Gen 2 HP is a 16-bit big-endian word (boss mons exceed 255 HP).
    enemyHpCurrent: state.gb.readWord(RAM_ADDRS.enemyHpCurrent),
    enemyHpMax: state.gb.readWord(RAM_ADDRS.enemyHpMax),
    enemyCatchRate: state.gb.readByte(RAM_ADDRS.enemyCatchRate),
    mapId: state.gb.readByte(RAM_ADDRS.mapId),
    hallOfFameFlags: state.gb.readByte(RAM_ADDRS.hallOfFameFlags),
  }));
  const teamCount = snapshot.teamCount;
  const battleStatusRaw = snapshot.enemyMonStatusByte; // display uses enemy status flags
  const battleMode = snapshot.battleMode;
  const enemyHpCurrent = snapshot.enemyHpCurrent;
  const enemyHpMax = snapshot.enemyHpMax;
  const enemyCatchRate = snapshot.enemyCatchRate;
  const mapId = snapshot.mapId;
  const hallOfFameFlags = snapshot.hallOfFameFlags;
  const inferredStatus = statusNameFromByte(battleStatusRaw);
  const catchChance = computeCatchChance({
    catchRate: enemyCatchRate,
    currentHp: enemyHpCurrent,
    maxHp: enemyHpMax,
    status: inferredStatus,
    ballBonus: 1,
  });

  state.capture.lastChance = catchChance;

  setLiveValue('teamCount', `${teamCount}\n${byteToHex(teamCount)}`);
  setLiveValue('battleStatus', `${byteToHex(battleStatusRaw)}\n${inferredStatus}`);
  setLiveValue('enemyHp', `${enemyHpCurrent} / ${enemyHpMax}`);
  setLiveValue('catchRate', `${enemyCatchRate}\n${byteToHex(enemyCatchRate)}`);

  if (catchChance === null) {
    setLiveValue('catchChance', '--');
  } else {
    const percent = catchChancePercent(catchChance);
    setLiveValue('catchChance', `${percent.toFixed(1)}%\n${catchChance.toFixed(2)} / 255`);
  }

  setLiveValue(
    'context',
    `map ${byteToHex(mapId)}\nHoF ${byteToHex(hallOfFameFlags)}\nteamBase ${wordToHex(RAM_ADDRS.teamSlotBase)}`,
  );

  // "In battle" per Crystal convention: wBattleMode != 0 (1=wild, 2=trainer).
  // Fallback to HP>0 heuristic for safety in case wBattleMode read is stale.
  const inBattle = battleMode > 0 && enemyHpMax > 0 && enemyCatchRate > 0;
  if (inBattle) {
    const enemyInternalId = withWramBank1(() => state.gb.readByte(RAM_ADDRS.enemySpecies));
    const speciesInfo = state.speciesCatalog
      ? getSpeciesByInternalId(state.speciesCatalog, enemyInternalId)
      : null;

    const hpPct = Math.min(100, Math.max(0, (enemyHpCurrent / enemyHpMax) * 100));
    const hpClass = hpPct > 50 ? '' : hpPct > 20 ? 'hp-yellow' : 'hp-red';

    dom.battleHud.root.classList.remove('hidden');
    dom.battleHud.species.textContent = speciesInfo?.name ?? `#${enemyInternalId}`;
    dom.battleHud.hpFill.style.width = `${hpPct.toFixed(1)}%`;
    dom.battleHud.hpFill.className = `hud-hp-fill${hpClass ? ` ${hpClass}` : ''}`;
    dom.battleHud.hpText.textContent = `${enemyHpCurrent}/${enemyHpMax}`;
    dom.battleHud.status.textContent = inferredStatus !== 'none' ? inferredStatus.toUpperCase() : '';

    if (catchChance === null) {
      dom.battleHud.catchPct.textContent = '--%';
      dom.battleHud.catchPct.style.color = '';
    } else {
      const pct = catchChancePercent(catchChance);
      dom.battleHud.catchPct.textContent = `${pct.toFixed(1)}%`;
      dom.battleHud.catchPct.style.color =
        pct >= 50 ? '#72d572' : pct >= 20 ? '#e3b55d' : '#ff7a7a';
    }
  } else {
    dom.battleHud.root.classList.add('hidden');
  }
}

async function resolveCaptureWalletAddress() {
  if (state.signin.request) {
    const signinSession = await ensureVerifiedSigninSession();
    if (signinSession?.wallet) {
      return signinSession.wallet;
    }
  }

  const walletState = await state.wallet.adapter.getState();
  return walletState?.address ?? null;
}

async function onPokemonCaught(slotIndex, options = {}) {
  if (state.capture.inFlight) {
    return;
  }
  const mandatory = Boolean(options.mandatory);

  state.capture.inFlight = true;
  setStatus('watch', mandatory
    ? `Attesting starter slot ${slotIndex}`
    : `Attesting slot ${slotIndex}`);

  try {
    const signedInWallet = await resolveCaptureWalletAddress();
    if (!signedInWallet) {
      throw new Error('Capture attestation requires a signed-in or connected wallet address.');
    }

    const sessionSequenceNumber = state.capture.sessionSequenceNumber + 1;

    // v1.5 capture producer (replaces v1.4 buildCaptureProvenance +
    // buildCapturedPokemonRecord). The commit body is opaque (no
    // species/level), the IVs+EVs+RAM stay in privateReveal until
    // op:"mint" is published. Per SHELL-V1.5-PIPELINE.md invariants:
    //   - 1: only op:"mint" makes a Pokémon canonical
    //   - 2: this capture is "pending_commit" — not yet a Pokémon NFT
    const romSha256 = state.manifest?.rom?.sha256;
    if (typeof romSha256 !== 'string' || romSha256.length !== 64) {
      throw new Error('manifest.rom.sha256 missing — cannot build v1.5 capture_commit');
    }
    const { commitRecord, privateReveal } = await buildCaptureCommitRecord(
      state.gb.readByte,
      {
        network: state.manifest?.network,
        signedInWallet,
        sessionSequenceNumber,
        partySlotIndex: slotIndex,
        writeByte: state.gb.writeByte,
        romSha256,
      },
    );

    // Standalone validation of the commit (recompute attestation, schema
    // shape, etc.). Runs on the same canonical validator the indexer
    // uses post-deploy.
    const commitValidation = await validateCaptureCommitRecord(commitRecord);
    if (!commitValidation.ok) {
      throw new Error(`commit invalid: ${commitValidation.error}`);
    }

    // Re-derive a few fields from the freshly-captured snapshot for the
    // modal preview. None of these are inscribed — only species_id /
    // level / IVs in the eventual mint inscription are canonical, and
    // those go through buildPokemonMintRecord (which itself parses the
    // snapshot, never trusts caller-supplied values).
    const ramBytes = decodeBase64(privateReveal.ram_snapshot_base64);
    const slot = parsePartySlotFromSnapshot(ramBytes, slotIndex);
    const speciesInfo = getSpeciesByInternalId(state.speciesCatalog, slot.internalSpeciesId);
    const previewSpeciesName = speciesInfo?.name ?? `Species ${slot.internalSpeciesId}`;

    // The "view" object substitutes for the legacy v1.4 capture payload
    // in the modal renderer + capture-card UI. Field shape matches what
    // renderCaptureHandoffModal / renderCapturePayload already read so
    // we don't have to refactor every consumer at once. NOT inscribed.
    const view = {
      schema_version: '1.5',
      op: 'capture_commit',
      // v1.5 commit identity (these are real fields on the commit body):
      attestation: commitRecord.attestation,
      attestation_scheme: commitRecord.attestation_scheme,
      block_hash_at_capture: commitRecord.block_hash_at_capture,
      signed_in_wallet: commitRecord.signed_in_wallet,
      capture_network: commitRecord.capture_network,
      session_sequence_number: commitRecord.session_sequence_number,
      ivs_commitment: commitRecord.ivs_commitment,
      ram_snapshot_hash: commitRecord.ram_snapshot_hash,
      svbk_at_capture: commitRecord.svbk_at_capture,
      party_slot_index: slotIndex,
      // Preview-only fields (never inscribed; UI display only):
      species_id: speciesInfo?.dexNo ?? slot.internalSpeciesId,
      species_name: previewSpeciesName,
      level: slot.level,
      catch_rate: speciesInfo?.catchRate ?? null,
      // For wallet-adapter quote/mint button compat (v1.4 path is the
      // legacy "Copy + open companion" route; new direct mint path uses
      // the pendingCaptures row instead):
      inscription_id: null,
      context: {
        slot_index: slotIndex,
        slot_base: wordToHex(RAM_ADDRS.teamSlotBase + ((slotIndex - 1) * RAM_ADDRS.teamSlotSize)),
        live_enemy_catch_rate: state.gb.readByte(RAM_ADDRS.enemyCatchRate),
        live_catch_chance: state.capture.lastChance === null
          ? null
          : Number(state.capture.lastChance.toFixed(4)),
        live_catch_percent: state.capture.lastChance === null
          ? null
          : Number(catchChancePercent(state.capture.lastChance).toFixed(2)),
      },
    };

    state.capture.sessionSequenceNumber = sessionSequenceNumber;
    state.capture.lastPayload = view;

    // Persist the v1.5 pending capture row (state machine entry point).
    // shell.js boot-time resume will re-surface this in the "Pending
    // mints" panel if the user closes the tab before completing mint.
    try {
      const pendingRow = makePendingCaptureRow({
        commitRecord,
        privateReveal,
        partySlotIndex: slotIndex,
        signedInWallet,
        network: commitRecord.capture_network,
        previewSpeciesName,
        previewLevel: slot.level,
      });
      await persistPendingCapture(pendingRow);
    } catch (error) {
      log(`Failed to persist pending capture: ${error.message}`, 'warn');
    }

    renderCapturePayload(view);
    updateMintButtonState();
    refreshMintQuote().catch((error) => {
      log(error.message, 'bad');
    });
    persistCurrentExtRam('capture-handoff').catch((error) => {
      log(`SRAM persist before mint handoff failed: ${error.message}`, 'warn');
    });
    showCaptureHandoff(view, { slotIndex, mandatory, ivsMasked: true });

    log(
      `Capture (v1.5): slot ${slotIndex} ${previewSpeciesName} Lv${slot.level} → pending_commit, attestation ${view.attestation.slice(0, 12)}...`,
      'capture',
    );
    setStatus('watch', `Captured slot ${slotIndex}`);
  } catch (error) {
    state.capture.lastPayload = null;
    renderCapturePayload(null);
    updateMintButtonState();
    log(`Capture rejected: ${error.message}`, 'bad');
    setStatus('watch', 'Capture invalid');
  } finally {
    state.capture.inFlight = false;
  }
}

// Grace window (in rafCallback ticks) during which a party-count bump is
// accepted as a real capture. Crystal fades from battle (wBattleMode != 0)
// to the overworld (wBattleMode = 0) over ~30-40 frames; the actual
// wPartyCount += 1 happens slightly after that. 120 frames = 2s at 60 FPS,
// generous enough that we won't miss a capture but tight enough that
// receiving the starter from Elm later (wBattleMode stays 0 the whole
// time) does NOT count.
const CAPTURE_BATTLE_GRACE_FRAMES = 120;

function watchMemory() {
  if (!state.gb) {
    return;
  }

  const [teamCount, battleMode] = withWramBank1(() => [
    state.gb.readByte(RAM_ADDRS.teamCount),
    state.gb.readByte(RAM_ADDRS.battleStatus),
  ]);

  // Track the battle→overworld transition so we can distinguish a "caught a
  // wild mon" party bump from a "received a starter / mystery gift" bump.
  if (state.capture.prevBattleMode > 0 && battleMode === 0) {
    state.capture.battleEndedFramesAgo = 0;
  } else if (state.capture.battleEndedFramesAgo < 1_000_000) {
    state.capture.battleEndedFramesAgo += 1;
  }
  state.capture.prevBattleMode = battleMode;

  if (state.capture.prevTeamCount < 0) {
    state.capture.prevTeamCount = teamCount;
    setStatus('watch', `Watching @ ${teamCount}`);
    return;
  }

  const justLeftBattle = state.capture.battleEndedFramesAgo <= CAPTURE_BATTLE_GRACE_FRAMES;
  const isStarterGift = state.capture.prevTeamCount === 0 && teamCount === 1 && !justLeftBattle;

  if (teamCount > state.capture.prevTeamCount && battleMode === 0 && justLeftBattle) {
    state.capture.captureFrames += 1;
    setStatus('watch', `Pending ${state.capture.captureFrames}/${CAPTURE_FRAMES_REQUIRED}`);
    if (state.capture.captureFrames >= CAPTURE_FRAMES_REQUIRED) {
      void onPokemonCaught(teamCount, { mandatory: false });
      state.capture.prevTeamCount = teamCount;
      state.capture.captureFrames = 0;
    }
    return;
  }

  if (isStarterGift && battleMode === 0) {
    // First Pokemon ever (team 0→1) received outside a battle = Elm's
    // starter. Mandatory mint, no cancel path. Reuses the capture pipeline
    // so the attestation + JSON output is identical in shape.
    state.capture.captureFrames += 1;
    setStatus('watch', `Starter received — mandatory mint ${state.capture.captureFrames}/${CAPTURE_FRAMES_REQUIRED}`);
    if (state.capture.captureFrames >= CAPTURE_FRAMES_REQUIRED) {
      void onPokemonCaught(teamCount, { mandatory: true });
      state.capture.prevTeamCount = teamCount;
      state.capture.captureFrames = 0;
    }
    return;
  }

  if (teamCount > state.capture.prevTeamCount && !justLeftBattle) {
    // Party bumped outside the post-battle grace window AND not a starter
    // (e.g., trade, egg hatch, mystery gift). Adopt silently to avoid a
    // false-positive capture popup and endless retry.
    state.capture.prevTeamCount = teamCount;
    state.capture.captureFrames = 0;
    setStatus('watch', `Party changed (gift/trade) @ ${teamCount}`);
    return;
  }

  if (teamCount < state.capture.prevTeamCount) {
    state.capture.prevTeamCount = teamCount;
    state.capture.captureFrames = 0;
    setStatus('watch', `Resynced @ ${teamCount}`);
    return;
  }

  state.capture.captureFrames = 0;
  setStatus('watch', `Watching @ ${teamCount}`);
}

function rafCallback(nowMs) {
  state.rafId = requestAnimationFrame(rafCallback);

  const nowSec = nowMs / 1000;
  if (isGameplayPaused()) {
    state.lastRafSec = nowSec;
    return;
  }

  const deltaSec = Math.min(state.lastRafSec ? nowSec - state.lastRafSec : 1 / 60, 5 / 60);
  state.lastRafSec = nowSec;

  const deltaTicks = deltaSec * CPU_TICKS_PER_SECOND;
  const targetTicks = state.module._emulator_get_ticks_f64(state.emulator) + deltaTicks - state.leftoverTicks;

  let newFrame = false;
  for (let iterations = 0; iterations < 16; iterations += 1) {
    const eventMask = state.module._emulator_run_until_f64(state.emulator, targetTicks);
    if (eventMask & EVENT_NEW_FRAME) {
      newFrame = true;
    }
    if (eventMask & EVENT_AUDIO_BUFFER_FULL) {
      initAudio();
      pushAudioBuffer();
    }
    if (eventMask & EVENT_UNTIL_TICKS) {
      break;
    }
  }

  if (newFrame) {
    renderFrame();
    updateTelemetry();
    watchMemory();
    updatePlayerNametag();
  }

  // _was_ext_ram_updated is safe to call on any cart (it's a read-only
  // flag query). Writes persist locally via readSramSafe (Crystal uses
  // bank-switch reader that bypasses binjgb's broken write_ext_ram path).
  const extRamUpdated = state.module._emulator_was_ext_ram_updated(state.emulator);
  if (extRamUpdated) {
    state.sram.pendingPersist = true;
  }

  if (state.sram.pendingPersist && (nowMs - state.sram.lastPersistMs) > SRAM_PERSIST_DEBOUNCE_MS) {
    state.sram.pendingPersist = false;
    persistCurrentExtRam('emulator-save').catch((error) => {
      setPcSyncMessage(`SRAM persist failed: ${error.message}`);
      log(error.message, 'bad');
    });
  }

  // On Crystal, the same detector also lights up the "Sync save to chain"
  // button so the user knows there's a new save worth inscribing. Local
  // IDB persist happened above — on-chain inscribe stays explicit.
  if (isCrystalRom() && extRamUpdated && !state.save.pending) {
    state.save.pending = true;
    setSaveStatus('Save detected — local save stored. Click "Sync save to chain" to push it on-chain.');
    if (dom.syncSave) {
      dom.syncSave.classList.add('highlight');
      dom.syncSave.textContent = 'Sync save to chain ●';
    }
  }

  state.leftoverTicks = (state.module._emulator_get_ticks_f64(state.emulator) - targetTicks) | 0;
}

async function bootEmulator(manifest, manifestUrl, romBuffer) {
  await ensureRuntime(manifest, manifestUrl);
  if (state.module && state.emulator) {
    await persistCurrentExtRam('before-reload');
  }
  stopEmulator();

  const alignedSize = (romBuffer.byteLength + 0x7fff) & ~0x7fff;
  state.romPtr = state.module._malloc(alignedSize);
  const heap = new Uint8Array(state.module.HEAPU8.buffer, state.romPtr, alignedSize);
  heap.fill(0);
  heap.set(new Uint8Array(romBuffer));

  state.emulator = state.module._emulator_new_simple(state.romPtr, alignedSize, getAudioSampleRate(), AUDIO_FRAMES, 0);
  if (!state.emulator) {
    throw new Error('emulator_new_simple failed');
  }

  // Gen 2 species catalog is baked into gen2-species.mjs at generator time,
  // not parsed from the ROM buffer like the Gen 1 module did. The ROM is still
  // required to boot the emulator, but catalog construction is buffer-free.
  state.speciesCatalog = getGen2SpeciesCatalog();
  state.joypadPtr = state.module._joypad_new();
  state.module._emulator_set_default_joypad_callback(state.emulator, state.joypadPtr);
  state.gb = createGameBoyBridge();
  state.manifest = manifest;
  state.manifestUrl = manifestUrl;
  await restoreStoredExtRam();
  refreshAudioBinding();
  resetCaptureState();
  updateTelemetry();

  state.lastRafSec = 0;
  state.leftoverTicks = 0;
  state.sram.lastPersistMs = performance.now();
  state.rafId = requestAnimationFrame(rafCallback);
  dom.overlay.classList.add('hidden');
  setStatus('emulator', 'Running');
  log(`Booted ${manifest.rom.name}`, 'ok');
  log('RAM bridge ready: window.pokebellsEmulator.readByte/writeByte exposed', 'ok');
  log(
    `Gen 2 species catalog ready: Pikachu=${state.speciesCatalog.validation.pikachuCatchRate}, `
      + `Mewtwo=${state.speciesCatalog.validation.mewtwoCatchRate}, `
      + `Celebi=${state.speciesCatalog.validation.celebiCatchRate}`,
    'ok',
  );

  // Enable the Sync-save button now that the emulator is running + the
  // ROM SHA is known. It will send the save to the wallet's address on the
  // current network. Also probe the indexer for a previously inscribed
  // save and surface "Restore save from chain" if found.
  if (dom.syncSave) dom.syncSave.disabled = false;
  setSaveStatus('Save in-game (Start → SAVE), then click "Sync save to chain".');
  probeCloudSave().catch(() => {});
}

async function loadSpritePackManifest(manifest, manifestUrl) {
  const source = manifest.sprite_pack ?? manifest.spritePack ?? null;
  state.spritePack.manifest = null;
  state.spritePack.resolver = null;
  state.spritePack.source = null;

  if (!source) {
    return;
  }

  let spriteManifestUrl = null;
  if (source.url) {
    spriteManifestUrl = new URL(source.url, manifestUrl).href;
  } else if (source.inscription_id) {
    const base = source.contentBaseUrl || manifest.contentBaseUrl || DEFAULT_CONTENT_BASE_URL;
    spriteManifestUrl = new URL(source.inscription_id, base).href;
  }

  if (!spriteManifestUrl) {
    log('Sprite pack source present but has no url/inscription_id — skipped.', 'warn');
    return;
  }

  try {
    const response = await fetch(spriteManifestUrl);
    if (!response.ok) {
      throw new Error(`sprite-pack fetch failed (${response.status})`);
    }
    const json = await response.json();
    const contentBase = source.spriteContentBaseUrl
      || source.contentBaseUrl
      || manifest.contentBaseUrl
      || DEFAULT_CONTENT_BASE_URL;
    const resolver = buildSpriteImageResolver(json, { contentBaseUrl: contentBase });
    if (!resolver) {
      throw new Error('sprite-pack manifest shape is unsupported');
    }
    state.spritePack.manifest = json;
    state.spritePack.resolver = resolver;
    state.spritePack.source = spriteManifestUrl;
    const entryCount = Object.keys(json.sprites ?? {}).length;
    log(`Sprite pack loaded (${entryCount} species, content base ${contentBase}).`, 'ok');
  } catch (error) {
    log(`Sprite pack load failed — captures will mint with image=null. ${error.message}`, 'warn');
  }
}

async function loadManifestAndBoot(forceRebuild = false) {
  const manifestUrl = resolveManifestUrl(dom.manifestUrl.value.trim() || 'manifest.local.json');
  setStatus('manifest', 'Loading');
  setStatus('rom', 'Preparing');
  setStatus('emulator', 'Loading');
  setStatus('watch', 'Preparing');

  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Manifest fetch failed (${response.status})`);
  }

  const manifest = await response.json();
  if (!Array.isArray(manifest.chunks) || !manifest.rom || !manifest.runtime) {
    throw new Error('Manifest format is not supported.');
  }

  setStatus('manifest', `${manifest.mode} - ${manifest.rom.chunkCount} chunks`);
  log(`Manifest loaded from ${manifestUrl}`, 'ok');
  log(`ROM ${manifest.rom.name} ${manifest.rom.byteLength} bytes sha256 ${manifest.rom.sha256.slice(0, 12)}...`);

  await loadSpritePackManifest(manifest, manifestUrl);

  const romBuffer = await getRomBuffer(manifest, manifestUrl, forceRebuild);
  setStatus('rom', `${manifest.rom.byteLength} bytes ready`);
  await bootEmulator(manifest, manifestUrl, romBuffer);
}

function setJoypadState(name, pressed) {
  if (!state.module || !state.emulator) {
    return;
  }

  const mapping = {
    up: state.module._set_joyp_up,
    down: state.module._set_joyp_down,
    left: state.module._set_joyp_left,
    right: state.module._set_joyp_right,
    a: state.module._set_joyp_A,
    b: state.module._set_joyp_B,
    start: state.module._set_joyp_start,
    select: state.module._set_joyp_select,
  };

  const fn = mapping[name];
  if (!fn) {
    return;
  }

  fn(state.emulator, pressed ? 1 : 0);
}

function bindPadButtons() {
  const buttons = document.querySelectorAll('[data-key]');
  for (const button of buttons) {
    const key = button.dataset.key;
    const press = (event) => {
      event.preventDefault();
      button.classList.add('active');
      setJoypadState(key, true);
    };
    const release = (event) => {
      event.preventDefault();
      button.classList.remove('active');
      setJoypadState(key, false);
    };

    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointercancel', release);
  }
}

function bindKeyboard() {
  const keyMap = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyZ: 'b',
    KeyX: 'a',
    Enter: 'start',
    ShiftLeft: 'select',
    ShiftRight: 'select',
  };

  const pressed = new Set();
  const releaseAllPressed = () => {
    for (const code of pressed) {
      const mapped = keyMap[code];
      if (mapped) {
        setJoypadState(mapped, false);
      }
    }
    pressed.clear();
  };

  window.addEventListener('keydown', (event) => {
    const mapped = keyMap[event.code];
    if (!mapped) {
      return;
    }
    if (isUiLocked()) {
      if (pressed.size) {
        releaseAllPressed();
      }
      return;
    }
    event.preventDefault();
    if (pressed.has(event.code)) {
      return;
    }
    pressed.add(event.code);
    setJoypadState(mapped, true);
  });

  window.addEventListener('keyup', (event) => {
    const mapped = keyMap[event.code];
    if (!mapped) {
      return;
    }
    if (isUiLocked()) {
      pressed.delete(event.code);
      return;
    }
    event.preventDefault();
    pressed.delete(event.code);
    setJoypadState(mapped, false);
  });
}

async function clearCache() {
  const db = await openDb();
  await Promise.all([dbClear(db, 'roms'), dbClear(db, 'chunks')]);
  setStatus('cache', 'Cleared');
  log(`${getStorageBackendLabel()} ROM/chunk cache cleared`, 'warn');
}

async function copyDurableUrl() {
  const url = getDirectContentUrl();
  await navigator.clipboard.writeText(url);
  log(`Direct content URL copied. Paste it into the address bar to run outside the Nintondo sandbox with durable local storage: ${url}`, 'ok');
}

async function openCompanion() {
  const url = getCompanionUrl();
  const opened = window.open(url, '_blank', 'noopener');
  if (!opened) {
    await navigator.clipboard.writeText(url);
    log(`Popup blocked. Companion URL copied instead: ${url}`, 'warn');
    return;
  }

  log(`Companion opened: ${url}`, 'ok');
}

function getFullscreenElement() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || null;
}

async function requestGameFullscreen() {
  const target = dom.screenWrap;
  const request = target.requestFullscreen
    || target.webkitRequestFullscreen
    || target.msRequestFullscreen;
  if (!request) {
    throw new Error('Fullscreen API is not available in this browser/context.');
  }

  await request.call(target);
}

async function exitGameFullscreen() {
  const exit = document.exitFullscreen
    || document.webkitExitFullscreen
    || document.msExitFullscreen;
  if (!exit) {
    return;
  }

  await exit.call(document);
}

async function toggleGameFullscreen() {
  if (getFullscreenElement()) {
    await exitGameFullscreen();
  } else {
    await requestGameFullscreen();
  }
}

function updateFullscreenButton() {
  dom.toggleFullscreen.textContent = getFullscreenElement() ? 'Exit fullscreen' : 'Fullscreen';
}

async function run(action) {
  dom.loadManifest.disabled = true;
  dom.reloadRom.disabled = true;
  dom.clearCache.disabled = true;
  dom.copyDurableUrl.disabled = true;
  dom.openCompanion.disabled = true;
  dom.toggleFullscreen.disabled = true;
  dom.loadDevSave.disabled = true;
  dom.walletConnect.disabled = true;
  dom.walletProbe.disabled = true;
  dom.walletSignTest.disabled = true;
  dom.walletMint.disabled = true;
  dom.walletSyncPc.disabled = true;
  dom.walletReset.disabled = true;
  try {
    await action();
  } catch (error) {
    setStatus('emulator', 'Error');
    setStatus('watch', 'Error');
    log(error.message, 'bad');
    dom.overlay.textContent = error.message;
    dom.overlay.classList.remove('hidden');
  } finally {
    dom.loadManifest.disabled = false;
    dom.reloadRom.disabled = false;
    dom.clearCache.disabled = false;
    dom.openCompanion.disabled = false;
    dom.toggleFullscreen.disabled = false;
    updateFullscreenButton();
    updateStorageStatus();
    dom.loadDevSave.disabled = !state.manifest;
    const walletState = await state.wallet.adapter.getState();
    const supportsSignMessage = walletState.capabilities.includes('signMessage');
    dom.walletConnect.disabled = !walletState.available && !walletState.connected;
    dom.walletProbe.disabled = !canProbeWallet();
    dom.walletSignTest.disabled = !walletState.connected || !supportsSignMessage;
    dom.walletReset.disabled = false;
    updateMintButtonState(walletState);
    dom.walletSyncPc.disabled = !canSyncPcBoxes();
  }
}

updateStorageStatus();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushPendingLocalState('visibility-hidden');
  }
});
window.addEventListener('pagehide', () => {
  flushPendingLocalState('pagehide');
});
window.addEventListener('beforeunload', handleBeforeUnload);

dom.loadManifest.addEventListener('click', () => {
  run(() => loadManifestAndBoot(false));
});

dom.reloadRom.addEventListener('click', () => {
  run(() => loadManifestAndBoot(true));
});

dom.clearCache.addEventListener('click', () => {
  run(clearCache);
});

dom.copyDurableUrl.addEventListener('click', () => {
  run(copyDurableUrl);
});

dom.openCompanion.addEventListener('click', () => {
  run(openCompanion);
});

dom.toggleFullscreen.addEventListener('click', () => {
  run(toggleGameFullscreen);
});

dom.loadDevSave.addEventListener('click', () => {
  run(loadBundledDevSave);
});

dom.walletAdapterSelect.addEventListener('change', () => {
  run(() => switchWalletAdapter(dom.walletAdapterSelect.value));
});

dom.walletConnect.addEventListener('click', () => {
  run(toggleWalletConnection);
});

dom.walletProbe.addEventListener('click', () => {
  run(probeWalletProvider);
});

dom.walletSignTest.addEventListener('click', () => {
  run(signWalletTestMessage);
});

dom.walletMint.addEventListener('click', () => {
  run(handleMintButton);
});

dom.walletSyncPc.addEventListener('click', () => {
  run(syncWalletToPcBoxes);
});

dom.walletReset.addEventListener('click', () => {
  run(resetCurrentWalletAdapter);
});

document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);

dom.mintModal.confirm.addEventListener('click', () => {
  dom.mintModal.confirm.disabled = true;
  closeMintModal(true);
});

dom.mintModal.cancel.addEventListener('click', () => {
  closeMintModal(false);
});

dom.mintModal.root.addEventListener('click', (event) => {
  if (event.target === dom.mintModal.root) {
    closeMintModal(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dom.mintModal.root.classList.contains('hidden')) {
    event.preventDefault();
    closeMintModal(false);
  }
});

dom.captureHandoffModal.open.addEventListener('click', () => {
  dom.captureHandoffModal.open.disabled = true;
  openCaptureHandoffCompanion()
    .catch((error) => {
      log(error.message, 'bad');
    })
    .finally(() => {
      dom.captureHandoffModal.open.disabled = false;
    });
});

// ============================================================================
// Direct mint pipeline (v1.5 client-side ordinals via window.nintondo)
// ============================================================================
// Walks the SHELL-V1.5-PIPELINE.md state machine for a single pending
// capture: pending_commit → commit_broadcast → commit_confirmed →
// pending_mint → mint_broadcast → mint_confirmed. Each transition is
// wrapped in transitionPendingCapture() so the invariants in the spec
// can't be silently violated. Errors at any step keep the row in its
// last successful state with last_error populated for retry.

const ELECTRS_BASES_FOR_MINT = {
  'bells-mainnet': 'https://api.nintondo.io',
  'bells-testnet': 'https://bells-testnet-api.nintondo.io',
};

function electrsBaseFor(network) {
  return ELECTRS_BASES_FOR_MINT[network] ?? ELECTRS_BASES_FOR_MINT['bells-testnet'];
}

function indexerBaseFor(_network) {
  // The companion's INDEXER_BASE_FALLBACKS[0] is the one currently live.
  // shell.js used to redirect to companion to register; with v1.5 direct
  // mint we POST ourselves. URL is hardcoded for now; resilience model
  // (memory: resilience_model.md) will replace with on-chain
  // p:pokebells-collection registry post-mainnet.
  return 'https://pokebells-indexer.ceyzcrypto.workers.dev';
}

function detectDirectMintCapability() {
  const hasWallet = typeof window !== 'undefined'
    && typeof window.nintondo !== 'undefined'
    && typeof window.nintondo.signPsbt === 'function';
  const inIframe = typeof window !== 'undefined' && window.parent !== window;
  return {
    hasWallet,
    inIframe,
    canDirectMint: hasWallet,  // bridge proxies window.nintondo too
  };
}

async function fetchUtxosForMint(address, electrsBase) {
  const r = await fetch(`${electrsBase}/address/${encodeURIComponent(address)}/utxo`);
  if (!r.ok) throw new Error(`utxo fetch ${r.status}`);
  const list = await r.json();
  if (!Array.isArray(list)) throw new Error('utxo response is not an array');
  // Each entry needs the full raw tx hex for nonWitnessUtxo.
  const cache = new Map();
  const out = [];
  for (const u of list) {
    if (!cache.has(u.txid)) {
      const r2 = await fetch(`${electrsBase}/tx/${u.txid}/hex`);
      if (!r2.ok) throw new Error(`tx/${u.txid}/hex ${r2.status}`);
      cache.set(u.txid, (await r2.text()).trim());
    }
    out.push({
      txid: u.txid,
      vout: u.vout,
      value: Number(u.value),
      hex: cache.get(u.txid),
    });
  }
  return out;
}

async function broadcastTxHex(electrsBase, hex) {
  const r = await fetch(`${electrsBase}/tx`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: hex,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`broadcast ${r.status}: ${text.slice(0, 200)}`);
  }
  return (await r.text()).trim();
}

async function pollInscriptionRegistered(indexerBase, kind, inscriptionId, opts = {}) {
  const path = kind === 'mint' ? '/api/pokemon/' : '/api/captures/';
  const maxAttempts = opts.maxAttempts ?? 30;     // ~3 min at 6 s
  const delayMs = opts.delayMs ?? 6000;
  for (let i = 0; i < maxAttempts; i += 1) {
    const r = await fetch(`${indexerBase}${path}${inscriptionId}`).catch(() => null);
    if (r && r.ok) return await r.json().catch(() => ({}));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

let inscriberModulePromise = null;
async function loadInscriberModule() {
  if (!inscriberModulePromise) {
    // boot.js >= chunked-modules exposes loadModule(key). It handles both
    // monolithic (single inscription) and chunked (N pieces concatenated
    // client-side) modules transparently. The pokebells_inscriber bundle
    // is 420+ KB so on inscription mode it's chunked into 3 pieces to fit
    // under Bells' 400K WU standard-tx weight limit.
    if (!window.PokeBellsBoot?.loadModule) {
      throw new Error('PokeBellsBoot.loadModule is not available — boot.js v1.6+ required for chunked modules');
    }
    inscriberModulePromise = window.PokeBellsBoot.loadModule('pokebells_inscriber');
  }
  return inscriberModulePromise;
}

async function inscribePayloadOnChain({
  inscriber,
  network,
  bodyBytes,
  mime,
  signPsbtViaWallet,
  walletAddress,
  publicKeyHex,
  electrsBase,
}) {
  const net = inscriber.networkForKey(network);
  const utxos = await fetchUtxosForMint(walletAddress, electrsBase);
  if (utxos.length === 0) throw new Error('wallet has no UTXOs on this network');

  const getUtxos = async (requiredAmount) => {
    utxos.sort((a, b) => b.value - a.value);
    const picked = [];
    let total = 0;
    for (const u of utxos) {
      picked.push(u);
      total += u.value;
      if (total >= requiredAmount + 5000) break;
    }
    if (total < requiredAmount) {
      throw new Error(`insufficient: have ${total}, need ${requiredAmount}`);
    }
    return picked;
  };

  const result = await inscriber.inscribe({
    toAddress: walletAddress,
    fromAddress: walletAddress,
    contentType: mime,
    data: Buffer.from(bodyBytes),
    feeRate: 150,
    publicKey: Buffer.from(publicKeyHex.match(/.{2}/g).map((b) => parseInt(b, 16))),
    signPsbt: signPsbtViaWallet,
    getUtxos,
    network: net,
  });
  return result;  // { fundTxHex, revealTxHex, inscriptionId }
}

function setMintStatusUi(text, tone) {
  const el = dom.captureHandoffModal.mintStatus;
  if (!el) return;
  el.hidden = false;
  el.textContent = text ?? '';
  el.className = tone === 'err' ? 'subline bad'
    : tone === 'ok' ? 'subline ok'
    : tone === 'warn' ? 'subline warn'
    : 'subline muted';
}

async function runDirectMintFlow(attestation) {
  const indexerBase = indexerBaseFor();
  const cap = detectDirectMintCapability();
  if (!cap.canDirectMint) {
    throw new Error('window.nintondo.signPsbt not available — install the wallet or use the manual fallback');
  }

  let row = await getPendingCapture(attestation);
  if (!row) throw new Error(`pending capture ${attestation} not found`);

  // Short-circuit re-clicks after a successful mint: if the state
  // machine already reached mint_confirmed, don't reload the inscriber
  // bundle or re-trigger the wallet handshake. Just surface the success
  // state again so the user knows there's nothing more to sign.
  if (row.status === 'mint_confirmed') {
    setMintStatusUi(
      `Already minted ✓ ${row.preview_species_name ?? '?'} Lv.${row.preview_level ?? '?'}. `
      + `Inscription: ${(row.mint_inscription_id ?? '').slice(0, 16)}…`,
      'ok',
    );
    return row;
  }
  if (row.status === 'cancelled') {
    setMintStatusUi('Capture was cancelled. Start a new catch to mint again.', 'warn');
    return row;
  }

  const electrsBase = electrsBaseFor(row.network);
  const signPsbt = (psbtBase64) =>
    window.nintondo.signPsbt(psbtBase64, { autoFinalized: true });

  setMintStatusUi('Loading inscriber bundle…');
  const inscriber = await loadInscriberModule();

  // Wallet handshake
  const connectResult = await window.nintondo.connect(
    row.network === 'bells-mainnet' ? 'bellsMainnet' : 'bellsTestnet',
  );
  const walletAddress = typeof connectResult === 'string'
    ? connectResult
    : (connectResult?.address ?? await window.nintondo.getAccount());
  if (!walletAddress) throw new Error('wallet returned no address');
  if (walletAddress !== row.signed_in_wallet) {
    throw new Error(
      `connected wallet ${walletAddress} does not match capture's signed_in_wallet ${row.signed_in_wallet}`,
    );
  }
  const publicKeyHex = await window.nintondo.getPublicKey();

  // ---- Step 1: capture_commit ----
  // Recovery-aware: if a previous attempt broadcast fund OK but reveal
  // KO (or refresh happened mid-broadcast), this branch detects the
  // partial state at the TOP and either (a) re-broadcasts only the
  // missing tx using cached signed hexes ("recovery"), or (b) refuses
  // to call the inscriber lib if no hex cache exists ("stranded" —
  // would otherwise re-sign + re-broadcast a SECOND fund tx, double-
  // spending). The fresh-row path signs + caches BEFORE broadcasting.
  if (row.status === 'pending_commit') {
    const recovery = detectCommitRecoveryState(row);
    if (recovery.state === 'stranded') {
      throw new Error(recovery.reason);
    }

    let cachedFundHex = row.commit_fund_tx_hex;
    let cachedRevealHex = row.commit_reveal_tx_hex;
    let cachedInscriptionId = row.commit_inscription_id;

    if (recovery.state === 'fresh') {
      setMintStatusUi('Inscribing capture_commit (2 wallet popups: fund + reveal)…');
      log(`direct-mint: inscribing commit for ${attestation.slice(0, 12)}…`, 'capture');
      const bodyBytes = new TextEncoder().encode(JSON.stringify(row.commit_record));
      let result;
      try {
        result = await inscribePayloadOnChain({
          inscriber, network: row.network, bodyBytes, mime: 'application/json',
          signPsbtViaWallet: signPsbt, walletAddress, publicKeyHex, electrsBase,
        });
      } catch (e) {
        await patchPendingCapture(attestation, {
          last_error: `commit build/sign failed: ${e.message}`,
          retry_count: (row.retry_count ?? 0) + 1,
        });
        throw e;
      }
      // Persist signed hexes BEFORE any broadcast so a partial-broadcast
      // failure can recover without a second wallet popup.
      row = await patchPendingCapture(attestation, {
        commit_fund_tx_hex: result.fundTxHex,
        commit_reveal_tx_hex: result.revealTxHex,
        last_error: null,
      });
      cachedFundHex = result.fundTxHex;
      cachedRevealHex = result.revealTxHex;
      cachedInscriptionId = result.inscriptionId;
    } else {
      log(`direct-mint: resuming commit from cached signed hexes (recovery)`, 'warn');
      setMintStatusUi('Recovery: re-broadcasting whichever commit tx is missing…');
    }

    // Fund broadcast (skipped if commit_fund_txid already persisted).
    if (!row.commit_fund_txid) {
      setMintStatusUi('Broadcasting commit fund tx…');
      let fundTxid;
      try {
        fundTxid = await broadcastTxHex(electrsBase, cachedFundHex);
      } catch (e) {
        await patchPendingCapture(attestation, {
          last_error: `commit fund broadcast failed: ${e.message}`,
          retry_count: (row.retry_count ?? 0) + 1,
        });
        throw e;
      }
      row = await patchPendingCapture(attestation, {
        commit_fund_txid: fundTxid,
        last_error: null,
      });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Reveal broadcast (skipped if commit_reveal_txid already persisted).
    if (!row.commit_reveal_txid) {
      setMintStatusUi('Broadcasting commit reveal tx…');
      let revealTxid;
      try {
        revealTxid = await broadcastTxHex(electrsBase, cachedRevealHex);
      } catch (e) {
        await patchPendingCapture(attestation, {
          last_error: `commit reveal broadcast failed (fund_txid ${row.commit_fund_txid} stranded): ${e.message}`,
          retry_count: (row.retry_count ?? 0) + 1,
        });
        throw e;
      }
      row = await patchPendingCapture(attestation, {
        commit_reveal_txid: revealTxid,
        last_error: null,
      });
    }

    row = await transitionPendingCapture(attestation, 'commit_broadcast', {
      commit_inscription_id: cachedInscriptionId,
      last_error: null,
    });
    log(`direct-mint: commit broadcast ${cachedInscriptionId}`, 'ok');
  }

  // ---- Step 2: register commit (best-effort, single shot) + advance ----
  // Tries the indexer ONCE — failures queue in pending_registrations and
  // drain on next boot or via manual "Re-notify indexer". We deliberately
  // do NOT block the flow with retries here: that adds a 30s wait
  // between popups 2 (commit reveal) and 3 (mint fund) which the user
  // perceives as "it's done" + then panics when more popups appear out
  // of nowhere. The mint inscription_id is deterministic from the
  // reveal txid (see broadcastTxHex result), so we don't need indexer
  // ack to proceed.
  if (row.status === 'commit_broadcast') {
    setMintStatusUi('Registering commit with indexer (best-effort, queued on failure)…');
    notifyIndexerOfInscription({
      attestation,
      kind: 'commit',
      inscriptionId: row.commit_inscription_id,
      network: row.network,
    }).then((registered) => {
      if (!registered) {
        log(`direct-mint: indexer commit registration queued (will retry later)`, 'warn');
      }
    }).catch((e) => {
      log(`direct-mint: indexer commit notify rejected: ${e.message}`, 'warn');
    });
    row = await transitionPendingCapture(attestation, 'commit_confirmed', { last_error: null });
    log(`direct-mint: commit advanced ${row.commit_inscription_id}`, 'ok');
  }

  // ---- Step 3: build mint body, transition to pending_mint ----
  if (row.status === 'commit_confirmed') {
    setMintStatusUi('Building mint inscription body…');
    row = await transitionPendingCapture(attestation, 'pending_mint', { last_error: null });
  }

  // ---- Step 4: inscribe mint ----
  // Same recovery-aware shape as Step 1 above. Stranded state refuses
  // to re-sign + double-spend; recovery reuses cached signed hexes;
  // fresh state signs once + caches before any broadcast.
  if (row.status === 'pending_mint') {
    const recovery = detectMintRecoveryState(row);
    if (recovery.state === 'stranded') {
      throw new Error(recovery.reason);
    }

    let cachedFundHex = row.mint_fund_tx_hex;
    let cachedRevealHex = row.mint_reveal_tx_hex;
    let cachedInscriptionId = row.mint_inscription_id;

    if (recovery.state === 'fresh') {
      const mintRecord = buildPokemonMintRecord({
        commitRecord: row.commit_record,
        commitInscriptionId: row.commit_inscription_id,
        privateReveal: row.private_reveal,
        speciesResolver: (id) => getSpeciesByInternalId(state.speciesCatalog, id),
        resolveSpriteImage: state.spritePack.resolver,
      });
      setMintStatusUi('Inscribing mint (2 wallet popups: fund + reveal)…');
      log(`direct-mint: inscribing mint for ${attestation.slice(0, 12)}…`, 'capture');
      const bodyBytes = new TextEncoder().encode(JSON.stringify(mintRecord));
      let result;
      try {
        result = await inscribePayloadOnChain({
          inscriber, network: row.network, bodyBytes, mime: 'application/json',
          signPsbtViaWallet: signPsbt, walletAddress, publicKeyHex, electrsBase,
        });
      } catch (e) {
        await patchPendingCapture(attestation, {
          last_error: `mint build/sign failed: ${e.message}`,
          retry_count: (row.retry_count ?? 0) + 1,
        });
        throw e;
      }
      row = await patchPendingCapture(attestation, {
        mint_fund_tx_hex: result.fundTxHex,
        mint_reveal_tx_hex: result.revealTxHex,
        last_error: null,
      });
      cachedFundHex = result.fundTxHex;
      cachedRevealHex = result.revealTxHex;
      cachedInscriptionId = result.inscriptionId;
    } else {
      log(`direct-mint: resuming mint from cached signed hexes (recovery)`, 'warn');
      setMintStatusUi('Recovery: re-broadcasting whichever mint tx is missing…');
    }

    if (!row.mint_fund_txid) {
      setMintStatusUi('Broadcasting mint fund tx…');
      let mintFundTxid;
      try {
        mintFundTxid = await broadcastTxHex(electrsBase, cachedFundHex);
      } catch (e) {
        await patchPendingCapture(attestation, {
          last_error: `mint fund broadcast failed: ${e.message}`,
          retry_count: (row.retry_count ?? 0) + 1,
        });
        throw e;
      }
      row = await patchPendingCapture(attestation, {
        mint_fund_txid: mintFundTxid,
        last_error: null,
      });
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!row.mint_reveal_txid) {
      setMintStatusUi('Broadcasting mint reveal tx…');
      let mintRevealTxid;
      try {
        mintRevealTxid = await broadcastTxHex(electrsBase, cachedRevealHex);
      } catch (e) {
        await patchPendingCapture(attestation, {
          last_error: `mint reveal broadcast failed (fund_txid ${row.mint_fund_txid} stranded): ${e.message}`,
          retry_count: (row.retry_count ?? 0) + 1,
        });
        throw e;
      }
      row = await patchPendingCapture(attestation, {
        mint_reveal_txid: mintRevealTxid,
        last_error: null,
      });
    }

    row = await transitionPendingCapture(attestation, 'mint_broadcast', {
      mint_inscription_id: cachedInscriptionId,
      last_error: null,
    });
    log(`direct-mint: mint broadcast ${cachedInscriptionId}`, 'ok');
  }

  // ---- Step 5: register mint (best-effort, single shot) + done ----
  // Same single-shot semantics as Step 2 — failure queues, no blocking
  // retry loop that would freeze the modal for 30s of user confusion.
  if (row.status === 'mint_broadcast') {
    setMintStatusUi('Registering mint with indexer (best-effort, queued on failure)…');
    const registerResult = await notifyIndexerOfInscription({
      attestation,
      kind: 'mint',
      inscriptionId: row.mint_inscription_id,
      network: row.network,
    }).catch((e) => {
      log(`direct-mint: indexer mint notify rejected: ${e.message}`, 'warn');
      return false;
    });
    row = await transitionPendingCapture(attestation, 'mint_confirmed', { last_error: null });
    if (registerResult === true) {
      setMintStatusUi(
        `Minted + indexed ✓ ${row.preview_species_name ?? '?'} Lv.${row.preview_level ?? '?'}. `
        + `Inscription: ${row.mint_inscription_id.slice(0, 16)}…`,
        'ok',
      );
      log(`direct-mint DONE ${row.mint_inscription_id}`, 'ok');
    } else {
      setMintStatusUi(
        `Both inscriptions broadcast on-chain ✓ — indexer sync queued in background `
        + `(will retry on next page reload or via 'Re-notify indexer'). `
        + `Mint: ${row.mint_inscription_id.slice(0, 16)}…`,
        'warn',
      );
      log(`direct-mint broadcast OK; indexer sync queued ${row.mint_inscription_id}`, 'warn');
    }
    return row;
  }

  return row;
}

// Boot-time + manual "Re-notify indexer" retry for queued
// pending_registrations. Best-effort: never throws, just walks each
// queued kind and POSTs. The pending_registrations array shrinks as
// notifications succeed; failures stay in the queue for next retry.
async function drainPendingIndexerRegistrations() {
  let rows;
  try { rows = await listPendingCaptures(); }
  catch { return; }
  for (const row of rows) {
    const queue = Array.isArray(row.pending_registrations) ? row.pending_registrations : [];
    if (queue.length === 0) continue;
    for (const kind of queue) {
      const inscriptionId = kind === 'mint' ? row.mint_inscription_id : row.commit_inscription_id;
      if (!inscriptionId) continue;  // can't notify without an id
      await notifyIndexerOfInscription({
        attestation: row.attestation,
        kind,
        inscriptionId,
        network: row.network,
      });
    }
  }
}

if (dom.captureHandoffModal.mintDirect) {
  // Visibility of the button is controlled by showCaptureHandoff() which
  // calls detectDirectMintCapability() before opening the modal. The
  // handler runs the full state-machine pipeline.
  dom.captureHandoffModal.mintDirect.addEventListener('click', async () => {
    const view = state.ui.captureHandoff.payload ?? state.capture.lastPayload;
    if (!view?.attestation) {
      setMintStatusUi('No pending capture in this modal — open one from the Pending mints panel.', 'err');
      return;
    }
    dom.captureHandoffModal.mintDirect.disabled = true;
    dom.captureHandoffModal.open.disabled = true;
    let finalRow = null;
    try {
      finalRow = await runDirectMintFlow(view.attestation);
    } catch (error) {
      setMintStatusUi(`Direct mint failed: ${error.message}`, 'err');
      log(`direct-mint failed: ${error.stack ?? error.message ?? error}`, 'bad');
      // Re-enable only on error so the user can retry from a recovery
      // state (state machine skips already-signed popups).
      dom.captureHandoffModal.mintDirect.disabled = false;
      dom.captureHandoffModal.open.disabled = false;
      return;
    }
    // Successful flow: keep the mint button DISABLED so a double-click
    // can't re-enter an already-completed flow (which would otherwise
    // reload the inscriber bundle + re-open the wallet handshake for
    // nothing). Leave the companion-open button enabled so the user can
    // still copy the inscription id or open the inscription URL.
    if (finalRow?.status === 'mint_confirmed') {
      dom.captureHandoffModal.mintDirect.disabled = true;
      dom.captureHandoffModal.open.disabled = false;
    } else {
      // Flow returned without reaching mint_confirmed (partial broadcast,
      // indexer notify queued, etc.). Allow retry.
      dom.captureHandoffModal.mintDirect.disabled = false;
      dom.captureHandoffModal.open.disabled = false;
    }
  });
}

dom.captureHandoffModal.resume.addEventListener('click', () => {
  closeCaptureHandoff();
});

dom.captureHandoffModal.cancel.addEventListener('click', async () => {
  // Universal cancel rule (SHELL-V1.5-PIPELINE.md): every cancel
  // transition releases the Pokémon in-game AND marks the pending row
  // as `cancelled`. Forbidden once mint_broadcast is reached (the
  // state machine throws and we surface the error). Starter captures
  // reach this handler with mandatory=true and the button is hidden in
  // renderCaptureHandoffModal, so this path only fires for real
  // captures the user can release.
  const view = state.ui.captureHandoff.payload ?? state.capture.lastPayload;
  const attestation = view?.attestation ?? null;

  // Look up the row to tailor the confirm() message — once a commit is
  // on-chain the user needs to know it stays there forever.
  let pendingRow = null;
  if (attestation) {
    try { pendingRow = await getPendingCapture(attestation); }
    catch { /* fall through with null row */ }
  }
  const stage = pendingRow?.status ?? 'pending_commit';
  let promptText;
  switch (stage) {
    case 'pending_commit':
      promptText = 'Release this Pokemon?\n\n'
        + 'Nothing has been inscribed yet. The capture will be discarded '
        + 'and the Pokemon removed from your party. Continue?';
      break;
    case 'commit_broadcast':
    case 'commit_confirmed':
    case 'pending_mint':
      promptText = 'Release this Pokemon?\n\n'
        + 'A capture_commit is already on-chain (irreversible at the tx '
        + 'level). Cancelling here means: no Pokemon NFT will follow, the '
        + 'commit becomes a public "I caught something hidden" with no '
        + 'payoff, and the Pokemon will be removed from your party. Continue?';
      break;
    case 'mint_broadcast':
    case 'mint_confirmed':
      window.alert(
        `Mint already on-chain (status ${stage}). Cancel is no longer `
        + 'possible — the Pokemon will become canonical once confirmations land.',
      );
      return;
    default:
      promptText = 'Release this Pokemon?';
  }

  const confirmed = window.confirm(promptText);
  if (!confirmed) return;

  if (attestation) {
    try { await cancelPendingCapture(attestation); }
    catch (error) {
      log(`cancel rejected by state machine: ${error.message}`, 'bad');
      window.alert(`Cancel refused: ${error.message}`);
      return;
    }
  }
  releasePokemonInGame(state.ui.captureHandoff.slotIndex);
  closeCaptureHandoff({ clearPayload: true });
});

// ============================================================================
// Manual fallback handlers (SHELL-V1.5-PIPELINE.md Step 4)
// ============================================================================
// Always-visible <details> in the capture handoff modal. Lets a user
// without window.nintondo (or who prefers full manual control) walk
// the v1.5 protocol via Nintondo's web Inscriber: copy commit JSON,
// paste returned id, copy mint JSON (built locally — same canonical
// builder the direct path uses), paste returned id, done.
//
// Per GPT amendments:
//   - Indexer registration is best-effort and decoupled. The local
//     state advances as soon as the user pastes a valid id; failed
//     POSTs queue into pending_registrations.
//   - Mint body is built locally from commit_record + commit_inscription_id
//     + privateReveal — never from a user-pasted JSON (which would let
//     copy-paste errors silently produce inconsistent mints).
//   - State transitions match the cancel matrix and never re-broadcast.

const INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

async function resetManualFallbackPanel(attestation) {
  if (!dom.captureHandoffModal.manualSection) return;
  if (dom.captureHandoffModal.manualCommitStatus) {
    dom.captureHandoffModal.manualCommitStatus.textContent = '';
    dom.captureHandoffModal.manualCommitStatus.className = 'subline muted';
  }
  if (dom.captureHandoffModal.manualMintStatus) {
    dom.captureHandoffModal.manualMintStatus.textContent = '';
    dom.captureHandoffModal.manualMintStatus.className = 'subline muted';
  }
  if (dom.captureHandoffModal.manualCommitId) dom.captureHandoffModal.manualCommitId.value = '';
  if (dom.captureHandoffModal.manualMintId) dom.captureHandoffModal.manualMintId.value = '';
  enableManualStep2(false);
  if (!attestation) return;
  const row = await getPendingCapture(attestation);
  if (!row) return;
  if (row.commit_inscription_id && dom.captureHandoffModal.manualCommitId) {
    dom.captureHandoffModal.manualCommitId.value = row.commit_inscription_id;
    setManualCommitStatus(`Resumed: commit_inscription_id ${row.commit_inscription_id.slice(0, 16)}… already set.`, 'ok');
    enableManualStep2(true);
  }
  if (row.mint_inscription_id && dom.captureHandoffModal.manualMintId) {
    dom.captureHandoffModal.manualMintId.value = row.mint_inscription_id;
    setManualMintStatus(`Resumed: mint_inscription_id ${row.mint_inscription_id.slice(0, 16)}… already set.`, 'ok');
  }
}

function setManualCommitStatus(text, tone) {
  const el = dom.captureHandoffModal.manualCommitStatus;
  if (!el) return;
  el.textContent = text ?? '';
  el.className = tone === 'err' ? 'subline bad'
    : tone === 'ok' ? 'subline ok'
    : tone === 'warn' ? 'subline warn'
    : 'subline muted';
}
function setManualMintStatus(text, tone) {
  const el = dom.captureHandoffModal.manualMintStatus;
  if (!el) return;
  el.textContent = text ?? '';
  el.className = tone === 'err' ? 'subline bad'
    : tone === 'ok' ? 'subline ok'
    : tone === 'warn' ? 'subline warn'
    : 'subline muted';
}

function enableManualStep2(enabled) {
  const wrap = dom.captureHandoffModal.manualStep2;
  if (wrap) wrap.style.opacity = enabled ? '1' : '0.45';
  if (dom.captureHandoffModal.manualCopyMint) {
    dom.captureHandoffModal.manualCopyMint.disabled = !enabled;
  }
  if (dom.captureHandoffModal.manualMintId) {
    dom.captureHandoffModal.manualMintId.disabled = !enabled;
  }
}

async function copyToClipboard(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable; copy the field manually.');
  }
  await navigator.clipboard.writeText(text);
}

if (dom.captureHandoffModal.manualCopyCommit) {
  dom.captureHandoffModal.manualCopyCommit.addEventListener('click', async () => {
    const view = state.ui.captureHandoff.payload ?? state.capture.lastPayload;
    if (!view?.attestation) {
      setManualCommitStatus('No pending capture in this modal.', 'err');
      return;
    }
    const row = await getPendingCapture(view.attestation);
    if (!row) {
      setManualCommitStatus('Pending capture not found in IDB.', 'err');
      return;
    }
    try {
      await copyToClipboard(JSON.stringify(row.commit_record, null, 2));
      setManualCommitStatus(
        'Commit JSON copied. Open the Inscriber, inscribe as a .txt or .json file, and paste the returned id below.',
        'ok',
      );
    } catch (e) {
      setManualCommitStatus(`Clipboard failed: ${e.message}`, 'err');
    }
  });
}

if (dom.captureHandoffModal.manualCommitId) {
  // Fire on input + change so paste-and-tab works as well as paste-and-blur.
  const handleCommitIdInput = async () => {
    const input = dom.captureHandoffModal.manualCommitId;
    const id = input.value.trim().toLowerCase();
    if (!INSCRIPTION_ID_RE.test(id)) {
      setManualCommitStatus('Format expected: 64 hex chars + iN (e.g. ab12...cdi0)', 'muted');
      return;
    }
    const view = state.ui.captureHandoff.payload ?? state.capture.lastPayload;
    if (!view?.attestation) {
      setManualCommitStatus('No pending capture context.', 'err');
      return;
    }
    let row = await getPendingCapture(view.attestation);
    if (!row) {
      setManualCommitStatus('Pending capture not found.', 'err');
      return;
    }
    if (row.commit_inscription_id && row.commit_inscription_id !== id) {
      setManualCommitStatus(
        `Refusing to overwrite commit_inscription_id ${row.commit_inscription_id.slice(0, 16)}… `
        + 'with a different value (state-machine invariant 3).',
        'err',
      );
      return;
    }
    if (row.status === 'pending_commit') {
      try {
        row = await transitionPendingCapture(view.attestation, 'commit_broadcast', {
          commit_inscription_id: id,
          last_error: null,
        });
        row = await transitionPendingCapture(view.attestation, 'commit_confirmed', {
          last_error: null,
        });
      } catch (e) {
        setManualCommitStatus(`State transition failed: ${e.message}`, 'err');
        return;
      }
    } else if (row.status === 'commit_broadcast') {
      try {
        row = await transitionPendingCapture(view.attestation, 'commit_confirmed', {
          last_error: null,
        });
      } catch (e) {
        setManualCommitStatus(`State transition failed: ${e.message}`, 'err');
        return;
      }
    }
    // Best-effort indexer notify; failure queues into pending_registrations.
    setManualCommitStatus('Saved locally. Notifying indexer (best-effort)…', 'ok');
    const ok = await notifyIndexerOfInscription({
      attestation: view.attestation,
      kind: 'commit',
      inscriptionId: id,
      network: row.network,
    });
    setManualCommitStatus(
      ok
        ? `Commit registered ✓ (${id.slice(0, 16)}…). Now build + inscribe the mint in step 2.`
        : `Saved locally; indexer registration queued (will retry later).`,
      ok ? 'ok' : 'warn',
    );
    enableManualStep2(true);
  };
  dom.captureHandoffModal.manualCommitId.addEventListener('input', handleCommitIdInput);
  dom.captureHandoffModal.manualCommitId.addEventListener('change', handleCommitIdInput);
}

if (dom.captureHandoffModal.manualCopyMint) {
  dom.captureHandoffModal.manualCopyMint.addEventListener('click', async () => {
    const view = state.ui.captureHandoff.payload ?? state.capture.lastPayload;
    if (!view?.attestation) {
      setManualMintStatus('No pending capture context.', 'err');
      return;
    }
    let row = await getPendingCapture(view.attestation);
    if (!row) {
      setManualMintStatus('Pending capture not found.', 'err');
      return;
    }
    if (!row.commit_inscription_id) {
      setManualMintStatus('Commit inscription id missing — complete step 1 first.', 'err');
      return;
    }
    // Build mint locally — never trust a user-pasted mint JSON.
    let mintRecord;
    try {
      mintRecord = buildPokemonMintRecord({
        commitRecord: row.commit_record,
        commitInscriptionId: row.commit_inscription_id,
        privateReveal: row.private_reveal,
        speciesResolver: (id) => getSpeciesByInternalId(state.speciesCatalog, id),
        resolveSpriteImage: state.spritePack.resolver,
      });
    } catch (e) {
      setManualMintStatus(`Mint build failed: ${e.message}`, 'err');
      return;
    }
    // Walk to pending_mint if not already there.
    if (row.status === 'commit_confirmed') {
      try {
        row = await transitionPendingCapture(view.attestation, 'pending_mint', { last_error: null });
      } catch (e) {
        setManualMintStatus(`State transition failed: ${e.message}`, 'err');
        return;
      }
    }
    try {
      await copyToClipboard(JSON.stringify(mintRecord, null, 2));
      setManualMintStatus(
        'Mint JSON copied. Open the Inscriber, inscribe, and paste the returned id below.',
        'ok',
      );
    } catch (e) {
      setManualMintStatus(`Clipboard failed: ${e.message}`, 'err');
    }
  });
}

if (dom.captureHandoffModal.manualMintId) {
  const handleMintIdInput = async () => {
    const input = dom.captureHandoffModal.manualMintId;
    const id = input.value.trim().toLowerCase();
    if (!INSCRIPTION_ID_RE.test(id)) {
      setManualMintStatus('Format expected: 64 hex chars + iN', 'muted');
      return;
    }
    const view = state.ui.captureHandoff.payload ?? state.capture.lastPayload;
    if (!view?.attestation) {
      setManualMintStatus('No pending capture context.', 'err');
      return;
    }
    let row = await getPendingCapture(view.attestation);
    if (!row) {
      setManualMintStatus('Pending capture not found.', 'err');
      return;
    }
    if (row.mint_inscription_id && row.mint_inscription_id !== id) {
      setManualMintStatus(
        `Refusing to overwrite mint_inscription_id ${row.mint_inscription_id.slice(0, 16)}…`,
        'err',
      );
      return;
    }
    if (row.status === 'pending_mint') {
      try {
        row = await transitionPendingCapture(view.attestation, 'mint_broadcast', {
          mint_inscription_id: id,
          last_error: null,
        });
        row = await transitionPendingCapture(view.attestation, 'mint_confirmed', {
          last_error: null,
        });
      } catch (e) {
        setManualMintStatus(`State transition failed: ${e.message}`, 'err');
        return;
      }
    }
    setManualMintStatus('Saved locally. Notifying indexer (best-effort)…', 'ok');
    const ok = await notifyIndexerOfInscription({
      attestation: view.attestation,
      kind: 'mint',
      inscriptionId: id,
      network: row.network,
    });
    setManualMintStatus(
      ok
        ? `Pokémon minted ✓ (${id.slice(0, 16)}…). Visible in your Trainer panel after the indexer scans.`
        : `Saved locally; indexer registration queued (will retry later).`,
      ok ? 'ok' : 'warn',
    );
  };
  dom.captureHandoffModal.manualMintId.addEventListener('input', handleMintIdInput);
  dom.captureHandoffModal.manualMintId.addEventListener('change', handleMintIdInput);
}

// ---- Save handoff wiring ----

if (dom.syncSave) {
  dom.syncSave.addEventListener('click', () => {
    run(async () => {
      try {
        await buildAndShowSaveSnapshot();
      } catch (error) {
        log(`Sync save failed: ${error.message}`, 'bad');
        setSaveStatus(`Error: ${error.message}`);
      }
    });
  });
}

if (dom.saveHandoffModal.open) {
  dom.saveHandoffModal.open.addEventListener('click', () => {
    dom.saveHandoffModal.open.disabled = true;
    openSaveHandoffCompanion()
      .catch((error) => log(error.message, 'bad'))
      .finally(() => { dom.saveHandoffModal.open.disabled = false; });
  });
}
if (dom.saveHandoffModal.cancel) {
  dom.saveHandoffModal.cancel.addEventListener('click', () => { closeSaveHandoff(); });
}

// Expose reveal + save helpers for cross-tab companion invocation (devtools).
window.pokebellsBuildSaveSnapshot = async () => {
  const walletState = await state.wallet.adapter.getState();
  const wallet = walletState?.address;
  if (!wallet) throw new Error('connect a wallet first');
  if (!state.gb || !state.emulator) throw new Error('emulator not running');
  const sramBytes = readSramSnapshot(state.gb.readByte, state.gb.writeByte);
  const nextVersion = (state.save.lastInscribedVersion || 0) + 1;
  const record = await buildSaveSnapshotRecord({
    signedInWallet: wallet,
    captureNetwork: state.manifest?.network,
    gameRom: state.manifest?.rom?.name ?? null,
    gameRomSha256: state.manifest?.rom?.sha256,
    sramBytes,
    saveVersion: nextVersion,
  });
  return `${JSON.stringify(record, null, 2)}\n`;
};

// ---- Restore-from-chain flow ----
//
// On wallet connect + ROM boot, we probe the indexer for a previously
// inscribed save matching (wallet, rom_sha256, network). If one exists AND
// is newer than anything we've inscribed locally, surface a "Restore save
// from chain" button that pulls + applies the SRAM.

async function probeCloudSave() {
  const walletState = await state.wallet.adapter.getState();
  const wallet = walletState?.address;
  if (!wallet || !state.manifest?.rom?.sha256 || !state.manifest?.network) {
    if (dom.restoreSave) dom.restoreSave.classList.add('hidden');
    return null;
  }
  const indexerBase = resolveIndexerBaseUrl();
  const url = `${indexerBase.replace(/\/?$/, '/')}api/saves/${encodeURIComponent(wallet)}`
    + `?rom_sha=${state.manifest.rom.sha256}`
    + `&network=${encodeURIComponent(state.manifest.network)}`;
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    const payload = await r.json().catch(() => null);
    const save = payload?.save ?? payload ?? null;
    if (!save || !save.save_version) return null;
    if (dom.restoreSave) {
      dom.restoreSave.classList.remove('hidden');
      dom.restoreSave.textContent = `Restore save from chain (v${save.save_version})`;
    }
    return save;
  } catch {
    return null;
  }
}

// Compare local SRAM + metadata vs the chain save to decide if overwriting
// the local save would lose progress. Returns a verdict the UI uses to
// compose the confirm dialog text.
async function compareLocalToChainSave(chainSave) {
  const db = await openDb();
  const local = await dbGet(db, 'saves', getSaveKey()).catch(() => null);
  const localSnapshot = readSramSafe();
  const localSha = localSnapshot ? await sha256HexOfBytes(localSnapshot) : null;

  const chainVersion = chainSave.save_version;
  const chainSha = String(chainSave.sram_sha256 ?? '').toLowerCase();
  const localVersion = Number.isInteger(local?.local_save_version) ? local.local_save_version : 0;
  const syncedChainVersion = Number.isInteger(local?.synced_chain_version) ? local.synced_chain_version : 0;
  const syncedChainSha = local?.synced_chain_sha256 ?? null;

  const sameAsChain = localSha && localSha.toLowerCase() === chainSha;
  const localAheadOfSynced = syncedChainSha && localSha && localSha !== syncedChainSha;

  let verdict;
  if (sameAsChain) {
    verdict = 'already-in-sync';
  } else if (!local || localVersion === 0) {
    verdict = 'no-local-save'; // safe to restore, nothing to lose
  } else if (chainVersion > syncedChainVersion && !localAheadOfSynced) {
    verdict = 'chain-newer-safe'; // local matches the last-synced chain state, chain moved forward
  } else if (localAheadOfSynced && chainVersion <= syncedChainVersion) {
    verdict = 'local-ahead-chain-stale'; // local has unsynced changes + chain is older; dangerous
  } else if (localAheadOfSynced && chainVersion > syncedChainVersion) {
    verdict = 'diverged'; // both sides moved since last sync — worst case
  } else if (chainVersion <= syncedChainVersion) {
    verdict = 'chain-older'; // chain has no newer state to offer
  } else {
    verdict = 'unknown';
  }

  return {
    verdict,
    localVersion,
    localSha,
    chainVersion,
    chainSha,
    chainInscriptionId: chainSave.save_inscription_id ?? chainSave.inscription_id,
    syncedChainVersion,
    syncedChainSha,
  };
}

function buildRestoreConfirmMessage(cmp) {
  const localTag = cmp.localVersion
    ? `local v${cmp.localVersion} (sha ${String(cmp.localSha).slice(0, 12)}…)`
    : 'no local save';
  const chainTag = `chain v${cmp.chainVersion} (sha ${String(cmp.chainSha).slice(0, 12)}…)`;
  switch (cmp.verdict) {
    case 'already-in-sync':
      return { canProceed: false, text: 'Local save is already identical to the chain save — nothing to restore.' };
    case 'no-local-save':
      return { canProceed: true, text: `Restore ${chainTag}? No local save exists to overwrite.` };
    case 'chain-newer-safe':
      return {
        canProceed: true,
        text: `Chain has a newer save.\n\n${localTag} (last synced)\n${chainTag}\n\nRestore? Your local save matches the last-known chain state so nothing is lost.`,
      };
    case 'local-ahead-chain-stale':
      return {
        canProceed: true,
        dangerous: true,
        text: `⚠ WARNING: local save has UNSAVED-TO-CHAIN progress.\n\n${localTag}\n${chainTag} (older)\n\nRestoring OVERWRITES your local save with an older chain state. You will LOSE progress made since the last "Sync save to chain".\n\nConsider clicking "Sync save to chain" first. Continue with restore anyway?`,
      };
    case 'diverged':
      return {
        canProceed: true,
        dangerous: true,
        text: `⚠ DIVERGED STATES: both your local save and the chain save have moved since the last sync. Restoring will OVERWRITE your local progress with the chain's version.\n\n${localTag}\n${chainTag}\n\nContinue?`,
      };
    case 'chain-older':
      return {
        canProceed: true,
        dangerous: true,
        text: `Chain save is OLDER than your local save.\n\n${localTag}\n${chainTag}\n\nRestoring goes backwards in time. Continue?`,
      };
    default:
      return {
        canProceed: true,
        dangerous: true,
        text: `Compare:\n${localTag}\n${chainTag}\n\nRestore?`,
      };
  }
}

async function restoreCloudSave() {
  const walletState = await state.wallet.adapter.getState();
  const wallet = walletState?.address;
  if (!wallet || !state.gb || !state.emulator) {
    throw new Error('connect a wallet + boot the ROM before restoring');
  }
  const save = await probeCloudSave();
  if (!save) throw new Error('no save-snapshot found for this wallet + ROM');

  const cmp = await compareLocalToChainSave(save);
  const prompt = buildRestoreConfirmMessage(cmp);
  if (!prompt.canProceed) {
    setSaveStatus(prompt.text);
    return;
  }
  const confirmed = window.confirm(prompt.text);
  if (!confirmed) {
    setSaveStatus('Restore cancelled.');
    return;
  }

  // Fetch the full inscription content (the indexer may summarize the save
  // row without the full sram blob to save bandwidth).
  const contentBase = state.manifest?.network === 'bells-mainnet'
    ? 'https://bells-mainnet-content.nintondo.io/content/'
    : 'https://bells-testnet-content.nintondo.io/content/';
  const resp = await fetch(`${contentBase}${cmp.chainInscriptionId}`, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`fetch save inscription failed: HTTP ${resp.status}`);
  const raw = await resp.text();
  const record = JSON.parse(raw);
  if (record.op !== 'save-snapshot') throw new Error('inscription is not a save-snapshot');
  if (record.sram_encoding !== 'base64') throw new Error('only base64 sram_encoding supported yet');

  const sramBytes = Uint8Array.from(atob(record.sram), (c) => c.charCodeAt(0));
  if (sramBytes.byteLength !== SRAM_TOTAL_BYTE_LENGTH) {
    throw new Error(`sram must decode to ${SRAM_TOTAL_BYTE_LENGTH} bytes`);
  }
  writeSramSnapshot(state.gb.writeByte, state.gb.readByte, sramBytes);

  // Persist the chain-sourced SRAM locally + mark as "in sync with chain"
  // so subsequent in-game saves can be compared correctly.
  await writeStoredExtRamSnapshot(sramBytes, 'chain-restore');
  await markLocalSaveSyncedWithChain({
    chainVersion: record.save_version,
    chainInscriptionId: cmp.chainInscriptionId,
    chainSha256: String(record.sram_sha256).toLowerCase(),
  });
  state.save.lastInscribedVersion = record.save_version;
  state.save.lastInscribedSha256 = record.sram_sha256;
  state.save.localVersion = record.save_version; // chain reset resyncs local to its version
  state.save.lastLocalSha256 = String(record.sram_sha256).toLowerCase();

  log(`Restored save v${record.save_version} from chain (sha ${String(record.sram_sha256).slice(0, 12)}…).`, 'ok');
  setSaveStatus(`Restored save v${record.save_version} — continue playing from the point you synced.`);
}

if (dom.restoreSave) {
  dom.restoreSave.addEventListener('click', () => {
    run(async () => {
      try { await restoreCloudSave(); }
      catch (error) { log(`Restore failed: ${error.message}`, 'bad'); }
    });
  });
}

clearTelemetry();
renderCapturePayload(null);
renderOwnedPokemon(normalizeOwnedCollection());
setPcSyncMessage('Waiting for a save file.');
renderPokeballStatus(getPokeballCooldownStatus(state.pokeball.tipHeight));
renderWalletProviderLog();
renderWalletAdapterOptions();
bindPadButtons();

// v1.5: drain any indexer registrations that failed in a previous
// session. Best-effort + non-blocking — we never await this in the
// boot path so a slow/down indexer doesn't stall the game UI.
setTimeout(() => {
  drainPendingIndexerRegistrations().catch((error) => {
    log(`drainPendingIndexerRegistrations failed: ${error.message}`, 'warn');
  });
}, 5000);

// Manual re-notify button. Useful when the indexer was down during a
// mint, the notify enqueued, boot-time drain failed too (indexer still
// down), and the user wants to retry after it comes back. Walks every
// pendingCaptures row's pending_registrations queue and POSTs each
// pending kind (commit/mint) to the indexer.
if (dom.walletResyncIndexer) {
  dom.walletResyncIndexer.addEventListener('click', async () => {
    dom.walletResyncIndexer.disabled = true;
    const originalText = dom.walletResyncIndexer.textContent;
    dom.walletResyncIndexer.textContent = 'Re-notifying…';
    try {
      const rowsBefore = await listPendingCaptures();
      const queuedBefore = rowsBefore.reduce((s, r) =>
        s + (Array.isArray(r.pending_registrations) ? r.pending_registrations.length : 0), 0);
      await drainPendingIndexerRegistrations();
      const rowsAfter = await listPendingCaptures();
      const queuedAfter = rowsAfter.reduce((s, r) =>
        s + (Array.isArray(r.pending_registrations) ? r.pending_registrations.length : 0), 0);
      const drained = Math.max(0, queuedBefore - queuedAfter);
      if (queuedBefore === 0) {
        log(`Re-notify: no pending registrations queued.`, 'ok');
      } else if (queuedAfter === 0) {
        log(`Re-notify: ${drained} registration(s) acknowledged by indexer.`, 'ok');
      } else {
        log(`Re-notify: ${drained} / ${queuedBefore} succeeded, ${queuedAfter} still queued (indexer may still be down).`, 'warn');
      }
    } catch (error) {
      log(`Re-notify failed: ${error.message}`, 'bad');
    } finally {
      dom.walletResyncIndexer.disabled = false;
      dom.walletResyncIndexer.textContent = originalText;
    }
  });
}
bindKeyboard();

// Steal focus from any text input when the user clicks the game area so the
// keydown handler (bound to window) actually receives arrow / Z / X presses.
// The input fields (Manifest URL etc.) swallow these otherwise.
if (dom.screenWrap) {
  dom.screenWrap.addEventListener('pointerdown', () => {
    if (document.activeElement
        && document.activeElement !== document.body
        && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  });
}
dom.loadDevSave.disabled = true;
dom.walletProbe.disabled = !canProbeWallet();
dom.walletSignTest.disabled = true;
dom.walletSyncPc.disabled = true;
updateFullscreenButton();
refreshWalletView().catch((error) => {
  log(error.message, 'bad');
});
refreshPokeballStatus().catch(() => {});

// Multi-tab guard. Two tabs on the same origin share IndexedDB, which
// means a parallel emulator write to SRAM or pendingCaptures can
// silently corrupt the other tab's save. Users have hit this at least
// once ("j'ai lancé deux onglets en meme temps"). Detect other live
// tabs via BroadcastChannel and show a dismissable warning banner.
// Lightweight: no heartbeats, no locks, just a hello/ack ping at boot.
(function installMultiTabGuard() {
  if (typeof BroadcastChannel === 'undefined') return;
  let channel;
  try { channel = new BroadcastChannel('pokebells-tabs'); }
  catch { return; }
  let otherTabs = 0;
  let banner = null;
  function showBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;'
      + 'padding:10px 14px;background:#b45a00;color:#fff;'
      + 'font:13px/1.4 system-ui,sans-serif;display:flex;gap:10px;'
      + 'align-items:center;justify-content:center;';
    banner.innerHTML = '<strong>⚠ Another PokeBells tab is already open.</strong>'
      + ' Playing in two tabs at once can corrupt your save (last-write-wins on'
      + ' IndexedDB). Close one of them.'
      + ' <button style="margin-left:10px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.3);color:#fff;padding:3px 9px;border-radius:4px;cursor:pointer;font-size:12px;">Dismiss</button>';
    banner.querySelector('button').addEventListener('click', () => {
      banner.remove();
      banner = null;
    });
    document.body.prepend(banner);
  }
  channel.onmessage = (ev) => {
    const t = ev.data?.type;
    if (t === 'hi') {
      // A new tab announced itself. We were here first — tell them.
      channel.postMessage({ type: 'already-here' });
    } else if (t === 'already-here') {
      otherTabs += 1;
      showBanner();
    } else if (t === 'bye') {
      otherTabs = Math.max(0, otherTabs - 1);
      if (otherTabs === 0 && banner) { banner.remove(); banner = null; }
    }
  };
  // Announce ourselves. Existing tabs respond with 'already-here'.
  channel.postMessage({ type: 'hi' });
  window.addEventListener('beforeunload', () => {
    try { channel.postMessage({ type: 'bye' }); channel.close(); } catch {}
  });
})();

// When boot.js is in inscription mode and the main-manifest advertises a
// rom_manifest_inscription_id, point the Manifest URL input at the
// on-chain rom-manifest content URL by default instead of the local-dev
// file. User can still override by typing a different URL + clicking
// "Load manifest".
(function prefillManifestUrlFromInscriptionMode() {
  try {
    const boot = window.PokeBellsBoot;
    if (!boot || boot.mode !== 'inscription') return;
    const romId = boot.manifest?.rom_manifest_inscription_id;
    const base = boot.contentBase;
    if (!romId || !base) return;
    const onChainUrl = `${base}${romId}`;
    // Only overwrite the default placeholder — don't clobber a URL the
    // user might have typed into the input before this ran (unlikely
    // pre-boot, but cheap safety).
    if (!dom.manifestUrl) return;
    const current = dom.manifestUrl.value.trim();
    if (!current || current === 'manifest.local.json') {
      dom.manifestUrl.value = onChainUrl;
      log(`Inscription mode: using on-chain rom-manifest ${romId.slice(0, 16)}…`, 'ok');
    }
  } catch (e) {
    console.warn('[shell] failed to resolve on-chain rom-manifest URL:', e?.message ?? e);
  }
})();

run(() => loadManifestAndBoot(false));
