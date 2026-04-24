// Unit tests for insertPokemon + isStarterRaceError.
// Covers P1 indexer correctness (see game/MAINNET-PLAN.md):
//   - happy path: first mint per wallet/network gets is_starter=1.
//   - subsequent mint: is_starter=0.
//   - starter race: UNIQUE on idx_pokemon_starter_unique retries with 0.
//   - PK duplicate on pokemon.mint_inscription_id rethrows (no spurious
//     starter retry, which previously could have happened under the
//     broad /UNIQUE constraint/i regex).
//   - unknown D1 error rethrows cleanly.
//   - isStarterRaceError matches only the specific index, including when
//     the error is wrapped in an e.cause chain.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  insertPokemon, isStarterRaceError,
  registerCollectionRoot, getCollectionRoot,
  insertAcceptedCollectionUpdate, recordRejectedUpdate,
  currentCollectionSatpoint, aggregatedCollectionLatest,
} from "./db.js";

function makeNormalized(overrides = {}) {
  return {
    ref_capture_commit: `${"d".repeat(64)}i0`,
    network: "bells-testnet",
    signed_in_wallet: "tb1pwallet",
    party_slot_index: 0,
    species_id: 155,
    species_name: "Cyndaquil",
    level: 5,
    shiny: 0,
    iv_atk: 10, iv_def: 11, iv_spe: 12, iv_special: 13, iv_hp: 5, iv_total: 46,
    ev_hp: 0, ev_atk: 0, ev_def: 0, ev_spe: 0, ev_spc: 0,
    status: "None", held_item: null, friendship: 70, pokerus: 0, catch_rate: 45,
    moves_json: "[]", pp_json: "[]",
    name: "Cyndaquil Lv.5", description: "",
    image: "/content/sprite_155i0",
    attributes_json: "[]",
    ...overrides,
  };
}

// Minimal D1 mock. Captures every INSERT call and lets the caller drive
// failure modes via `insertBehavior`.
function createEnv({ existingCount = 0, insertBehavior = "ok" } = {}) {
  const insertCalls = [];
  let insertAttempt = 0;

  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("SELECT COUNT(*)")) return { n: existingCount };
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO pokemon")) {
                insertAttempt += 1;
                // Last bind arg is starterFlag (see db.js insertPokemon).
                const starterFlag = args[args.length - 1];
                insertCalls.push({ starterFlag });
                if (insertBehavior === "ok") return { success: true };
                if (insertBehavior === "starter_race_once") {
                  if (insertAttempt === 1) {
                    throw new Error(
                      "D1_ERROR: UNIQUE constraint failed: idx_pokemon_starter_unique: SQLITE_CONSTRAINT"
                    );
                  }
                  return { success: true };
                }
                if (insertBehavior === "pk_duplicate") {
                  throw new Error(
                    "D1_ERROR: UNIQUE constraint failed: pokemon.mint_inscription_id: SQLITE_CONSTRAINT"
                  );
                }
                if (insertBehavior === "unknown_error") {
                  throw new Error("D1_ERROR: database is locked");
                }
                return { success: true };
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { env: { DB: db }, insertCalls };
}

test("insertPokemon: first mint for a wallet/network gets is_starter=1", async () => {
  const { env, insertCalls } = createEnv({ existingCount: 0 });
  await insertPokemon(env, `${"a".repeat(64)}i0`, makeNormalized(), "{}");
  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].starterFlag, 1);
});

test("insertPokemon: subsequent mint for the same wallet gets is_starter=0", async () => {
  const { env, insertCalls } = createEnv({ existingCount: 3 });
  await insertPokemon(env, `${"a".repeat(64)}i0`, makeNormalized(), "{}");
  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].starterFlag, 0);
});

test("insertPokemon: starter race retries with is_starter=0", async () => {
  const { env, insertCalls } = createEnv({
    existingCount: 0,
    insertBehavior: "starter_race_once",
  });
  await insertPokemon(env, `${"a".repeat(64)}i0`, makeNormalized(), "{}");
  assert.equal(insertCalls.length, 2, "should retry once after losing the starter race");
  assert.equal(insertCalls[0].starterFlag, 1);
  assert.equal(insertCalls[1].starterFlag, 0);
});

test("insertPokemon: PK duplicate rethrows, no spurious starter retry", async () => {
  const { env, insertCalls } = createEnv({
    existingCount: 0,
    insertBehavior: "pk_duplicate",
  });
  await assert.rejects(
    () => insertPokemon(env, `${"a".repeat(64)}i0`, makeNormalized(), "{}"),
    /mint_inscription_id/,
  );
  assert.equal(insertCalls.length, 1, "no retry on PK duplicate");
});

test("insertPokemon: unknown D1 error rethrows cleanly", async () => {
  const { env } = createEnv({
    existingCount: 0,
    insertBehavior: "unknown_error",
  });
  await assert.rejects(
    () => insertPokemon(env, `${"a".repeat(64)}i0`, makeNormalized(), "{}"),
    /database is locked/,
  );
});

test("insertPokemon: PK duplicate on a non-starter mint rethrows", async () => {
  // existingCount > 0 means isStarter is already 0 — no retry should ever
  // fire regardless of error wording. Guards against the retry branch
  // firing when it semantically cannot be the starter race.
  const { env, insertCalls } = createEnv({
    existingCount: 5,
    insertBehavior: "pk_duplicate",
  });
  await assert.rejects(
    () => insertPokemon(env, `${"a".repeat(64)}i0`, makeNormalized(), "{}"),
    /mint_inscription_id/,
  );
  assert.equal(insertCalls.length, 1);
});

test("isStarterRaceError: matches only the starter index", () => {
  assert.equal(
    isStarterRaceError(new Error("UNIQUE constraint failed: idx_pokemon_starter_unique")),
    true,
  );
  assert.equal(
    isStarterRaceError(new Error(
      "D1_ERROR: UNIQUE constraint failed: idx_pokemon_starter_unique: SQLITE_CONSTRAINT"
    )),
    true,
  );
  assert.equal(
    isStarterRaceError(new Error("UNIQUE constraint failed: pokemon.mint_inscription_id")),
    false,
    "PK violation must NOT be classified as a starter race",
  );
  assert.equal(isStarterRaceError(new Error("database is locked")), false);
  assert.equal(
    isStarterRaceError(new Error("idx_pokemon_starter_unique")),
    false,
    "needs both UNIQUE constraint wording and index name",
  );
  assert.equal(isStarterRaceError(null), false);
  assert.equal(isStarterRaceError(undefined), false);
  assert.equal(isStarterRaceError({}), false);
});

test("isStarterRaceError: inspects e.cause.message when D1 wraps the error", () => {
  const wrapped = new Error("d1 wrapper");
  wrapped.cause = new Error(
    "UNIQUE constraint failed: idx_pokemon_starter_unique"
  );
  assert.equal(isStarterRaceError(wrapped), true);
});

// ============================================================================
// Phase B: collection + collection_updates DB helpers
// ============================================================================
// In-memory D1 mock for the collection tables. Mirrors the SQL shape in
// schema.sql — INSERT OR IGNORE + UNIQUE constraint behaviour included.

function createCollectionEnv() {
  const state = {
    collections: [],
    collection_updates: [],
    rejected_updates: [],
  };
  const match = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
  const find = (arr, where) => arr.find((r) => match(r, where));
  const filter = (arr, where) => arr.filter((r) => match(r, where));

  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM collections") && sql.includes("WHERE inscription_id")) {
                const [id, net] = args;
                return find(state.collections, {
                  inscription_id: id, network: net,
                }) ?? null;
              }
              if (sql.includes("FROM collection_updates")
                  && sql.includes("ORDER BY update_sequence DESC")) {
                const [id, net] = args;
                const rows = filter(state.collection_updates, {
                  collection_inscription_id: id, network: net,
                }).sort((a, b) => b.update_sequence - a.update_sequence);
                return rows[0] ?? null;
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM collection_updates")
                  && sql.includes("ORDER BY update_sequence ASC")) {
                const [id, net] = args;
                const rows = filter(state.collection_updates, {
                  collection_inscription_id: id, network: net,
                }).sort((a, b) => a.update_sequence - b.update_sequence);
                return { results: [...rows] };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes("INSERT OR IGNORE INTO collections")) {
                const [id, net, body, initialRevealTxid, registeredAt] = args;
                if (!find(state.collections, { inscription_id: id, network: net })) {
                  state.collections.push({
                    inscription_id: id, network: net, body_json: body,
                    initial_reveal_txid: initialRevealTxid,
                    registered_at: registeredAt,
                  });
                }
                return { success: true };
              }
              if (sql.includes("INSERT INTO collection_updates")) {
                const [
                  inscriptionId, collectionId, network, updateSequence,
                  setJson, commitTxid, revealTxid, acceptedAt,
                ] = args;
                const dup = find(state.collection_updates, {
                  collection_inscription_id: collectionId,
                  network, update_sequence: updateSequence,
                });
                if (dup) {
                  throw new Error(
                    "D1_ERROR: UNIQUE constraint failed: collection_updates.collection_inscription_id",
                  );
                }
                const dup2 = find(state.collection_updates, {
                  inscription_id: inscriptionId, network,
                });
                if (dup2) {
                  throw new Error(
                    "D1_ERROR: UNIQUE constraint failed: collection_updates.inscription_id",
                  );
                }
                state.collection_updates.push({
                  inscription_id: inscriptionId,
                  collection_inscription_id: collectionId,
                  network, update_sequence: updateSequence,
                  set_json: setJson, commit_txid: commitTxid,
                  reveal_txid: revealTxid, accepted_at: acceptedAt,
                });
                return { success: true };
              }
              if (sql.includes("INSERT OR IGNORE INTO rejected_updates")) {
                const [
                  inscriptionId, collectionId, network,
                  reason, rawBody, rejectedAt,
                ] = args;
                if (!find(state.rejected_updates, {
                  inscription_id: inscriptionId, network,
                })) {
                  state.rejected_updates.push({
                    inscription_id: inscriptionId,
                    collection_inscription_id: collectionId,
                    network, reason,
                    raw_body_json: rawBody, rejected_at: rejectedAt,
                  });
                }
                return { success: true };
              }
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { env: { DB: db }, state };
}

const COLL_ID = `${"1".repeat(64)}i0`;
const ROOT_REVEAL_TXID = "root-reveal-txid";
const ROOT_BODY_JSON = JSON.stringify({
  p: "pokebells-collection", v: 1, name: "PokeBells", slug: "pokebells",
  indexer_urls: ["https://idx1.example/"],
  companion_urls: ["https://comp1.example/"],
  bridge_urls: [],
  root_app_urls: [],
  app_manifest_ids: [`${"2".repeat(64)}i0`],
});

test("registerCollectionRoot + getCollectionRoot roundtrip", async () => {
  const { env, state } = createCollectionEnv();
  await registerCollectionRoot(env, {
    inscriptionId: COLL_ID, network: "bells-testnet",
    bodyJson: ROOT_BODY_JSON, initialRevealTxid: ROOT_REVEAL_TXID,
  });
  assert.equal(state.collections.length, 1);

  const row = await getCollectionRoot(env, COLL_ID, "bells-testnet");
  assert.equal(row.inscription_id, COLL_ID);
  assert.equal(row.initial_reveal_txid, ROOT_REVEAL_TXID);
});

test("registerCollectionRoot is idempotent on repeat", async () => {
  const { env, state } = createCollectionEnv();
  const args = {
    inscriptionId: COLL_ID, network: "bells-testnet",
    bodyJson: ROOT_BODY_JSON, initialRevealTxid: ROOT_REVEAL_TXID,
  };
  await registerCollectionRoot(env, args);
  await registerCollectionRoot(env, args);
  assert.equal(state.collections.length, 1);
});

// Registers a root in the mock env so subsequent insertAcceptedCollectionUpdate
// calls pass the "root registered?" gate. Keeps per-test setup tight.
async function seedRoot(env) {
  await registerCollectionRoot(env, {
    inscriptionId: COLL_ID, network: "bells-testnet",
    bodyJson: ROOT_BODY_JSON, initialRevealTxid: ROOT_REVEAL_TXID,
  });
}

test("insertAcceptedCollectionUpdate rejects when collection root is not registered", async () => {
  const { env } = createCollectionEnv();
  await assert.rejects(
    () => insertAcceptedCollectionUpdate(env, {
      inscriptionId: "u1i0", collectionInscriptionId: COLL_ID,
      network: "bells-testnet", updateSequence: 1, setJson: "{}",
      commitTxid: "c1", revealTxid: "r1",
    }),
    /not registered/,
  );
});

test("insertAcceptedCollectionUpdate rejects non-sequential first update", async () => {
  const { env } = createCollectionEnv();
  await seedRoot(env);
  // Sequence 2 when no updates accepted yet -> expected = 1.
  await assert.rejects(
    () => insertAcceptedCollectionUpdate(env, {
      inscriptionId: "u1i0", collectionInscriptionId: COLL_ID,
      network: "bells-testnet", updateSequence: 2, setJson: "{}",
      commitTxid: "c1", revealTxid: "r1",
    }),
    /not sequential .*expected 1/,
  );
});

test("insertAcceptedCollectionUpdate rejects replay of last accepted sequence", async () => {
  const { env } = createCollectionEnv();
  await seedRoot(env);
  await insertAcceptedCollectionUpdate(env, {
    inscriptionId: "u1i0", collectionInscriptionId: COLL_ID,
    network: "bells-testnet", updateSequence: 1, setJson: "{}",
    commitTxid: "c1", revealTxid: "r1",
  });
  // Trying to re-insert sequence 1 -> expected = 2.
  await assert.rejects(
    () => insertAcceptedCollectionUpdate(env, {
      inscriptionId: "u2i0", collectionInscriptionId: COLL_ID,
      network: "bells-testnet", updateSequence: 1, setJson: "{}",
      commitTxid: "c2", revealTxid: "r2",
    }),
    /not sequential .*expected 2/,
  );
});

test("insertAcceptedCollectionUpdate rejects sequence gap", async () => {
  const { env } = createCollectionEnv();
  await seedRoot(env);
  await insertAcceptedCollectionUpdate(env, {
    inscriptionId: "u1i0", collectionInscriptionId: COLL_ID,
    network: "bells-testnet", updateSequence: 1, setJson: "{}",
    commitTxid: "c1", revealTxid: "r1",
  });
  // Gap: trying to skip to 3 after 1.
  await assert.rejects(
    () => insertAcceptedCollectionUpdate(env, {
      inscriptionId: "u2i0", collectionInscriptionId: COLL_ID,
      network: "bells-testnet", updateSequence: 3, setJson: "{}",
      commitTxid: "c2", revealTxid: "r2",
    }),
    /not sequential .*expected 2/,
  );
});

test("insertAcceptedCollectionUpdate accepts a clean 1, 2, 3 chain", async () => {
  const { env, state } = createCollectionEnv();
  await seedRoot(env);
  for (const seq of [1, 2, 3]) {
    await insertAcceptedCollectionUpdate(env, {
      inscriptionId: `u${seq}i0`, collectionInscriptionId: COLL_ID,
      network: "bells-testnet", updateSequence: seq, setJson: "{}",
      commitTxid: `c${seq}`, revealTxid: `r${seq}`,
    });
  }
  assert.equal(state.collection_updates.length, 3);
});

test("recordRejectedUpdate is idempotent on retry", async () => {
  const { env, state } = createCollectionEnv();
  const args = {
    inscriptionId: "badi0", collectionInscriptionId: COLL_ID,
    network: "bells-testnet", reason: "schema",
    rawBodyJson: "{}",
  };
  await recordRejectedUpdate(env, args);
  await recordRejectedUpdate(env, args);
  assert.equal(state.rejected_updates.length, 1);
});

test("currentCollectionSatpoint: no updates -> initial_reveal_txid", async () => {
  const { env } = createCollectionEnv();
  await registerCollectionRoot(env, {
    inscriptionId: COLL_ID, network: "bells-testnet",
    bodyJson: ROOT_BODY_JSON, initialRevealTxid: ROOT_REVEAL_TXID,
  });
  const sp = await currentCollectionSatpoint(env, COLL_ID, "bells-testnet");
  assert.deepEqual(sp, {
    revealTxid: ROOT_REVEAL_TXID, vout: 0, lastSequence: 0,
  });
});

test("currentCollectionSatpoint: with N updates -> latest reveal_txid", async () => {
  const { env } = createCollectionEnv();
  await registerCollectionRoot(env, {
    inscriptionId: COLL_ID, network: "bells-testnet",
    bodyJson: ROOT_BODY_JSON, initialRevealTxid: ROOT_REVEAL_TXID,
  });
  await insertAcceptedCollectionUpdate(env, {
    inscriptionId: "u1i0", collectionInscriptionId: COLL_ID,
    network: "bells-testnet", updateSequence: 1, setJson: "{}",
    commitTxid: "c1", revealTxid: "r1",
  });
  await insertAcceptedCollectionUpdate(env, {
    inscriptionId: "u2i0", collectionInscriptionId: COLL_ID,
    network: "bells-testnet", updateSequence: 2, setJson: "{}",
    commitTxid: "c2", revealTxid: "r2",
  });
  const sp = await currentCollectionSatpoint(env, COLL_ID, "bells-testnet");
  assert.deepEqual(sp, {
    revealTxid: "r2", vout: 0, lastSequence: 2,
  });
});

test("currentCollectionSatpoint: unknown collection -> null", async () => {
  const { env } = createCollectionEnv();
  const sp = await currentCollectionSatpoint(env, COLL_ID, "bells-testnet");
  assert.equal(sp, null);
});

test("aggregatedCollectionLatest: empty root -> aggregated == body", async () => {
  const { env } = createCollectionEnv();
  await registerCollectionRoot(env, {
    inscriptionId: COLL_ID, network: "bells-testnet",
    bodyJson: ROOT_BODY_JSON, initialRevealTxid: ROOT_REVEAL_TXID,
  });
  const agg = await aggregatedCollectionLatest(env, COLL_ID, "bells-testnet");
  assert.ok(agg);
  assert.equal(agg.stats.applied_updates, 0);
  assert.equal(agg.current_satpoint.last_sequence, 0);
  assert.deepEqual(agg.aggregated.indexer_urls, ["https://idx1.example/"]);
  assert.equal(agg.aggregated.app_manifest_ids.length, 1);
});

test("aggregatedCollectionLatest: updates prepend in sequence order", async () => {
  const { env } = createCollectionEnv();
  await registerCollectionRoot(env, {
    inscriptionId: COLL_ID, network: "bells-testnet",
    bodyJson: ROOT_BODY_JSON, initialRevealTxid: ROOT_REVEAL_TXID,
  });
  // Update 1 prepends a new manifest id.
  const manifestA = `${"a".repeat(64)}i0`;
  const manifestB = `${"b".repeat(64)}i0`;
  await insertAcceptedCollectionUpdate(env, {
    inscriptionId: "u1i0", collectionInscriptionId: COLL_ID,
    network: "bells-testnet", updateSequence: 1,
    setJson: JSON.stringify({ app_manifest_ids_prepend: [manifestA] }),
    commitTxid: "c1", revealTxid: "r1",
  });
  // Update 2 prepends another.
  await insertAcceptedCollectionUpdate(env, {
    inscriptionId: "u2i0", collectionInscriptionId: COLL_ID,
    network: "bells-testnet", updateSequence: 2,
    setJson: JSON.stringify({
      app_manifest_ids_prepend: [manifestB],
      indexer_urls_prepend: ["https://idx2.example/"],
    }),
    commitTxid: "c2", revealTxid: "r2",
  });
  const agg = await aggregatedCollectionLatest(env, COLL_ID, "bells-testnet");
  // Latest update wins at index 0.
  assert.equal(agg.aggregated.app_manifest_ids[0], manifestB);
  assert.equal(agg.aggregated.app_manifest_ids[1], manifestA);
  assert.equal(agg.aggregated.app_manifest_ids[2], `${"2".repeat(64)}i0`);
  assert.equal(agg.aggregated.indexer_urls[0], "https://idx2.example/");
  assert.equal(agg.aggregated.indexer_urls[1], "https://idx1.example/");
  assert.equal(agg.stats.applied_updates, 2);
  assert.equal(agg.stats.prepended.app_manifest_ids, 2);
  assert.equal(agg.stats.prepended.indexer_urls, 1);
  assert.equal(agg.current_satpoint.reveal_txid, "r2");
  assert.equal(agg.current_satpoint.last_sequence, 2);
});

test("aggregatedCollectionLatest: unknown collection -> null", async () => {
  const { env } = createCollectionEnv();
  const agg = await aggregatedCollectionLatest(env, COLL_ID, "bells-testnet");
  assert.equal(agg, null);
});

test("aggregatedCollectionLatest: malformed body_json throws clearly", async () => {
  const { env, state } = createCollectionEnv();
  state.collections.push({
    inscription_id: COLL_ID, network: "bells-testnet",
    body_json: "not-json", initial_reveal_txid: ROOT_REVEAL_TXID,
    registered_at: 0,
  });
  await assert.rejects(
    () => aggregatedCollectionLatest(env, COLL_ID, "bells-testnet"),
    /invalid body_json/,
  );
});
