import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCanonicalSigninChallenge,
  extractInscriptionIdFromLocation,
  fetchOwnedPokebellsCollection,
  parseSigninParamsFromLocation,
  resolveBellsServices,
} from './signin-verify.mjs';

const INSCRIPTION_ID = '58bf94bfb7214a783656e792dc39490e2a70dd59e9c9221c923f0e4300407681i0';
const JSON_INSCRIPTION_ID = 'ac19a21f89bdd827fdd827bd4d5d853cea0e328b0592e9ef47792e733b4e94d4i0';
const OTHER_JSON_INSCRIPTION_ID = '2a870579db49900a0788a14fb378c68bc939fc1826f25e250c8fa0356d2fea93i0';

test('parseSigninParamsFromLocation derives the inscription id from the viewer URL', () => {
  const params = parseSigninParamsFromLocation({
    pathname: `/bells/inscriptions/${INSCRIPTION_ID}`,
    search: '?wallet=bel1pq89re30lzrj5m3sp9wx47svz6a6pj0kg2yudynaxzz3p30ld97qsvgw8s5&sig=abc123&issued=1700000000000&expires=1700086400000&nonce=42',
  });

  assert.equal(params.inscriptionId, INSCRIPTION_ID);
  assert.equal(params.wallet, 'bel1pq89re30lzrj5m3sp9wx47svz6a6pj0kg2yudynaxzz3p30ld97qsvgw8s5');
  assert.equal(params.signature, 'abc123');
  assert.equal(params.issuedMs, 1700000000000);
  assert.equal(params.expiresMs, 1700086400000);
  assert.equal(params.nonce, '42');

  assert.equal(buildCanonicalSigninChallenge(params), [
    'pokebells:signin:v1',
    INSCRIPTION_ID,
    params.wallet,
    '1700000000000',
    '1700086400000',
    '42',
  ].join(':'));
});

test('extractInscriptionIdFromLocation supports content-host paths and query overrides', () => {
  assert.equal(extractInscriptionIdFromLocation({
    pathname: `/html/${INSCRIPTION_ID}`,
    search: '',
  }), INSCRIPTION_ID);

  assert.equal(extractInscriptionIdFromLocation({
    pathname: '/phase1/',
    search: `?inscription_id=${JSON_INSCRIPTION_ID}`,
  }), JSON_INSCRIPTION_ID);
});

test('parseSigninParamsFromLocation rejects incomplete signed URLs', () => {
  assert.throws(() => parseSigninParamsFromLocation({
    pathname: `/bells/inscriptions/${INSCRIPTION_ID}`,
    search: '?wallet=bel1abc&sig=abc123',
  }), /Incomplete sign-in URL/);
});

test('fetchOwnedPokebellsCollection uses owner search and filters content by protocol tag', async () => {
  const requests = [];
  const owner = 'bel1pq89re30lzrj5m3sp9wx47svz6a6pj0kg2yudynaxzz3p30ld97qsvgw8s5';

  const fetchImpl = async (url, options = {}) => {
    requests.push({
      url,
      method: options.method ?? 'GET',
      body: options.body ?? null,
    });

    if (url === 'https://bells-mainnet-search.nintondo.io/pub/search') {
      const parsedBody = JSON.parse(options.body);
      assert.equal(parsedBody.owner, owner);
      assert.equal(parsedBody.page_size, 100);
      assert.equal(parsedBody.page, 1);
      return new Response(JSON.stringify({
        pages: 1,
        inscriptions: [
          { id: JSON_INSCRIPTION_ID, file_type: 'JSON' },
          { id: INSCRIPTION_ID, file_type: 'HTML' },
          { id: OTHER_JSON_INSCRIPTION_ID, file_type: 'JSON' },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url === `https://bells-mainnet-content.nintondo.io/content/${JSON_INSCRIPTION_ID}`) {
      return new Response(JSON.stringify({
        p: 'pokebells',
        species: 25,
        species_name: 'Pikachu',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url === `https://bells-mainnet-content.nintondo.io/content/${OTHER_JSON_INSCRIPTION_ID}`) {
      return new Response(JSON.stringify({
        p: 'not-pokebells',
        species: 1,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const collection = await fetchOwnedPokebellsCollection(owner, {
    fetchImpl,
    network: 'bells-mainnet',
  });

  assert.equal(collection.source, 'owner-search');
  assert.deepEqual(collection.inscriptionIds, [
    JSON_INSCRIPTION_ID,
    OTHER_JSON_INSCRIPTION_ID,
  ]);
  assert.equal(collection.records.length, 1);
  assert.equal(collection.records[0].p, 'pokebells');
  assert.equal(collection.records[0].inscription_id, JSON_INSCRIPTION_ID);
  assert.equal(
    requests.filter((request) => request.url.includes('/content/')).length,
    2,
  );
});

test('resolveBellsServices infers Bells mainnet from a bel1 address', () => {
  const services = resolveBellsServices({
    address: 'bel1pq89re30lzrj5m3sp9wx47svz6a6pj0kg2yudynaxzz3p30ld97qsvgw8s5',
  });

  assert.equal(services.key, 'bells-mainnet');
  assert.equal(services.searchBaseUrl, 'https://bells-mainnet-search.nintondo.io/pub');
});
