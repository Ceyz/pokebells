// Smoke tests for the indexer validator. Exercises the schema stage of
// each main public export to unblock `npm test` as a CI gate (see
// game/MAINNET-PLAN.md). Full cryptographic coverage lives in
// game/capture-core.test.mjs — the validator reuses those canonical
// builders so we don't duplicate the crypto matrix here.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCapture,
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
