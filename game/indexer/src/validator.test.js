// Smoke tests for the indexer validator. Exercises the schema stage of
// each main public export to unblock `npm test` as a CI gate (see
// game/MAINNET-PLAN.md). Full cryptographic coverage lives in
// game/capture-core.test.mjs — the validator reuses those canonical
// builders so we don't duplicate the crypto matrix here.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCapture,
  validateCollection,
  validateCollectionUpdate,
  validateMintV1_5,
  validateSaveSnapshot,
  validateReveal,
  verifyCollectionUpdateAuthority,
} from "./validator.js";

// Schema-stage rejections happen before any env access, so passing a stub
// env is sufficient. Crypto / provenance stages need a real env + DB and
// are out of scope for these smoke tests.
const STUB_ENV = {};

test("validateCapture rejects non-object inputs", async () => {
  const r1 = await validateCapture(null, STUB_ENV);
  assert.equal(r1.ok, false);
  assert.equal(r1.stage, "schema");

  const r2 = await validateCapture("not an object", STUB_ENV);
  assert.equal(r2.ok, false);

  const r3 = await validateCapture(undefined, STUB_ENV);
  assert.equal(r3.ok, false);
});

test('validateCapture rejects missing p="pokebells"', async () => {
  const r = await validateCapture({ op: "capture" }, STUB_ENV);
  assert.equal(r.ok, false);
  assert.match(r.reason, /"p".*pokebells/);
});

test('validateCapture rejects op != "capture"', async () => {
  const r = await validateCapture({ p: "pokebells", op: "mint" }, STUB_ENV);
  assert.equal(r.ok, false);
  assert.match(r.reason, /"op".*capture/);
});

test("validateCapture rejects unsupported schema_version", async () => {
  const r = await validateCapture({
    p: "pokebells", op: "capture", schema_version: "9.9",
  }, STUB_ENV);
  assert.equal(r.ok, false);
  assert.match(r.reason, /schema_version/);
});

test("validateCapture rejects species_id outside Gen 2 range", async () => {
  const lo = await validateCapture({
    p: "pokebells", op: "capture", schema_version: "1.3",
    species_id: 0, level: 5,
  }, STUB_ENV);
  assert.equal(lo.ok, false);
  assert.match(lo.reason, /species_id/);

  const hi = await validateCapture({
    p: "pokebells", op: "capture", schema_version: "1.3",
    species_id: 252, level: 5,
  }, STUB_ENV);
  assert.equal(hi.ok, false);
});

test("validateCapture rejects level outside [1..100]", async () => {
  const r = await validateCapture({
    p: "pokebells", op: "capture", schema_version: "1.3",
    species_id: 25, level: 101,
  }, STUB_ENV);
  assert.equal(r.ok, false);
  assert.match(r.reason, /level/);
});

test('validateCapture rejects mismatched "species" vs "species_id"', async () => {
  const r = await validateCapture({
    p: "pokebells", op: "capture", schema_version: "1.3",
    species_id: 25, species: 26, level: 5,
  }, STUB_ENV);
  assert.equal(r.ok, false);
  assert.match(r.reason, /species.*species_id/);
});

test("validateMintV1_5 rejects non-mint objects", async () => {
  const r1 = await validateMintV1_5({ p: "wrong" }, null, STUB_ENV);
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /mint must have p:pokebells op:mint/);

  const r2 = await validateMintV1_5(null, null, STUB_ENV);
  assert.equal(r2.ok, false);
});

test("validateMintV1_5 rejects when the capture_commit row is missing", async () => {
  const r = await validateMintV1_5(
    { p: "pokebells", op: "mint" },
    null,
    STUB_ENV,
  );
  assert.equal(r.ok, false);
  assert.equal(r.stage, "reference");
  assert.match(r.reason, /capture_commit row not found/);
});

test("validateSaveSnapshot rejects schema drift", async () => {
  const r1 = await validateSaveSnapshot(null, STUB_ENV);
  assert.equal(r1.ok, false);

  const r2 = await validateSaveSnapshot({ p: "wrong" }, STUB_ENV);
  assert.equal(r2.ok, false);

  const r3 = await validateSaveSnapshot({
    p: "pokebells", op: "save-snapshot", sram_encoding: "hex",
  }, STUB_ENV);
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /sram_encoding/);
});

test("validateSaveSnapshot rejects missing signed_in_wallet", async () => {
  const r = await validateSaveSnapshot({
    p: "pokebells", op: "save-snapshot",
    sram_encoding: "base64",
    save_scheme: "base64:raw-sram-32k:v1",
  }, STUB_ENV);
  assert.equal(r.ok, false);
  assert.match(r.reason, /signed_in_wallet/);
});

test("validateSaveSnapshot rejects non-positive save_version", async () => {
  const r = await validateSaveSnapshot({
    p: "pokebells", op: "save-snapshot",
    sram_encoding: "base64",
    save_scheme: "base64:raw-sram-32k:v1",
    signed_in_wallet: "tb1pwallet",
    save_version: 0,
  }, STUB_ENV);
  assert.equal(r.ok, false);
  assert.match(r.reason, /save_version/);
});

test("validateReveal rejects schema drift", async () => {
  const r1 = await validateReveal(null, null, STUB_ENV);
  assert.equal(r1.ok, false);

  const r2 = await validateReveal({ p: "wrong" }, null, STUB_ENV);
  assert.equal(r2.ok, false);

  const r3 = await validateReveal({
    p: "pokebells", op: "reveal", schema_version: "1.3",
  }, null, STUB_ENV);
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /schema_version/);
});

test("validateReveal rejects when the capture row is missing", async () => {
  const r = await validateReveal({
    p: "pokebells", op: "reveal", schema_version: "1.4",
  }, null, STUB_ENV);
  assert.equal(r.ok, false);
  assert.equal(r.stage, "reference");
  assert.match(r.reason, /capture row not found/);
});

test("validateReveal rejects captures with no commitment (v1.3 legacy)", async () => {
  const r = await validateReveal(
    { p: "pokebells", op: "reveal", schema_version: "1.4" },
    { ivs_commitment: null, ram_snapshot_hash: null },
    STUB_ENV,
  );
  assert.equal(r.ok, false);
  assert.match(r.reason, /no commitment/);
});

// ============================================================================
// p:pokebells-collection — Phase A (schema extension) validator
// ============================================================================

function makeValidCollection(overrides = {}) {
  return {
    p: "pokebells-collection",
    v: 1,
    name: "PokeBells",
    slug: "pokebells",
    description: "Pokemon Crystal on-chain captures — Bells ordinals.",
    website: "https://bellforge.app/pokebells/",
    networks: ["bells-mainnet", "bells-testnet"],
    schema: {
      capture_commit: "p:pokebells + op:capture_commit",
      mint: "p:pokebells + op:mint",
      evolve: "p:pokebells + op:evolve",
    },
    indexer_urls: ["https://pokebells-indexer.example.workers.dev"],
    companion_urls: ["https://bellforge.app/pokebells/"],
    bridge_urls: ["https://bellforge.app/pokebells/play-bridge.html"],
    root_app_urls: [],
    app_manifest_ids: [`${"a".repeat(64)}i0`],
    update_authority: {
      scheme: "sat-spend-v1",
      comment: "Valid update must spend the collection sat.",
    },
    license: "MIT",
    ...overrides,
  };
}

test("validateCollection accepts a valid baseline (Phase A shape)", () => {
  const r = validateCollection(makeValidCollection());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.normalized.slug, "pokebells");
  assert.equal(r.normalized.update_authority.scheme, "sat-spend-v1");
  assert.equal(r.normalized.root_app_urls.length, 0);
  assert.equal(r.normalized.app_manifest_ids.length, 1);
});

test("validateCollection accepts root_app_urls empty at initial mint", () => {
  // Mint choreography: collection is minted before the root HTML, so
  // root_app_urls starts empty and the first op:"collection_update"
  // prepends the URL after the root is inscribed.
  const r = validateCollection(makeValidCollection({ root_app_urls: [] }));
  assert.equal(r.ok, true);
});

test("validateCollection accepts REPLACE_ placeholder in app_manifest_ids", () => {
  // Pre-mint template bodies carry placeholders; tooling replaces them
  // with real inscription ids before broadcasting.
  const r = validateCollection(makeValidCollection({
    app_manifest_ids: ["REPLACE_WITH_MANIFEST_V1_INSCRIPTION_ID_BEFORE_MINT"],
  }));
  assert.equal(r.ok, true);
});

test("validateCollection rejects non-object inputs", () => {
  assert.equal(validateCollection(null).ok, false);
  assert.equal(validateCollection("not an object").ok, false);
  assert.equal(validateCollection(undefined).ok, false);
});

test("validateCollection rejects wrong p or v", () => {
  const r1 = validateCollection(makeValidCollection({ p: "wrong" }));
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /p must equal/);

  const r2 = validateCollection(makeValidCollection({ v: 2 }));
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /v must equal 1/);
});

test("validateCollection rejects missing name or slug", () => {
  const r1 = validateCollection(makeValidCollection({ name: "" }));
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /name/);

  const r2 = validateCollection(makeValidCollection({ slug: undefined }));
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /slug/);
});

test("validateCollection rejects non-array required list fields", () => {
  for (const key of [
    "indexer_urls", "companion_urls", "bridge_urls",
    "root_app_urls", "app_manifest_ids",
  ]) {
    const r = validateCollection(makeValidCollection({ [key]: "not an array" }));
    assert.equal(r.ok, false, `expected ${key} string to be rejected`);
    assert.match(r.reason, new RegExp(key));
  }
});

test("validateCollection rejects malformed URL entries", () => {
  const r = validateCollection(makeValidCollection({
    indexer_urls: ["not a url"],
  }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /indexer_urls\[0\]/);
});

test("validateCollection rejects malformed inscription ids", () => {
  const r = validateCollection(makeValidCollection({
    app_manifest_ids: ["not-a-hex-inscription-id"],
  }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /app_manifest_ids\[0\]/);
});

test("validateCollection rejects missing or wrong update_authority", () => {
  const r1 = validateCollection(makeValidCollection({ update_authority: null }));
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /update_authority/);

  const r2 = validateCollection(makeValidCollection({
    update_authority: { scheme: "signmessage-v1" },
  }));
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /sat-spend-v1/);
});

test("validateCollection rejects empty or unknown networks", () => {
  const r1 = validateCollection(makeValidCollection({ networks: [] }));
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /networks/);

  const r2 = validateCollection(makeValidCollection({
    networks: ["btc-mainnet"],
  }));
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /bells-mainnet/);
});

test("validateCollection normalized output is a deep copy, not aliases", () => {
  const body = makeValidCollection();
  const r = validateCollection(body);
  assert.equal(r.ok, true);
  // Mutating the input must not leak into the normalized view.
  body.indexer_urls.push("https://leaked.example/");
  assert.equal(r.normalized.indexer_urls.length, 1);
});

// ============================================================================
// op:"collection_update" validator (Phase B)
// ============================================================================

const UPDATE_COLLECTION_ID = `${"1".repeat(64)}i0`;
const UPDATE_MANIFEST_ID = `${"2".repeat(64)}i0`;

function makeValidUpdate(overrides = {}) {
  return {
    p: "pokebells",
    op: "collection_update",
    v: 1,
    network: "bells-testnet",
    collection_inscription_id: UPDATE_COLLECTION_ID,
    update_sequence: 5,
    issued_at: "2026-06-01T12:00:00.000Z",
    set: { app_manifest_ids_prepend: [UPDATE_MANIFEST_ID] },
    ...overrides,
  };
}

test("validateCollectionUpdate accepts a valid baseline", () => {
  const r = validateCollectionUpdate(makeValidUpdate());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.normalized.update_sequence, 5);
  assert.deepEqual(
    r.normalized.set.app_manifest_ids_prepend,
    [UPDATE_MANIFEST_ID],
  );
});

test("validateCollectionUpdate rejects wrong p / op / v", () => {
  assert.equal(validateCollectionUpdate(makeValidUpdate({ p: "wrong" })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({ op: "capture" })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({ v: 2 })).ok, false);
});

test("validateCollectionUpdate rejects wrong network", () => {
  const r = validateCollectionUpdate(makeValidUpdate({ network: "btc-mainnet" }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /network/);
});

test("validateCollectionUpdate rejects malformed collection_inscription_id", () => {
  const r = validateCollectionUpdate(makeValidUpdate({
    collection_inscription_id: "not-an-id",
  }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /collection_inscription_id/);
});

test("validateCollectionUpdate rejects non-positive update_sequence", () => {
  assert.equal(validateCollectionUpdate(makeValidUpdate({ update_sequence: 0 })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({ update_sequence: -1 })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({ update_sequence: 1.5 })).ok, false);
});

test("validateCollectionUpdate rejects empty or missing issued_at", () => {
  assert.equal(validateCollectionUpdate(makeValidUpdate({ issued_at: "" })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({ issued_at: null })).ok, false);
});

test("validateCollectionUpdate rejects empty or non-object set", () => {
  assert.equal(validateCollectionUpdate(makeValidUpdate({ set: null })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({ set: [] })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({ set: {} })).ok, false);
});

test("validateCollectionUpdate rejects set keys outside the v1 allowlist", () => {
  // Scalar replacements must be rejected — force new-collection-root for those.
  const r1 = validateCollectionUpdate(makeValidUpdate({ set: { slug: "new" } }));
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /not in v1 allowlist/);

  // Missing _prepend suffix => rejected even if the base key is a valid list.
  const r2 = validateCollectionUpdate(makeValidUpdate({
    set: { indexer_urls: ["https://x.example/"] },
  }));
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /not in v1 allowlist/);
});

test("validateCollectionUpdate rejects non-array or empty set values", () => {
  assert.equal(validateCollectionUpdate(makeValidUpdate({
    set: { app_manifest_ids_prepend: "not-an-array" },
  })).ok, false);
  assert.equal(validateCollectionUpdate(makeValidUpdate({
    set: { app_manifest_ids_prepend: [] },
  })).ok, false);
});

test("validateCollectionUpdate rejects non-inscription-id entries in app_manifest_ids_prepend", () => {
  const r = validateCollectionUpdate(makeValidUpdate({
    set: { app_manifest_ids_prepend: ["not-an-id"] },
  }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /inscription id/);
});

test("validateCollectionUpdate rejects non-URL entries in *_urls_prepend", () => {
  const r = validateCollectionUpdate(makeValidUpdate({
    set: { indexer_urls_prepend: ["not-a-url"] },
  }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /URL/);
});

test("validateCollectionUpdate normalized set is a deep copy", () => {
  const body = makeValidUpdate();
  const r = validateCollectionUpdate(body);
  body.set.app_manifest_ids_prepend.push(`${"z".repeat(64)}i0`);
  assert.equal(r.normalized.set.app_manifest_ids_prepend.length, 1);
});

// ============================================================================
// sat-spend-v1 authority check (Phase B)
// ============================================================================

const UPDATE_INSCRIPTION_ID = `${"a".repeat(64)}i0`;
const UPDATE_REVEAL_TXID = "a".repeat(64);
const UPDATE_COMMIT_TXID = "b".repeat(64);
const EXPECTED_SATPOINT = { revealTxid: "c".repeat(64), vout: 0 };

function makeFetchTx({ reveal = {}, commit = {}, fail = {} } = {}) {
  // Default reveal: spends commit output 0 (ordinals convention) and has
  // one output at vout 0 (the inscription destination).
  const defaultReveal = {
    vin: [{ txid: UPDATE_COMMIT_TXID, vout: 0 }],
    vout: [{ value: 1000 }],
  };
  // Default commit: inscription UTXO at vin[0] (satisfies v1 strict
  // position rule), funding change at vin[1].
  const defaultCommit = {
    vin: [
      { txid: EXPECTED_SATPOINT.revealTxid, vout: EXPECTED_SATPOINT.vout },
      { txid: "d".repeat(64), vout: 1 },
    ],
  };
  return async (txid) => {
    if (fail[txid]) throw new Error(fail[txid]);
    if (txid === UPDATE_REVEAL_TXID) return { ...defaultReveal, ...reveal };
    if (txid === UPDATE_COMMIT_TXID) return { ...defaultCommit, ...commit };
    throw new Error(`unexpected fetchTx for ${txid}`);
  };
}

test("verifyCollectionUpdateAuthority passes when commit tx spends expected satpoint", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx(),
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.commit_txid, UPDATE_COMMIT_TXID);
  assert.equal(r.reveal_txid, UPDATE_REVEAL_TXID);
});

test("verifyCollectionUpdateAuthority rejects when commit tx does NOT spend expected satpoint", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: { revealTxid: "e".repeat(64), vout: 0 },  // not in mock
    network: "bells-testnet",
    fetchTx: makeFetchTx(),
  });
  assert.equal(r.ok, false);
  assert.equal(r.stage, "authority");
  assert.match(r.reason, /vin\[0\] did not match/);
  assert.match(r.reason, /anywhere_in_vin=false/);
});

test("verifyCollectionUpdateAuthority rejects when satpoint is in vin but NOT at position 0 (v1 strict)", async () => {
  // Default mock has satpoint at vin[0]. Swap: put satpoint at vin[1]
  // and an unrelated outpoint at vin[0]. The old "some()" check would
  // pass; v1 strict MUST reject.
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx({
      commit: {
        vin: [
          { txid: "d".repeat(64), vout: 1 },
          { txid: EXPECTED_SATPOINT.revealTxid, vout: EXPECTED_SATPOINT.vout },
        ],
      },
    }),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /vin\[0\] did not match/);
  assert.match(r.reason, /anywhere_in_vin=true/);
});

test("verifyCollectionUpdateAuthority rejects when reveal tx does not spend commit output 0", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx({
      reveal: { vin: [{ txid: UPDATE_COMMIT_TXID, vout: 1 }] },  // vout !== 0
    }),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /vin\[0\]\.vout must be 0/);
});

test("verifyCollectionUpdateAuthority rejects when reveal tx has no outputs", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx({ reveal: { vin: [{ txid: UPDATE_COMMIT_TXID, vout: 0 }], vout: [] } }),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /has no outputs/);
});

test("verifyCollectionUpdateAuthority: fetchTx failure fails closed", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx({ fail: { [UPDATE_REVEAL_TXID]: "network down" } }),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /reveal tx fetch/);
});

test("verifyCollectionUpdateAuthority: commit tx fetch failure fails closed", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx({ fail: { [UPDATE_COMMIT_TXID]: "electrs 502" } }),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /commit tx fetch/);
});

test("verifyCollectionUpdateAuthority: reveal tx missing vin rejects", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx({ reveal: { vin: [] } }),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /vin\[0\]\.txid missing/);
});

test("verifyCollectionUpdateAuthority: commit tx missing vin rejects", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx({ commit: { vin: [] } }),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /commit tx .* has no vin/);
});

test("verifyCollectionUpdateAuthority: malformed inscription id rejects", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: "not-a-valid-id",
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    fetchTx: makeFetchTx(),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /malformed/);
});

test("verifyCollectionUpdateAuthority: missing expectedSatpoint rejects", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: null,
    network: "bells-testnet",
    fetchTx: makeFetchTx(),
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /expectedSatpoint/);
});

test("verifyCollectionUpdateAuthority: mainnet without electrs fails closed", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-mainnet",
    env: {},  // ELECTRS_BASE_MAINNET unset
    // fetchTx omitted — forces the default-fetcher branch
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /ELECTRS_BASE_MAINNET unset/);
});

test("verifyCollectionUpdateAuthority: testnet without electrs returns skipped (dev)", async () => {
  const r = await verifyCollectionUpdateAuthority({
    updateInscriptionId: UPDATE_INSCRIPTION_ID,
    expectedSatpoint: EXPECTED_SATPOINT,
    network: "bells-testnet",
    env: {},
    // fetchTx omitted
  });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
});
