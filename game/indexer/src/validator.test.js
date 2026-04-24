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
  validateMintV1_5,
  validateSaveSnapshot,
  validateReveal,
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
