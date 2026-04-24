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
import { insertPokemon, isStarterRaceError } from "./db.js";

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
