// Regression test for the Phase C mint-choreography bootstrap cycle.
//
// Context: before this fix, game/collection.template.json shipped with
// `app_manifest_ids: ["REPLACE_WITH_MANIFEST_V1_INSCRIPTION_ID_BEFORE_MINT"]`
// and the inscription checklist put collection-metadata BEFORE the main
// manifest. The strict Phase A validator rejects REPLACE_ placeholders
// in app_manifest_ids, so the first `POST /api/collections` after a
// fresh testnet/mainnet mint would always 422 — making Phase C
// discovery impossible to bootstrap.
//
// Fix: reverse the dependency (main-manifest first, then
// collection-metadata with its manifest-id placeholder filled by
// `fillCollectionMetadata`). This test locks the roundtrip:
//   template bytes on disk → fillCollectionMetadata →
//   JSON.parse → validateCollection (STRICT ingestion mode) → ok.
//
// If this test breaks it means the template + filler + strict
// validator have drifted; fix the one that changed, never relax the
// strict mode.

import { test } from "node:test";
import assert from "node:assert/strict";

import { fillCollectionMetadata } from "./bulk-inscribe.mjs";
import { validateCollection } from "../game/indexer/src/validator.js";

const FAKE_MANIFEST_ID = `${"a".repeat(64)}i0`;

test("fillCollectionMetadata: filled body passes strict validateCollection()", () => {
  const result = fillCollectionMetadata(
    { file: "game/collection.template.json" },
    {
      inscriptions: {
        "main-manifest:pokebells-manifest.json": { inscription_id: FAKE_MANIFEST_ID },
      },
    },
  );
  assert.equal(result.unresolved.length, 0, JSON.stringify(result.unresolved));
  assert.equal(result.replaced, 1);

  const parsed = JSON.parse(result.text);
  // Strict mode (default) — REPLACE_ placeholders would fail. The
  // filled body must pass without passing { allowPlaceholders: true }.
  const validation = validateCollection(parsed);
  assert.equal(validation.ok, true, JSON.stringify(validation, null, 2));
  assert.deepEqual(validation.normalized.app_manifest_ids, [FAKE_MANIFEST_ID]);
  assert.equal(validation.normalized.update_authority.scheme, "sat-spend-v1");
});

test("fillCollectionMetadata: missing main-manifest progress -> clear unresolved", () => {
  const result = fillCollectionMetadata(
    { file: "game/collection.template.json" },
    { inscriptions: {} },
  );
  assert.equal(result.text, "");
  assert.equal(result.replaced, 0);
  assert.match(result.unresolved[0], /main-manifest.*not yet inscribed/);
});

test("fillCollectionMetadata: template without the placeholder -> clear unresolved", () => {
  // If someone accidentally checks in a pre-filled template (real id
  // instead of the placeholder), fail loud so the checklist linter
  // catches the drift before it reaches the inscriber.
  //
  // Verified by pointing the filler at an unrelated file that does
  // NOT contain the placeholder.
  const result = fillCollectionMetadata(
    { file: "game/manifest.template.json" },
    {
      inscriptions: {
        "main-manifest:pokebells-manifest.json": { inscription_id: FAKE_MANIFEST_ID },
      },
    },
  );
  assert.equal(result.text, "");
  assert.match(result.unresolved[0], /does not contain the expected placeholder/);
});

test("manifest.template.json: no longer carries collection_inscription_id (dead field removed)", async () => {
  // The Phase C fix removed `collection_inscription_id` from the
  // main manifest so the cycle (manifest wants collection, collection
  // wants manifest) is broken. Nothing at runtime reads the field;
  // this test pins its absence so a future refactor can't quietly
  // reintroduce the cycle.
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..");
  const text = await readFile(resolve(repoRoot, "game/manifest.template.json"), "utf8");
  const manifest = JSON.parse(text);
  assert.equal(
    manifest.collection_inscription_id,
    undefined,
    "Phase C removed collection_inscription_id; if this test fails, "
    + "the cycle was reintroduced.",
  );
});
