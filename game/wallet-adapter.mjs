const DEFAULT_STORAGE_KEY = 'pokebells-mock-wallet-v1';
const MAX_PARTY_SIZE = 6;
const BOX_CAPACITY = 20;
const SATS_PER_BEL = 100000000;

function makeAddressFromSeed(seed) {
  const normalized = String(seed).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'pokebells';
  const body = (normalized + '0123456789abcdef'.repeat(5)).slice(0, 30);
  return `tb1p${body}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function emptyOwnedPokemon() {
  return [];
}

function makeBoxId(index) {
  return `box-${index + 1}`;
}

function makeBoxLabel(index) {
  return `Box ${index + 1}`;
}

function annotatePartyPokemon(pokemon, slotIndex) {
  return {
    ...clone(pokemon),
    active: true,
    storage: {
      location: 'party',
      slot: slotIndex + 1,
    },
  };
}

function annotateBoxPokemon(pokemon, boxIndex, boxLabel, slotIndex) {
  return {
    ...clone(pokemon),
    active: false,
    storage: {
      location: 'box',
      box_index: boxIndex + 1,
      box_label: boxLabel,
      slot: slotIndex + 1,
    },
  };
}

function chunkIntoBoxes(pokemonList) {
  const boxes = [];
  for (let index = 0; index < pokemonList.length; index += BOX_CAPACITY) {
    boxes.push({
      id: makeBoxId(boxes.length),
      label: makeBoxLabel(boxes.length),
      pokemon: pokemonList.slice(index, index + BOX_CAPACITY),
    });
  }
  return boxes;
}

export function normalizeOwnedCollection(raw = {}) {
  let partySource = Array.isArray(raw.party) ? raw.party : null;
  let boxesSource = Array.isArray(raw.boxes) ? raw.boxes : null;

  if (!partySource && !boxesSource) {
    const legacyOwned = Array.isArray(raw.ownedPokemon) ? raw.ownedPokemon : [];
    partySource = legacyOwned.slice(0, MAX_PARTY_SIZE);
    boxesSource = chunkIntoBoxes(legacyOwned.slice(MAX_PARTY_SIZE));
  }

  const party = (partySource ?? [])
    .slice(0, MAX_PARTY_SIZE)
    .map((pokemon, index) => annotatePartyPokemon(pokemon, index));

  const boxes = (boxesSource ?? [])
    .map((box, boxIndex) => {
      const label = typeof box?.label === 'string' && box.label.trim()
        ? box.label.trim()
        : makeBoxLabel(boxIndex);
      const id = typeof box?.id === 'string' && box.id.trim()
        ? box.id.trim()
        : makeBoxId(boxIndex);
      const pokemon = Array.isArray(box?.pokemon) ? box.pokemon : [];

      return {
        id,
        label,
        pokemon: pokemon
          .slice(0, BOX_CAPACITY)
          .map((entry, slotIndex) => annotateBoxPokemon(entry, boxIndex, label, slotIndex)),
      };
    });

  if (!boxes.length) {
    boxes.push({
      id: makeBoxId(0),
      label: makeBoxLabel(0),
      pokemon: [],
    });
  }

  const boxedPokemon = boxes.flatMap((box) => box.pokemon);
  const ownedPokemon = [...party, ...boxedPokemon];

  return {
    party,
    boxes,
    boxedPokemon,
    ownedPokemon,
    totalCount: ownedPokemon.length,
  };
}

function placePokemonInCollection(collection, pokemon) {
  const party = collection.party.map((entry) => clone(entry));
  const boxes = collection.boxes.map((box) => ({
    ...box,
    pokemon: box.pokemon.map((entry) => clone(entry)),
  }));

  if (party.length < MAX_PARTY_SIZE) {
    party.push(clone(pokemon));
    const nextCollection = normalizeOwnedCollection({ party, boxes });
    return {
      collection: nextCollection,
      placedPokemon: nextCollection.party[nextCollection.party.length - 1],
    };
  }

  let targetBox = boxes.find((box) => box.pokemon.length < BOX_CAPACITY);
  if (!targetBox) {
    targetBox = {
      id: makeBoxId(boxes.length),
      label: makeBoxLabel(boxes.length),
      pokemon: [],
    };
    boxes.push(targetBox);
  }

  targetBox.pokemon.push(clone(pokemon));
  const nextCollection = normalizeOwnedCollection({ party, boxes });
  const placedBox = nextCollection.boxes.find((box) => box.id === targetBox.id) ?? nextCollection.boxes.at(-1);

  return {
    collection: nextCollection,
    placedPokemon: placedBox.pokemon[placedBox.pokemon.length - 1],
  };
}

function buildWalletState({
  kind,
  label,
  available = true,
  connected = false,
  address = null,
  publicKey = null,
  accountName = null,
  balanceBel = null,
  balanceRaw = null,
  balanceUnit = null,
  network = 'bells-testnet',
  providerPath = null,
  providerVersion = null,
  supportsMint = false,
  ownedPokemon = emptyOwnedPokemon(),
  ownedCollection = null,
  capabilities = [],
}) {
  const collection = ownedCollection ?? normalizeOwnedCollection({ ownedPokemon });
  return {
    kind,
    label,
    available,
    connected,
    address,
    publicKey,
    accountName,
    balanceBel,
    balanceRaw,
    balanceUnit,
    network,
    providerPath,
    providerVersion,
    supportsMint,
    capabilities,
    ownedPokemon: clone(collection.ownedPokemon),
    partyPokemon: clone(collection.party),
    boxedPokemon: clone(collection.boxedPokemon),
    boxes: clone(collection.boxes),
    ownedCount: collection.totalCount,
  };
}

async function invokeFirst(provider, methodNames, ...args) {
  // Each probed method swallows its own error (e.g. Nintondo wallet returns
  // code 4900 "provider disconnected from all chains" on getNetwork() when
  // the user just unlocked the extension but hasn't actively switched to a
  // chain yet). Without this guard, a single rejected promise kills the
  // entire state-sync pipeline upstream → Connect button never enables.
  for (const name of methodNames) {
    const fn = provider?.[name];
    if (typeof fn === 'function') {
      try {
        return await fn.apply(provider, args);
      } catch (error) {
        // Surface in console for debugging, but don't propagate. Adapter
        // upstream falls back to undefined → disconnected/available logic
        // continues to work and Connect remains clickable.
        if (typeof console !== 'undefined') {
          console.warn(`[wallet-adapter] ${name}() threw:`, error?.message ?? error);
        }
      }
    }
  }
  return undefined;
}

function resolveProviderInfo(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return {
      container: null,
      target: null,
      path: null,
    };
  }

  if (candidate.provider && typeof candidate.provider === 'object') {
    return {
      container: candidate,
      target: candidate.provider,
      path: 'window.nintondo.provider',
    };
  }

  return {
    container: candidate,
    target: candidate,
    path: 'window.nintondo',
  };
}

function normalizeBalanceValue(balanceResult) {
  if (typeof balanceResult !== 'number' || !Number.isFinite(balanceResult)) {
    return {
      balanceBel: null,
      balanceRaw: null,
      balanceUnit: null,
    };
  }

  if (Number.isInteger(balanceResult) && Math.abs(balanceResult) >= 1000000) {
    return {
      balanceBel: balanceResult / SATS_PER_BEL,
      balanceRaw: balanceResult,
      balanceUnit: 'sats',
    };
  }

  return {
    balanceBel: balanceResult,
    balanceRaw: balanceResult,
    balanceUnit: 'BEL',
  };
}

function listProviderMethods(provider) {
  if (!provider) {
    return [];
  }

  return Object.keys(provider)
    .filter((name) => typeof provider[name] === 'function')
    .sort();
}

function normalizeConnectTarget(network) {
  const value = String(network ?? '').trim();
  switch (value) {
    case 'mainnet':
    case 'bells-mainnet':
    case 'bellsMainnet':
      return 'bellsMainnet';
    case 'testnet':
    case 'bells-testnet':
    case 'bellsTestnet':
      return 'bellsTestnet';
    default:
      return value || 'bellsMainnet';
  }
}

function pickAddress(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (typeof candidate === 'string' && candidate.length) {
      return candidate;
    }
    if (typeof candidate === 'object') {
      if (typeof candidate.address === 'string' && candidate.address.length) {
        return candidate.address;
      }
      if (typeof candidate.account === 'string' && candidate.account.length) {
        return candidate.account;
      }
      if (typeof candidate.bech32 === 'string' && candidate.bech32.length) {
        return candidate.bech32;
      }
      if (Array.isArray(candidate.accounts) && candidate.accounts.length) {
        return pickAddress(candidate.accounts[0]);
      }
    }
    if (Array.isArray(candidate) && candidate.length) {
      return pickAddress(candidate[0]);
    }
  }
  return null;
}

function pickPublicKey(...candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (typeof candidate === 'object') {
      if (typeof candidate.publicKey === 'string' && candidate.publicKey.length) {
        return candidate.publicKey;
      }
      if (typeof candidate.pubkey === 'string' && candidate.pubkey.length) {
        return candidate.pubkey;
      }
    }
    if (typeof candidate === 'string' && candidate.length > 20) {
      return candidate;
    }
  }
  return null;
}

export function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

export function createMockWalletAdapter(options = {}) {
  const storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : createMemoryStorage());
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const network = options.network ?? 'bells-testnet';
  const initialBlock = options.initialBlock ?? 840240;
  const seed = options.seed ?? 'pokebells-mock-wallet';
  const label = options.label ?? 'Mock offline adapter';
  const signingDelayMs = options.signingDelayMs ?? 650;
  const pendingDelayMs = options.pendingDelayMs ?? 900;

  function buildState(rawState = {}) {
    const collection = normalizeOwnedCollection(rawState);
    return {
      connected: rawState.connected ?? false,
      address: rawState.address ?? makeAddressFromSeed(seed),
      publicKey: rawState.publicKey ?? `mock-pubkey-${seed}`,
      balanceBel: rawState.balanceBel ?? 123.456789,
      nextBlock: rawState.nextBlock ?? initialBlock,
      mintedCount: rawState.mintedCount ?? collection.totalCount,
      party: collection.party,
      boxes: collection.boxes,
    };
  }

  function loadState() {
    const raw = storage.getItem(storageKey);
    if (raw) {
      return buildState(JSON.parse(raw));
    }

    return buildState();
  }

  let state = loadState();

  function persist() {
    storage.setItem(storageKey, JSON.stringify(state));
  }

  function snapshot() {
    const collection = normalizeOwnedCollection(state);
    return buildWalletState({
      kind: 'mock',
      label,
      available: true,
      connected: state.connected,
      address: state.address,
      publicKey: state.publicKey,
      balanceBel: state.balanceBel,
      network,
      supportsMint: true,
      ownedCollection: collection,
      capabilities: ['connect', 'ownedPokemon', 'mint'],
    });
  }

  return {
    kind: 'mock',
    label,
    supportsMint: true,
    isAvailable() {
      return true;
    },
    async connectWallet() {
      state.connected = true;
      persist();
      return snapshot();
    },
    async disconnect() {
      state.connected = false;
      persist();
      return snapshot();
    },
    async getState() {
      return snapshot();
    },
    async getNetwork() {
      return network;
    },
    async getBalance() {
      return state.balanceBel;
    },
    async getPublicKey() {
      return state.connected ? state.publicKey : null;
    },
    async getAddress() {
      return state.connected ? state.address : null;
    },
    async getOwnedPokemon() {
      return clone(normalizeOwnedCollection(state).ownedPokemon);
    },
    async getOwnedCollection() {
      return clone(normalizeOwnedCollection(state));
    },
    async quoteMint(payload) {
      const payloadJson = JSON.stringify(payload);
      const payloadBytes = new TextEncoder().encode(payloadJson).byteLength;
      const networkFeeBel = Number((0.00012 + (payloadBytes / 1000000)).toFixed(6));
      return {
        mode: 'mock',
        networkFeeBel,
        inscriptionBytes: payloadBytes,
        estimatedBlocks: 1,
        note: 'Mock quote derived from payload size.',
      };
    },
    async mintPokemon(payload, options = {}) {
      if (!state.connected) {
        throw new Error('Connect the mock wallet before minting.');
      }

      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
      const quote = await this.quoteMint(payload);
      const txid = `mocktx${String(state.mintedCount + 1).padStart(6, '0')}`;

      onProgress({
        phase: 'signing',
        txid,
        quote,
        message: 'Mock signature modal accepted.',
      });
      await delay(signingDelayMs);

      onProgress({
        phase: 'pending',
        txid,
        quote,
        message: 'Mock inscription broadcast pending confirmation.',
      });
      await delay(pendingDelayMs);

      state.nextBlock += 1;
      state.mintedCount += 1;

      const inscriptionId = `${txid}i0`;
      const mintedPokemon = {
        ...clone(payload),
        inscription_id: inscriptionId,
        txid,
        minted_by: state.address,
        minted_at_block: state.nextBlock,
        mint_quote: quote,
        mint_status: 'confirmed',
        mock_wallet: true,
      };

      const { collection, placedPokemon } = placePokemonInCollection(
        normalizeOwnedCollection(state),
        mintedPokemon,
      );
      state.party = collection.party;
      state.boxes = collection.boxes;
      persist();
      onProgress({
        phase: 'confirmed',
        txid,
        quote,
        inscriptionId,
        message: 'Mock inscription confirmed.',
      });
      return clone(placedPokemon);
    },
    async reset() {
      storage.removeItem(storageKey);
      state = loadState();
      persist();
      return snapshot();
    },
  };
}

export function createNintondoWindowAdapter(options = {}) {
  const getProvider = options.getProvider ?? (() => (typeof window !== 'undefined' ? window.nintondo : null));
  const label = options.label ?? 'Nintondo extension';
  const fallbackNetwork = options.network ?? 'bells-testnet';
  const ownedPokemonProvider = options.getOwnedPokemon;
  const mintPokemonHandler = options.mintPokemon;
  const quoteMintHandler = options.quoteMint;

  const state = {
    connected: false,
    address: null,
    publicKey: null,
    accountName: null,
    balanceBel: null,
    balanceRaw: null,
    balanceUnit: null,
    network: fallbackNetwork,
    providerPath: null,
    providerVersion: null,
  };

  function providerInfo() {
    return resolveProviderInfo(getProvider() ?? null);
  }

  function provider() {
    return providerInfo().target;
  }

  async function refreshState() {
    const info = providerInfo();
    const ext = info.target;
    state.providerPath = info.path;
    if (!ext) {
      state.connected = false;
      state.address = null;
      state.publicKey = null;
      state.accountName = null;
      state.balanceBel = null;
      state.balanceRaw = null;
      state.balanceUnit = null;
      state.providerVersion = null;
      return null;
    }

    const network = await invokeFirst(ext, ['getNetwork']);
    if (typeof network === 'string' && network.length) {
      state.network = network;
    }

    const connectedResult = await invokeFirst(ext, ['isConnected']);
    const addressResult = await invokeFirst(ext, ['getAccount', 'getAddress', 'getCurrentAddress', 'getAccounts']);
    const publicKeyResult = await invokeFirst(ext, ['getPublicKey']);
    const accountNameResult = await invokeFirst(ext, ['getAccountName']);
    const versionResult = await invokeFirst(ext, ['getVersion']);
    const balanceResult = await invokeFirst(ext, ['getBalance']);
    const normalizedBalance = normalizeBalanceValue(balanceResult);
    const nextAddress = pickAddress(addressResult, publicKeyResult);
    const nextPublicKey = pickPublicKey(publicKeyResult, addressResult);

    state.address = nextAddress ?? state.address;
    state.publicKey = nextPublicKey ?? state.publicKey;
    state.accountName = typeof accountNameResult === 'string' && accountNameResult.length
      ? accountNameResult
      : state.accountName;
    state.providerVersion = typeof versionResult === 'string' && versionResult.length
      ? versionResult
      : state.providerVersion;
    state.balanceBel = normalizedBalance.balanceBel ?? state.balanceBel;
    state.balanceRaw = normalizedBalance.balanceRaw ?? state.balanceRaw;
    state.balanceUnit = normalizedBalance.balanceUnit ?? state.balanceUnit;
    state.connected = typeof connectedResult === 'boolean'
      ? connectedResult
      : Boolean(state.address || state.publicKey);
    return ext;
  }

  async function getOwnedPokemon() {
    const ext = provider();
    if (!ext || !state.connected) {
      return [];
    }

    if (typeof ownedPokemonProvider === 'function') {
      return clone(await ownedPokemonProvider({ address: state.address, provider: ext }));
    }

    const result = await invokeFirst(ext, ['getOwnedPokemon', 'getInscriptions']);
    return Array.isArray(result) ? clone(result) : [];
  }

  async function snapshot() {
    const ext = provider();
    const ownedPokemon = ext && state.connected ? await getOwnedPokemon() : [];
    const ownedCollection = normalizeOwnedCollection({ ownedPokemon });
    return buildWalletState({
      kind: 'nintondo',
      label,
      available: Boolean(ext),
      connected: state.connected,
      address: state.address,
      publicKey: state.publicKey,
      accountName: state.accountName,
      balanceBel: state.balanceBel,
      balanceRaw: state.balanceRaw,
      balanceUnit: state.balanceUnit,
      network: state.network,
      providerPath: state.providerPath,
      providerVersion: state.providerVersion,
      supportsMint: typeof mintPokemonHandler === 'function',
      ownedCollection,
      capabilities: [
        'connect',
        'ownedPokemon',
        typeof ext?.signMessage === 'function' ? 'signMessage' : 'signMessage-missing',
        typeof mintPokemonHandler === 'function' ? 'mint' : 'mint-pending',
      ],
    });
  }

  return {
    kind: 'nintondo',
    label,
    get supportsMint() {
      return typeof mintPokemonHandler === 'function';
    },
    isAvailable() {
      return Boolean(provider());
    },
    async connectWallet() {
      const ext = provider();
      if (!ext) {
        throw new Error('window.nintondo is not available in this context.');
      }

      const connectTarget = normalizeConnectTarget(options.connectTarget ?? fallbackNetwork);
      const connectResult = await invokeFirst(ext, ['connect', 'enable'], connectTarget);
      state.address = pickAddress(connectResult, state.address);
      state.publicKey = pickPublicKey(connectResult, state.publicKey);
      state.connected = true;
      await refreshState();
      return snapshot();
    },
    async disconnect() {
      const ext = provider();
      if (ext) {
        await invokeFirst(ext, ['disconnect']);
      }
      state.connected = false;
      state.address = null;
      state.publicKey = null;
      return snapshot();
    },
    async getState() {
      await refreshState();
      return snapshot();
    },
    async getNetwork() {
      await refreshState();
      return state.network;
    },
    async getBalance() {
      await refreshState();
      return state.balanceBel;
    },
    async getPublicKey() {
      await refreshState();
      return state.publicKey;
    },
    async getAddress() {
      await refreshState();
      return state.address;
    },
    async getOwnedPokemon() {
      await refreshState();
      return getOwnedPokemon();
    },
    async getOwnedCollection() {
      await refreshState();
      return normalizeOwnedCollection({ ownedPokemon: await getOwnedPokemon() });
    },
    async probeProvider() {
      const info = providerInfo();
      const ext = info.target;
      await refreshState();
      return {
        available: Boolean(ext),
        providerPath: info.path,
        methods: listProviderMethods(ext),
        connected: state.connected,
        address: state.address,
        publicKey: state.publicKey,
        accountName: state.accountName,
        network: state.network,
        balanceBel: state.balanceBel,
        balanceRaw: state.balanceRaw,
        balanceUnit: state.balanceUnit,
        providerVersion: state.providerVersion,
      };
    },
    async signMessage(message) {
      const ext = provider();
      if (!ext) {
        throw new Error('window.nintondo is not available in this context.');
      }
      if (typeof ext.signMessage !== 'function') {
        throw new Error('Nintondo provider does not expose signMessage().');
      }
      return ext.signMessage(String(message));
    },
    async quoteMint(payload) {
      if (typeof quoteMintHandler === 'function') {
        const ext = provider();
        return clone(await quoteMintHandler({ payload: clone(payload), provider: ext }));
      }

      const payloadJson = JSON.stringify(payload);
      const payloadBytes = new TextEncoder().encode(payloadJson).byteLength;
      return {
        mode: 'nintondo-placeholder',
        networkFeeBel: null,
        inscriptionBytes: payloadBytes,
        estimatedBlocks: null,
        note: 'Real fee quote will come from the Nintondo flow once calculateFee is wired.',
      };
    },
    async mintPokemon(payload, options = {}) {
      if (typeof mintPokemonHandler === 'function') {
        const ext = provider();
        return clone(await mintPokemonHandler({
          payload: clone(payload),
          provider: ext,
          onProgress: options.onProgress,
        }));
      }
      throw new Error('Real Nintondo mint flow is not wired yet.');
    },
    async reset() {
      return this.disconnect();
    },
  };
}

export function createWalletAdapterRegistry(options = {}) {
  const mock = createMockWalletAdapter(options.mock);
  const nintondo = createNintondoWindowAdapter(options.nintondo);

  const adapters = new Map([
    [mock.kind, mock],
    [nintondo.kind, nintondo],
  ]);

  let currentKind = options.defaultKind ?? (nintondo.isAvailable() ? nintondo.kind : mock.kind);

  return {
    listAdapters() {
      return Array.from(adapters.values()).map((adapter) => ({
        kind: adapter.kind,
        label: adapter.label,
        available: adapter.isAvailable(),
        supportsMint: Boolean(adapter.supportsMint),
      }));
    },
    getCurrentAdapter() {
      return adapters.get(currentKind) ?? mock;
    },
    setCurrentAdapter(kind) {
      if (!adapters.has(kind)) {
        throw new Error(`Unknown wallet adapter: ${kind}`);
      }
      currentKind = kind;
      return this.getCurrentAdapter();
    },
    getAdapter(kind) {
      return adapters.get(kind) ?? null;
    },
  };
}

const browserExports = {
  createMemoryStorage,
  createMockWalletAdapter,
  createNintondoWindowAdapter,
  createWalletAdapterRegistry,
  normalizeOwnedCollection,
};

if (typeof window !== 'undefined') {
  window.PokeBellsWalletAdapters = browserExports;
}
