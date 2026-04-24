// Smoke tests for the Phase B worker routes. Underlying helpers
// (validateCollection, validateCollectionUpdate, verifyCollectionUpdateAuthority,
// DB helpers) have their own unit tests in validator.test.js + db.test.js —
// this suite exercises the route wiring + the happy / error paths of the
// 3 new handlers end-to-end with a fake fetch() + in-memory DB mock.

import { test } from "node:test";
import assert from "node:assert/strict";
import workerModule, {
  drainCollectionQueueEntry, drainCollectionUpdateQueueEntry,
} from "./worker.js";

const COLL_ID = `${"1".repeat(64)}i0`;
const COLL_REVEAL_TXID = "1".repeat(64);
const UPDATE_ID = `${"a".repeat(64)}i0`;
const UPDATE_REVEAL_TXID = "a".repeat(64);
const UPDATE_COMMIT_TXID = "b".repeat(64);
const MANIFEST_A = `${"2".repeat(64)}i0`;
const MANIFEST_B = `${"3".repeat(64)}i0`;

const VALID_COLLECTION_BODY = {
  p: "pokebells-collection",
  v: 1,
  name: "PokeBells",
  slug: "pokebells",
  description: "test",
  networks: ["bells-testnet"],
  indexer_urls: ["https://idx.example/"],
  companion_urls: ["https://comp.example/"],
  bridge_urls: [],
  root_app_urls: [],
  app_manifest_ids: [MANIFEST_A],
  update_authority: { scheme: "sat-spend-v1" },
  license: "MIT",
};

const VALID_UPDATE_BODY = {
  p: "pokebells",
  op: "collection_update",
  v: 1,
  network: "bells-testnet",
  collection_inscription_id: COLL_ID,
  update_sequence: 1,
  issued_at: "2026-04-24T00:00:00.000Z",
  set: { app_manifest_ids_prepend: [MANIFEST_B] },
};

// =====================================================================
// Fake env + fetch fixtures
// =====================================================================

function createFakeEnv({ collectionBody = VALID_COLLECTION_BODY, updateBody = VALID_UPDATE_BODY, contentOverrides = {}, txOverrides = {} } = {}) {
  const state = {
    collections: [],
    collection_updates: [],
    rejected_updates: [],
    ingestion_log: [],
    ingestion_queue: [],
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
                return find(state.collections, { inscription_id: id, network: net }) ?? null;
              }
              if (sql.includes("FROM collection_updates") && sql.includes("ORDER BY update_sequence DESC")) {
                const [id, net] = args;
                const rows = filter(state.collection_updates, {
                  collection_inscription_id: id, network: net,
                }).sort((a, b) => b.update_sequence - a.update_sequence);
                return rows[0] ?? null;
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM collection_updates") && sql.includes("ORDER BY update_sequence ASC")) {
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
                if (find(state.collection_updates, {
                  collection_inscription_id: collectionId,
                  network, update_sequence: updateSequence,
                })) {
                  throw new Error("UNIQUE constraint failed: collection_updates");
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
                const [inscriptionId, collectionId, network, reason, rawBody, rejectedAt] = args;
                if (!find(state.rejected_updates, { inscription_id: inscriptionId, network })) {
                  state.rejected_updates.push({
                    inscription_id: inscriptionId,
                    collection_inscription_id: collectionId,
                    network, reason,
                    raw_body_json: rawBody, rejected_at: rejectedAt,
                  });
                }
                return { success: true };
              }
              if (sql.includes("INSERT OR IGNORE INTO ingestion_log")) {
                state.ingestion_log.push({ args });
                return { success: true };
              }
              if (sql.includes("INSERT INTO ingestion_queue")) {
                const [
                  inscriptionId, kind, network, enqueuedAt, retryAfter,
                  lastError,
                ] = args;
                // Simulate ON CONFLICT DO UPDATE — replace if (id, kind) exists.
                const idx = state.ingestion_queue.findIndex(
                  (r) => r.inscription_id === inscriptionId && r.kind === kind,
                );
                const row = {
                  inscription_id: inscriptionId, kind, network,
                  enqueued_at: enqueuedAt, retry_after: retryAfter,
                  attempts: 0, last_error: lastError ?? null,
                };
                if (idx >= 0) state.ingestion_queue[idx] = row;
                else state.ingestion_queue.push(row);
                return { success: true };
              }
              if (sql.includes("DELETE FROM ingestion_queue")) {
                const [inscriptionId, kind] = args;
                const idx = state.ingestion_queue.findIndex(
                  (r) => r.inscription_id === inscriptionId && r.kind === kind,
                );
                if (idx >= 0) state.ingestion_queue.splice(idx, 1);
                return { success: true };
              }
              if (sql.includes("UPDATE ingestion_queue")) {
                const [retryAfter, lastError, inscriptionId, kind] = args;
                const row = state.ingestion_queue.find(
                  (r) => r.inscription_id === inscriptionId && r.kind === kind,
                );
                if (row) {
                  row.attempts += 1;
                  row.retry_after = retryAfter;
                  row.last_error = lastError ?? null;
                }
                return { success: true };
              }
              // Silently accept other statements — e.g. ingestion_log is
              // a best-effort audit; its schema might differ in prod.
              return { success: true };
            },
          };
        },
      };
    },
  };

  const env = {
    DB: db,
    CONTENT_BASE_TESTNET: "https://mock-content-testnet/",
    CONTENT_BASE_MAINNET: "https://mock-content-mainnet/",
    ELECTRS_BASE_TESTNET: "https://mock-electrs-testnet",
    ELECTRS_BASE_MAINNET: "https://mock-electrs-mainnet",
  };

  // Fake content + electrs responses.
  const contentMap = {
    [`https://mock-content-testnet/${COLL_ID}`]: collectionBody,
    [`https://mock-content-testnet/${UPDATE_ID}`]: updateBody,
    ...contentOverrides,
  };
  const txMap = {
    [`https://mock-electrs-testnet/tx/${UPDATE_REVEAL_TXID}`]: {
      vin: [{ txid: UPDATE_COMMIT_TXID, vout: 0 }],
      vout: [{ value: 1000 }],
    },
    [`https://mock-electrs-testnet/tx/${UPDATE_COMMIT_TXID}`]: {
      vin: [
        { txid: COLL_REVEAL_TXID, vout: 0 },  // SATPOINT at vin[0]
        { txid: "f".repeat(64), vout: 1 },
      ],
    },
    ...txOverrides,
  };

  const fetchImpl = async (url, _opts) => {
    const key = typeof url === "string" ? url : url.toString();
    if (contentMap[key] !== undefined) {
      const body = contentMap[key];
      if (body === 404) {
        return new Response("not found", { status: 404 });
      }
      return new Response(
        typeof body === "string" ? body : JSON.stringify(body),
        { status: 200 },
      );
    }
    if (txMap[key] !== undefined) {
      return new Response(JSON.stringify(txMap[key]), { status: 200 });
    }
    return new Response(`unexpected fetch: ${key}`, { status: 599 });
  };

  return { env, state, fetchImpl };
}

async function callWorker(handler, { method = "POST", path, body = null, env, fetchImpl }) {
  const url = `https://indexer.example${path}`;
  const request = new Request(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await handler(request, env);
  } finally {
    globalThis.fetch = realFetch;
  }
}

const fetchWorker = async (opts) => callWorker(workerModule.fetch, opts);

// =====================================================================
// POST /api/collections
// =====================================================================

test("POST /api/collections: happy path registers the root", async () => {
  const { env, state, fetchImpl } = createFakeEnv();
  const resp = await fetchWorker({
    path: "/api/collections",
    body: { inscription_id: COLL_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "registered");
  assert.equal(body.initial_reveal_txid, COLL_REVEAL_TXID);
  assert.equal(state.collections.length, 1);
  assert.equal(state.collections[0].inscription_id, COLL_ID);
});

test("POST /api/collections: rejects REPLACE_ placeholder at ingestion", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    collectionBody: { ...VALID_COLLECTION_BODY, app_manifest_ids: ["REPLACE_ME_BEFORE_MINT"] },
  });
  const resp = await fetchWorker({
    path: "/api/collections",
    body: { inscription_id: COLL_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 422);
  const body = await resp.json();
  assert.equal(body.ok, false);
  assert.match(body.reason, /REPLACE_ placeholder/);
  assert.equal(state.collections.length, 0);
});

test("POST /api/collections: route network must be in body.networks", async () => {
  const { env, fetchImpl } = createFakeEnv({
    collectionBody: { ...VALID_COLLECTION_BODY, networks: ["bells-mainnet"] },
  });
  const resp = await fetchWorker({
    path: "/api/collections",
    body: { inscription_id: COLL_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 422);
  const body = await resp.json();
  assert.equal(body.error, "validation_failed");
  assert.match(body.reason, /does not include route network/);
});

test("POST /api/collections: 404 content_host -> 202 queued AND row enqueued", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: { [`https://mock-content-testnet/${COLL_ID}`]: 404 },
  });
  const resp = await fetchWorker({
    path: "/api/collections",
    body: { inscription_id: COLL_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 202);
  const body = await resp.json();
  assert.equal(body.status, "queued");
  // P1 fix: the 202 response now actually enqueues. The cron drain
  // re-fetches + replays; a caller who sees 202 can forget about it.
  assert.equal(state.ingestion_queue.length, 1);
  assert.equal(state.ingestion_queue[0].kind, "collection");
  assert.equal(state.ingestion_queue[0].inscription_id, COLL_ID);
  assert.equal(state.ingestion_queue[0].network, "bells-testnet");
});

test("POST /api/collection-updates: 404 content_host -> 202 queued AND row enqueued", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: { [`https://mock-content-testnet/${UPDATE_ID}`]: 404 },
  });
  await registerRoot(env, fetchImpl);
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 202);
  const body = await resp.json();
  assert.equal(body.status, "queued");
  assert.equal(state.ingestion_queue.length, 1);
  assert.equal(state.ingestion_queue[0].kind, "collection_update");
  assert.equal(state.ingestion_queue[0].inscription_id, UPDATE_ID);
});

test("POST /api/collection-updates: non-JSON content -> rejected_updates (P2 audit)", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: { [`https://mock-content-testnet/${UPDATE_ID}`]: "not-json-garbage" },
  });
  await registerRoot(env, fetchImpl);
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 422);
  const body = await resp.json();
  assert.equal(body.error, "fetch_failed");
  // Pre-schema failure still lands in rejected_updates with a null
  // collection id so the audit trail is complete even when we have
  // no parsed body to reference.
  assert.equal(state.rejected_updates.length, 1);
  assert.equal(state.rejected_updates[0].inscription_id, UPDATE_ID);
  assert.equal(state.rejected_updates[0].collection_inscription_id, null);
  assert.match(state.rejected_updates[0].reason, /fetch:/);
});

// =====================================================================
// POST /api/collection-updates
// =====================================================================

async function registerRoot(env, fetchImpl) {
  await fetchWorker({
    path: "/api/collections",
    body: { inscription_id: COLL_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
}

test("POST /api/collection-updates: happy path accepts update 1", async () => {
  const { env, state, fetchImpl } = createFakeEnv();
  await registerRoot(env, fetchImpl);
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  const body = await resp.json();
  assert.equal(resp.status, 200, `expected 200, got ${resp.status}: ${JSON.stringify(body)}`);
  assert.equal(body.ok, true);
  assert.equal(body.status, "accepted");
  assert.equal(body.update_sequence, 1);
  assert.equal(body.commit_txid, UPDATE_COMMIT_TXID);
  assert.equal(state.collection_updates.length, 1);
  assert.equal(state.rejected_updates.length, 0);
});

test("POST /api/collection-updates: strict parsed.network !== routeNetwork -> reject + record", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    updateBody: { ...VALID_UPDATE_BODY, network: "bells-mainnet" },
  });
  await registerRoot(env, fetchImpl);
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 422);
  const body = await resp.json();
  assert.equal(body.ok, false);
  assert.match(body.reason, /network_mismatch/);
  assert.equal(state.rejected_updates.length, 1);
  assert.match(state.rejected_updates[0].reason, /network_mismatch/);
});

test("POST /api/collection-updates: collection_not_registered is transient (queued, not rejected)", async () => {
  // Round-4 P2 fix: a collection root can arrive in a follow-up POST
  // /api/collections after the update POST. Treating this as permanent
  // would reject valid updates; it's transient. Drain retries until
  // root registers or MAX_ATTEMPTS.
  const { env, state, fetchImpl } = createFakeEnv();
  // Skip registerRoot — collection doesn't exist in DB.
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 202);
  const body = await resp.json();
  assert.equal(body.status, "queued");
  assert.match(body.reason, /collection_not_registered/);
  assert.equal(state.rejected_updates.length, 0, "must NOT write rejected_updates for retryable state");
  assert.equal(state.ingestion_queue.length, 1);
  assert.equal(state.ingestion_queue[0].kind, "collection_update");
});

test("POST /api/collection-updates: sequence gap -> reject", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    updateBody: { ...VALID_UPDATE_BODY, update_sequence: 5 },
  });
  await registerRoot(env, fetchImpl);
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 422);
  const body = await resp.json();
  assert.match(body.reason, /sequence_not_sequential/);
  assert.equal(state.rejected_updates.length, 1);
});

test("POST /api/collection-updates: sat-spend at wrong vin position -> reject (permanent)", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    txOverrides: {
      [`https://mock-electrs-testnet/tx/${UPDATE_COMMIT_TXID}`]: {
        vin: [
          { txid: "f".repeat(64), vout: 1 },           // funding UTXO at vin[0]
          { txid: COLL_REVEAL_TXID, vout: 0 },         // inscription sat at vin[1] — WRONG!
        ],
      },
    },
  });
  await registerRoot(env, fetchImpl);
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  assert.equal(resp.status, 422);
  const body = await resp.json();
  assert.match(body.reason, /vin\[0\] did not match/);
  assert.equal(state.rejected_updates.length, 1, "deterministic mismatch writes audit row");
  assert.equal(state.ingestion_queue.length, 0, "permanent failure must NOT enqueue");
});

test("POST /api/collection-updates: electrs blip on authority fetch is transient (queued)", async () => {
  // Round-4 P1 fix: electrs outages should not permanently reject
  // valid updates. Simulate the reveal tx fetch throwing (stands in for
  // any electrs infra failure). Response must be 202 queued + NO
  // rejected_updates row.
  const { env, state, fetchImpl } = createFakeEnv();
  // Override the authority fetcher to throw on the reveal tx request
  // (which is what electrs would do during an outage).
  const fetchWithElectrsBlip = async (url, opts) => {
    const key = typeof url === "string" ? url : url.toString();
    if (key === `https://mock-electrs-testnet/tx/${UPDATE_REVEAL_TXID}`) {
      throw new Error("electrs connection refused");
    }
    return fetchImpl(url, opts);
  };
  await registerRoot(env, fetchImpl);
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl: fetchWithElectrsBlip,
  });
  assert.equal(resp.status, 202);
  const body = await resp.json();
  assert.equal(body.status, "queued");
  assert.match(body.reason, /electrs connection refused/);
  assert.equal(state.rejected_updates.length, 0, "infra blip must NOT write audit row");
  assert.equal(state.ingestion_queue.length, 1);
});

test("POST /api/collection-updates: content host 5xx is transient (queued)", async () => {
  // GPT round-4 P1: a transient 5xx from content host must not
  // permanently reject. 404 already enqueues; 5xx and 502 are on the
  // same retry path.
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: {
      [`https://mock-content-testnet/${UPDATE_ID}`]: new Response("service unavailable", { status: 503 }),
    },
  });
  await registerRoot(env, fetchImpl);
  // Patch fetchImpl to serve the 503 directly for the update id.
  const fetchWith503 = async (url, opts) => {
    const key = typeof url === "string" ? url : url.toString();
    if (key === `https://mock-content-testnet/${UPDATE_ID}`) {
      return new Response("service unavailable", { status: 503 });
    }
    return fetchImpl(url, opts);
  };
  const resp = await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl: fetchWith503,
  });
  assert.equal(resp.status, 202);
  const body = await resp.json();
  assert.equal(body.status, "queued");
  assert.match(body.reason, /content_host_503/);
  assert.equal(state.rejected_updates.length, 0);
  assert.equal(state.ingestion_queue.length, 1);
});

// =====================================================================
// GET /api/collection/latest
// =====================================================================

test("GET /api/collection/latest: returns aggregated view after updates", async () => {
  const { env, fetchImpl } = createFakeEnv();
  await registerRoot(env, fetchImpl);
  await fetchWorker({
    path: "/api/collection-updates",
    body: { inscription_id: UPDATE_ID, network: "bells-testnet" },
    env, fetchImpl,
  });
  const resp = await fetchWorker({
    method: "GET",
    path: `/api/collection/latest?id=${encodeURIComponent(COLL_ID)}&network=bells-testnet`,
    env, fetchImpl,
  });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.ok, true);
  assert.equal(body.stats.applied_updates, 1);
  // Update prepended MANIFEST_B; root had MANIFEST_A.
  assert.deepEqual(body.aggregated.app_manifest_ids, [MANIFEST_B, MANIFEST_A]);
  assert.equal(body.current_satpoint.reveal_txid, UPDATE_REVEAL_TXID);
});

test("GET /api/collection/latest: unknown collection -> 404", async () => {
  const { env, fetchImpl } = createFakeEnv();
  const resp = await fetchWorker({
    method: "GET",
    path: `/api/collection/latest?id=${encodeURIComponent(COLL_ID)}&network=bells-testnet`,
    env, fetchImpl,
  });
  assert.equal(resp.status, 404);
  const body = await resp.json();
  assert.equal(body.error, "not_found");
});

test("GET /api/collection/latest: bad id -> 400", async () => {
  const { env, fetchImpl } = createFakeEnv();
  const resp = await fetchWorker({
    method: "GET",
    path: "/api/collection/latest?id=not-an-id&network=bells-testnet",
    env, fetchImpl,
  });
  assert.equal(resp.status, 400);
});

// =====================================================================
// Queue drain — collection + collection_update (GPT round-4 gap)
// =====================================================================
// These hit drainCollectionQueueEntry / drainCollectionUpdateQueueEntry
// directly to exercise the cron path that the POST tests cover only
// indirectly ("POST 404 enqueues" leaves the drain itself untested).

function makeQueueEntry(kind, inscriptionId, overrides = {}) {
  return {
    inscription_id: inscriptionId,
    kind,
    network: "bells-testnet",
    attempts: 0,
    last_error: null,
    ...overrides,
  };
}

async function runDrain(handler, { env, fetchImpl, entry }) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try { return await handler(env, entry); }
  finally { globalThis.fetch = real; }
}

// ---- collection drain ----

test("drainCollectionQueueEntry: success path registers root + dequeues", async () => {
  const { env, state, fetchImpl } = createFakeEnv();
  // Simulate a queued entry the cron is draining.
  state.ingestion_queue.push({
    inscription_id: COLL_ID, kind: "collection", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: "prev",
  });
  const outcome = await runDrain(drainCollectionQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection", COLL_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "ok");
  assert.equal(state.collections.length, 1, "root registered");
  assert.equal(state.ingestion_queue.length, 0, "dequeued after success");
});

test("drainCollectionQueueEntry: content host 404 requeues (transient)", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: { [`https://mock-content-testnet/${COLL_ID}`]: 404 },
  });
  state.ingestion_queue.push({
    inscription_id: COLL_ID, kind: "collection", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection", COLL_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "requeued");
  assert.equal(state.collections.length, 0, "not registered yet");
  assert.equal(state.ingestion_queue.length, 1, "stays in queue");
  assert.equal(state.ingestion_queue[0].attempts, 2, "bumped");
});

test("drainCollectionQueueEntry: malformed JSON is permanent -> drop", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: { [`https://mock-content-testnet/${COLL_ID}`]: "not-json-garbage" },
  });
  state.ingestion_queue.push({
    inscription_id: COLL_ID, kind: "collection", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection", COLL_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "dropped");
  assert.equal(state.collections.length, 0);
  assert.equal(state.ingestion_queue.length, 0, "dequeued after permanent fail");
});

test("drainCollectionQueueEntry: schema violation is permanent -> drop (no rejected_updates for collections)", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    // REPLACE_ placeholder is deterministically rejected by strict
    // ingestion validator — not retryable.
    collectionBody: { ...VALID_COLLECTION_BODY, app_manifest_ids: ["REPLACE_ME"] },
  });
  state.ingestion_queue.push({
    inscription_id: COLL_ID, kind: "collection", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection", COLL_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "dropped");
  assert.equal(state.collections.length, 0);
  assert.equal(state.ingestion_queue.length, 0);
  assert.equal(state.rejected_updates.length, 0, "collections have no rejected_updates table");
});

// ---- collection_update drain ----

test("drainCollectionUpdateQueueEntry: success path inserts accepted update + dequeues", async () => {
  const { env, state, fetchImpl } = createFakeEnv();
  await registerRoot(env, fetchImpl);
  state.ingestion_queue.push({
    inscription_id: UPDATE_ID, kind: "collection_update", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionUpdateQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection_update", UPDATE_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "ok");
  assert.equal(state.collection_updates.length, 1);
  assert.equal(state.ingestion_queue.length, 0);
  assert.equal(state.rejected_updates.length, 0);
});

test("drainCollectionUpdateQueueEntry: collection_not_registered is transient -> requeue, NO audit row", async () => {
  // Round-4 invariant: a retryable state MUST NOT pollute
  // rejected_updates even after many retries. The indexer queue
  // self-heals when the root eventually registers.
  const { env, state, fetchImpl } = createFakeEnv();
  // Intentionally skip registerRoot — the update arrives before
  // its collection root.
  state.ingestion_queue.push({
    inscription_id: UPDATE_ID, kind: "collection_update", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionUpdateQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection_update", UPDATE_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "requeued");
  assert.equal(state.ingestion_queue.length, 1);
  assert.equal(state.ingestion_queue[0].attempts, 2);
  assert.equal(state.rejected_updates.length, 0, "must NOT write audit row for retryable state");
  assert.equal(state.collection_updates.length, 0);
});

test("drainCollectionUpdateQueueEntry: sat-spend vin[0] mismatch is permanent -> rejected_updates + drop", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    txOverrides: {
      [`https://mock-electrs-testnet/tx/${UPDATE_COMMIT_TXID}`]: {
        vin: [
          { txid: "f".repeat(64), vout: 1 },
          { txid: COLL_REVEAL_TXID, vout: 0 },  // wrong position — vin[1] not [0]
        ],
      },
    },
  });
  await registerRoot(env, fetchImpl);
  state.ingestion_queue.push({
    inscription_id: UPDATE_ID, kind: "collection_update", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionUpdateQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection_update", UPDATE_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "dropped");
  assert.equal(state.ingestion_queue.length, 0);
  assert.equal(state.collection_updates.length, 0);
  assert.equal(state.rejected_updates.length, 1);
  assert.match(state.rejected_updates[0].reason, /vin\[0\] did not match/);
});

test("drainCollectionUpdateQueueEntry: electrs fetch failure is transient -> requeue, NO audit row", async () => {
  // An electrs blip mid-drain should not permanently reject a valid
  // update. Round-4 P1 fix: authority fetch failures are transient.
  const { env, state, fetchImpl } = createFakeEnv();
  const blipFetch = async (url, opts) => {
    const key = typeof url === "string" ? url : url.toString();
    if (key.startsWith("https://mock-electrs-testnet/tx/")) {
      throw new Error("electrs connection refused");
    }
    return fetchImpl(url, opts);
  };
  await registerRoot(env, fetchImpl);
  state.ingestion_queue.push({
    inscription_id: UPDATE_ID, kind: "collection_update", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionUpdateQueueEntry, {
    env, fetchImpl: blipFetch,
    entry: makeQueueEntry("collection_update", UPDATE_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "requeued");
  assert.equal(state.ingestion_queue.length, 1);
  assert.equal(state.ingestion_queue[0].attempts, 2);
  assert.equal(state.rejected_updates.length, 0, "infra blip must NOT write audit row");
  assert.equal(state.collection_updates.length, 0);
});

test("drainCollectionUpdateQueueEntry: content host 404 requeues (transient)", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: { [`https://mock-content-testnet/${UPDATE_ID}`]: 404 },
  });
  await registerRoot(env, fetchImpl);
  state.ingestion_queue.push({
    inscription_id: UPDATE_ID, kind: "collection_update", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionUpdateQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection_update", UPDATE_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "requeued");
  assert.equal(state.ingestion_queue.length, 1);
  assert.equal(state.rejected_updates.length, 0);
});

test("drainCollectionUpdateQueueEntry: non-JSON body is permanent -> rejected_updates + drop", async () => {
  const { env, state, fetchImpl } = createFakeEnv({
    contentOverrides: { [`https://mock-content-testnet/${UPDATE_ID}`]: "not-json-body" },
  });
  await registerRoot(env, fetchImpl);
  state.ingestion_queue.push({
    inscription_id: UPDATE_ID, kind: "collection_update", network: "bells-testnet",
    enqueued_at: 0, retry_after: 0, attempts: 1, last_error: null,
  });
  const outcome = await runDrain(drainCollectionUpdateQueueEntry, {
    env, fetchImpl,
    entry: makeQueueEntry("collection_update", UPDATE_ID, { attempts: 1 }),
  });
  assert.equal(outcome, "dropped");
  assert.equal(state.ingestion_queue.length, 0);
  assert.equal(state.rejected_updates.length, 1);
  assert.match(state.rejected_updates[0].reason, /fetch_via_queue.*content_not_json/);
});
