import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMemoryStorage,
  createMockWalletAdapter,
  createNintondoWindowAdapter,
  createWalletAdapterRegistry,
} from './wallet-adapter.mjs';

test('mock wallet adapter connects and persists minted Pokemon', async () => {
  const storage = createMemoryStorage();
  const adapter = createMockWalletAdapter({
    storage,
    seed: 'phase1-test',
    initialBlock: 900000,
    signingDelayMs: 0,
    pendingDelayMs: 0,
  });

  let state = await adapter.connectWallet();
  assert.equal(state.connected, true);
  assert.equal(state.network, 'bells-testnet');
  assert.match(state.address, /^tb1p/);
  assert.equal(state.supportsMint, true);

  const quote = await adapter.quoteMint({
    schema_version: '1.1',
    species: 25,
    species_name: 'Pikachu',
  });
  assert.equal(quote.mode, 'mock');
  assert.equal(typeof quote.networkFeeBel, 'number');

  const phases = [];
  const minted = await adapter.mintPokemon({
    schema_version: '1.1',
    species: 25,
    species_name: 'Pikachu',
    catch_rate: 190,
  }, {
    onProgress(event) {
      phases.push(event.phase);
    },
  });

  assert.equal(minted.species, 25);
  assert.equal(minted.species_name, 'Pikachu');
  assert.equal(minted.minted_at_block, 900001);
  assert.equal(minted.inscription_id, 'mocktx000001i0');
  assert.equal(minted.txid, 'mocktx000001');
  assert.equal(minted.active, true);
  assert.equal(minted.storage.location, 'party');
  assert.deepEqual(phases, ['signing', 'pending', 'confirmed']);

  state = await adapter.getState();
  assert.equal(state.ownedPokemon.length, 1);
  assert.equal(state.partyPokemon.length, 1);
  assert.equal(state.boxedPokemon.length, 0);

  const reloaded = createMockWalletAdapter({
    storage,
    seed: 'phase1-test',
    initialBlock: 900000,
    signingDelayMs: 0,
    pendingDelayMs: 0,
  });
  const owned = await reloaded.getOwnedPokemon();
  assert.equal(owned.length, 1);
  assert.equal(owned[0].inscription_id, 'mocktx000001i0');
  const collection = await reloaded.getOwnedCollection();
  assert.equal(collection.party.length, 1);
  assert.equal(collection.boxedPokemon.length, 0);
});

test('mock wallet fills party first, then places overflow into boxes', async () => {
  const adapter = createMockWalletAdapter({
    storage: createMemoryStorage(),
    seed: 'phase1-overflow',
    initialBlock: 910000,
    signingDelayMs: 0,
    pendingDelayMs: 0,
  });

  await adapter.connectWallet();

  let overflowMint = null;
  for (let index = 1; index <= 27; index += 1) {
    const minted = await adapter.mintPokemon({
      schema_version: '1.1',
      species: index,
      species_name: `Testmon ${index}`,
      catch_rate: 45 + index,
    });

    if (index === 27) {
      overflowMint = minted;
    }
  }

  const collection = await adapter.getOwnedCollection();
  assert.equal(collection.party.length, 6);
  assert.equal(collection.boxedPokemon.length, 21);
  assert.equal(collection.boxes.length, 2);
  assert.equal(collection.boxes[0].pokemon.length, 20);
  assert.equal(collection.boxes[1].pokemon.length, 1);
  assert.equal(overflowMint.active, false);
  assert.equal(overflowMint.storage.location, 'box');
  assert.equal(overflowMint.storage.box_index, 2);
  assert.equal(overflowMint.storage.slot, 1);
});

test('mock wallet migrates legacy flat ownedPokemon storage into party and boxes', async () => {
  const storage = createMemoryStorage();
  storage.setItem('legacy-wallet', JSON.stringify({
    connected: true,
    address: 'tb1plegacywallet0001',
    mintedCount: 7,
    nextBlock: 920007,
    ownedPokemon: Array.from({ length: 7 }, (_, index) => ({
      inscription_id: `legacytx${index + 1}i0`,
      species: index + 1,
      species_name: `Legacy ${index + 1}`,
      minted_at_block: 920001 + index,
    })),
  }));

  const adapter = createMockWalletAdapter({
    storage,
    storageKey: 'legacy-wallet',
    seed: 'legacy-wallet',
    signingDelayMs: 0,
    pendingDelayMs: 0,
  });

  const collection = await adapter.getOwnedCollection();
  assert.equal(collection.party.length, 6);
  assert.equal(collection.boxedPokemon.length, 1);
  assert.equal(collection.boxes[0].pokemon[0].species_name, 'Legacy 7');
});

test('nintondo adapter wraps a provider with the same interface', async () => {
  const provider = {
    async connect(network) {
      return { address: 'tb1pwindowadapter0001', publicKey: `pub-${network}` };
    },
    async getBalance() {
      return 750000000;
    },
    async getNetwork() {
      return 'bells-testnet';
    },
    async getVersion() {
      return '0.3.4';
    },
    async getAccountName() {
      return 'Account 1';
    },
    async isConnected() {
      return true;
    },
    async getOwnedPokemon() {
      return [{ inscription_id: 'tx1i0', species: 25, species_name: 'Pikachu' }];
    },
    async signMessage(message) {
      return `sig:${message}`;
    },
    async disconnect() {
      return true;
    },
  };

  const adapter = createNintondoWindowAdapter({
    getProvider() {
      return provider;
    },
  });

  assert.equal(adapter.isAvailable(), true);
  const connected = await adapter.connectWallet();
  assert.equal(connected.connected, true);
  assert.equal(connected.address, 'tb1pwindowadapter0001');
  assert.equal(connected.balanceBel, 7.5);
  assert.equal(connected.balanceRaw, 750000000);
  assert.equal(connected.balanceUnit, 'sats');
  assert.equal(connected.providerVersion, '0.3.4');
  assert.equal(connected.accountName, 'Account 1');
  assert.equal(connected.ownedPokemon.length, 1);
  assert.equal(connected.partyPokemon.length, 1);

  const quote = await adapter.quoteMint({ species: 25, species_name: 'Pikachu' });
  assert.equal(quote.mode, 'nintondo-placeholder');

  const probe = await adapter.probeProvider();
  assert.equal(probe.available, true);
  assert.equal(probe.providerPath, 'window.nintondo');
  assert.equal(probe.providerVersion, '0.3.4');
  assert.equal(probe.accountName, 'Account 1');
  assert.match(probe.methods.join(','), /connect/);
  assert.match(probe.methods.join(','), /signMessage/);

  const signature = await adapter.signMessage('hello');
  assert.equal(signature, 'sig:hello');

  const collection = await adapter.getOwnedCollection();
  assert.equal(collection.party.length, 1);
  assert.equal(collection.boxedPokemon.length, 0);

  const disconnected = await adapter.disconnect();
  assert.equal(disconnected.connected, false);
});

test('nintondo adapter resolves window.nintondo.provider shape', async () => {
  let connectNetwork = null;
  const adapter = createNintondoWindowAdapter({
    getProvider() {
      return {
        provider: {
          async connect(network) {
            connectNetwork = network;
            return 'bel1providernested0001';
          },
          async isConnected() {
            return true;
          },
          async getAccount() {
            return 'bel1providernested0001';
          },
          async getNetwork() {
            return 'mainnet';
          },
          async getVersion() {
            return '0.3.10';
          },
          async getBalance() {
            return 20000000000;
          },
        },
      };
    },
  });

  const state = await adapter.connectWallet();
  assert.equal(state.connected, true);
  assert.equal(state.address, 'bel1providernested0001');
  assert.equal(connectNetwork, 'bellsTestnet');
  assert.equal(state.providerPath, 'window.nintondo.provider');
  assert.equal(state.providerVersion, '0.3.10');
  assert.equal(state.balanceBel, 200);
  assert.equal(state.balanceUnit, 'sats');

  const probe = await adapter.probeProvider();
  assert.equal(probe.providerPath, 'window.nintondo.provider');
  assert.equal(probe.network, 'mainnet');
});

test('wallet registry auto-selects available providers and can switch back to mock', async () => {
  const registry = createWalletAdapterRegistry({
    mock: {
      storage: createMemoryStorage(),
      seed: 'registry-test',
    },
    nintondo: {
      getProvider() {
        return {
          async connect() {
            return { address: 'tb1pregistry0001' };
          },
          async getNetwork() {
            return 'bells-testnet';
          },
        };
      },
    },
  });

  assert.equal(registry.getCurrentAdapter().kind, 'nintondo');
  registry.setCurrentAdapter('mock');
  const mockAdapter = registry.getCurrentAdapter();
  assert.equal(mockAdapter.kind, 'mock');

  const state = await mockAdapter.connectWallet();
  assert.equal(state.connected, true);
  assert.match(state.address, /^tb1p/);
});
