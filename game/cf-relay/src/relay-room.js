// PokeBells relay Durable Object. One DO instance per room, identified by
// path /parties/main/<room>. Ports the PartyKit-probe server.js logic to
// raw Cloudflare Workers so the deploy only needs CLOUDFLARE_* secrets —
// no third-party account, no interactive login.
//
// Auth modes (same as the PartyKit version):
//   - probe: room id matching /^pokebells-probe(?:$|[-:])/i bypasses wallet
//     verification. Used by canary pages.
//   - wallet: URL params {wallet, sig, issued, expires, nonce, inscription}
//     are verified via signin-verify.mjs before the WebSocket upgrade.
//
// Rate limits: 600 ms general, 80 ms position, 2 KB message cap, 50 msg
// rolling ring. Storage keys: "recent", "seq".

import { verifySigninRequest } from "../../signin-verify.mjs";

const VERSION = "pokebells-cf-relay-v1";
const RECENT_LIMIT = 50;
const MAX_MESSAGE_BYTES = 2048;
const MAX_TEXT_CHARS = 500;
const MIN_SEND_INTERVAL_MS = 600;
const MIN_POSITION_INTERVAL_MS = 80;
const PROBE_ROOM_RE = /^pokebells-probe(?:$|[-:])/i;
const TOKEN_PREFIX = "pb-chat-v1.";
const DIRECTION_RE = /^(up|down|left|right|idle)$/;
const PROBE_TTL_MS = 15 * 60 * 1000;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type,upgrade",
  "access-control-max-age": "86400",
};

function json(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, maxChars = MAX_TEXT_CHARS) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxChars);
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function bytesLength(value) {
  if (typeof value === "string") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value?.byteLength ?? 0;
}

function decodeBase64UrlJson(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function decodeTokenParam(value) {
  const token = String(value ?? "").trim();
  if (!token) return null;
  if (token.startsWith("{")) return JSON.parse(token);
  return decodeBase64UrlJson(token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : token);
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function safeInteger(value, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid ${label}.`);
  }
  return parsed;
}

function authPayloadFromUrl(url) {
  let tokenPayload = null;
  try {
    tokenPayload = decodeTokenParam(url.searchParams.get("token"));
  } catch {
    tokenPayload = null;
  }
  const source = tokenPayload ?? Object.fromEntries(url.searchParams.entries());

  const wallet = pickFirst(source.wallet, source.address);
  const signature = pickFirst(source.sig, source.signature);
  const issuedMs = pickFirst(source.issuedMs, source.issued, source.iat);
  const expiresMs = pickFirst(source.expiresMs, source.expires, source.exp);
  const nonce = pickFirst(source.nonce);
  const inscriptionId = pickFirst(source.inscriptionId, source.inscription_id, source.inscription, source.id);

  if (!wallet || !signature || !issuedMs || !expiresMs || !nonce || !inscriptionId) {
    return null;
  }

  return {
    request: {
      wallet: String(wallet).trim(),
      signature: String(signature).trim(),
      issuedMs: safeInteger(issuedMs, "issued timestamp"),
      expiresMs: safeInteger(expiresMs, "expiry timestamp"),
      nonce: String(nonce),
      inscriptionId: String(inscriptionId).trim(),
    },
    network: pickFirst(source.network, source.capture_network, url.searchParams.get("network")),
  };
}

function isProbeRequest(url, roomId) {
  return url.searchParams.get("probe") === "1" || PROBE_ROOM_RE.test(String(roomId ?? ""));
}

function publicAuth(auth) {
  return {
    mode: auth?.mode ?? "unknown",
    wallet: auth?.wallet ?? null,
    inscriptionId: auth?.inscriptionId ?? null,
    servicesKey: auth?.servicesKey ?? null,
    publicKeySource: auth?.publicKeySource ?? null,
    origin: auth?.origin ?? null,
    verifiedAt: auth?.verifiedAt ?? null,
    expiresMs: auth?.expiresMs ?? null,
  };
}

function publicConnection(state) {
  return {
    id: state?.connectionId ?? null,
    auth: publicAuth(state?.auth),
    joinedAt: state?.joinedAt ?? null,
    position: state?.position ?? null,
  };
}

export class RelayRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.seq = 0;
    this.recent = [];
    this.roomId = null;
    this.state.blockConcurrencyWhile(async () => {
      this.recent = (await state.storage.get("recent")) ?? [];
      this.seq = (await state.storage.get("seq")) ?? (this.recent.at(-1)?.seq ?? 0);
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/parties\/main\/([^/]+)\/?$/);
    if (!match) {
      return json({ ok: false, error: "not_found" }, { status: 404 });
    }
    this.roomId = this.roomId ?? decodeURIComponent(match[1]);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.headers.get("upgrade") === "websocket") {
      return this.handleWebSocket(request, url);
    }

    if (request.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    const connections = [...this.sessions.values()].map(publicConnection);
    return json({
      ok: true,
      version: VERSION,
      room: this.roomId,
      connectedCount: connections.length,
      connections,
      recent: this.recent.slice(-20),
    });
  }

  async authenticate(request, url) {
    const origin = request.headers.get("origin") ?? "missing";
    const userAgent = request.headers.get("user-agent") ?? "missing";

    let payload;
    try {
      payload = authPayloadFromUrl(url);
    } catch (err) {
      throw new Error(`Invalid auth payload: ${err?.message ?? err}`);
    }

    if (!payload && isProbeRequest(url, this.roomId)) {
      return {
        mode: "probe",
        wallet: "probe",
        room: this.roomId,
        origin,
        userAgent,
        verifiedAt: nowIso(),
        expiresMs: Date.now() + PROBE_TTL_MS,
      };
    }

    if (!payload) {
      throw new Error("Missing wallet auth. Use a PokeBells signed session token, or connect to a pokebells-probe room for the canary.");
    }

    const verified = await verifySigninRequest(payload.request, {
      network: payload.network,
      nowMs: Date.now(),
    });

    return {
      mode: "wallet",
      wallet: verified.wallet,
      inscriptionId: verified.inscriptionId,
      servicesKey: verified.services?.key ?? null,
      publicKeySource: verified.publicKeySource,
      origin,
      userAgent,
      verifiedAt: verified.verifiedAt,
      expiresMs: verified.expiresMs,
    };
  }

  async handleWebSocket(request, url) {
    let auth;
    try {
      auth = await this.authenticate(request, url);
    } catch (err) {
      return json({
        ok: false,
        version: VERSION,
        error: err?.message ?? String(err),
      }, { status: 401 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const connectionId = crypto.randomUUID();
    const sessionState = {
      auth,
      connectionId,
      joinedAt: nowIso(),
      lastSentAt: 0,
      lastPositionAt: 0,
      position: null,
    };
    this.sessions.set(server, sessionState);

    this.send(server, {
      type: "hello",
      version: VERSION,
      room: this.roomId,
      connectionId,
      auth: publicAuth(auth),
      connectedCount: this.sessions.size,
      peers: [...this.sessions.entries()]
        .filter(([ws]) => ws !== server)
        .map(([, s]) => publicConnection(s)),
      recent: this.recent.slice(-10),
    });

    this.broadcast({
      type: "presence",
      action: "join",
      room: this.roomId,
      ts: nowIso(),
      connectionId,
      auth: publicAuth(auth),
      connectedCount: this.sessions.size,
    }, server);

    server.addEventListener("message", (event) => {
      this.onMessage(server, event.data).catch((err) => {
        console.error("relay onMessage error", err);
      });
    });

    const cleanup = () => this.closeConnection(server);
    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      this.closeConnection(ws);
    }
  }

  broadcast(payload, exclude) {
    const msg = JSON.stringify(payload);
    for (const [ws] of this.sessions) {
      if (ws === exclude) continue;
      try {
        ws.send(msg);
      } catch {
        this.closeConnection(ws);
      }
    }
  }

  closeConnection(ws) {
    const state = this.sessions.get(ws);
    if (!state) return;
    this.sessions.delete(ws);
    try { ws.close(1000, "closed"); } catch { /* already closed */ }
    this.broadcast({
      type: "presence",
      action: "leave",
      room: this.roomId,
      ts: nowIso(),
      connectionId: state.connectionId,
      auth: publicAuth(state.auth),
      connectedCount: this.sessions.size,
    });
  }

  async appendRecent(envelope) {
    this.recent = [...this.recent, envelope].slice(-RECENT_LIMIT);
    await this.state.storage.put("recent", this.recent);
    await this.state.storage.put("seq", this.seq);
  }

  async onMessage(sender, message) {
    const state = this.sessions.get(sender);
    if (!state) return;

    if (bytesLength(message) > MAX_MESSAGE_BYTES) {
      this.send(sender, {
        type: "error",
        code: "message_too_large",
        maxBytes: MAX_MESSAGE_BYTES,
      });
      return;
    }

    let parsed;
    try {
      parsed = typeof message === "string"
        ? JSON.parse(message)
        : { type: "binary", byteLength: message.byteLength ?? 0 };
    } catch {
      parsed = { type: "chat", body: String(message ?? "") };
    }

    const now = Date.now();
    const auth = state.auth ?? { mode: "unknown", wallet: null };
    const base = {
      seq: this.seq + 1,
      room: this.roomId,
      ts: nowIso(),
      from: publicAuth(auth),
      connectionId: state.connectionId,
    };

    if (parsed.type === "position") {
      if (now - (state.lastPositionAt ?? 0) < MIN_POSITION_INTERVAL_MS) return;

      const position = {
        mapId: cleanText(parsed.mapId ?? parsed.map_id ?? this.roomId, 80),
        x: clampNumber(parsed.x, 0, 319, 0),
        y: clampNumber(parsed.y, 0, 287, 0),
        direction: DIRECTION_RE.test(String(parsed.direction ?? "")) ? String(parsed.direction) : "idle",
        frame: Math.trunc(clampNumber(parsed.frame, 0, 3, 0)),
        label: cleanText(parsed.label ?? parsed.name ?? auth.wallet ?? state.connectionId, 24),
        color: cleanText(parsed.color ?? "#3f7cff", 16),
      };
      state.lastPositionAt = now;
      state.position = position;

      this.broadcast({
        type: "position",
        ...base,
        position,
      }, sender);
      return;
    }

    if (now - (state.lastSentAt ?? 0) < MIN_SEND_INTERVAL_MS) {
      this.send(sender, {
        type: "error",
        code: "rate_limited",
        retryAfterMs: MIN_SEND_INTERVAL_MS,
      });
      return;
    }
    state.lastSentAt = now;

    if (parsed.type === "pokebells-websocket-probe" || parsed.type === "ping") {
      this.send(sender, {
        type: "probe-ack",
        ...base,
        receivedType: parsed.type,
        receivedAt: nowIso(),
      });
      return;
    }

    if (parsed.type === "chat") {
      const body = cleanText(parsed.body ?? parsed.text ?? parsed.message);
      if (!body) {
        this.send(sender, { type: "error", code: "empty_chat_message" });
        return;
      }
      this.seq += 1;
      const envelope = { type: "chat", ...base, seq: this.seq, body };
      await this.appendRecent(envelope);
      this.broadcast(envelope);
      return;
    }

    if (parsed.type === "event" || parsed.type === "challenge") {
      this.seq += 1;
      const envelope = {
        type: parsed.type,
        ...base,
        seq: this.seq,
        kind: cleanText(parsed.kind ?? parsed.event ?? parsed.challenge, 80),
        payload: parsed.payload ?? null,
      };
      await this.appendRecent(envelope);
      this.broadcast(envelope);
      return;
    }

    this.send(sender, {
      type: "echo",
      ...base,
      received: parsed,
    });
  }
}
