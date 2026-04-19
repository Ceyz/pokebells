import { verifySigninRequest } from "../../signin-verify.mjs";

const VERSION = "pokebells-partykit-probe-v1";
const RECENT_LIMIT = 50;
const MAX_MESSAGE_BYTES = 2048;
const MAX_TEXT_CHARS = 500;
const MIN_SEND_INTERVAL_MS = 600;
const MIN_POSITION_INTERVAL_MS = 80;
const PROBE_ROOM_RE = /^pokebells-probe(?:$|[-:])/i;
const TOKEN_PREFIX = "pb-chat-v1.";
const DIRECTION_RE = /^(up|down|left|right|idle)$/;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-max-age": "86400",
};

function jsonResponse(body, init = {}) {
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

function readJsonHeader(request, name) {
  const encoded = request.headers.get(name);
  if (!encoded) return null;
  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return null;
  }
}

function writeJsonHeader(request, name, value) {
  request.headers.set(name, encodeURIComponent(JSON.stringify(value)));
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
  const tokenPayload = decodeTokenParam(url.searchParams.get("token"));
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

function isProbeRequest(url, lobby) {
  return url.searchParams.get("probe") === "1" || PROBE_ROOM_RE.test(String(lobby?.id ?? ""));
}

async function authenticate(request, lobby) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") ?? "missing";
  const userAgent = request.headers.get("user-agent") ?? "missing";

  const payload = authPayloadFromUrl(url);
  if (!payload && isProbeRequest(url, lobby)) {
    return {
      mode: "probe",
      wallet: "probe",
      room: String(lobby?.id ?? ""),
      origin,
      userAgent,
      verifiedAt: nowIso(),
      expiresMs: Date.now() + 15 * 60 * 1000,
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

function publicConnection(connection) {
  return {
    id: connection.id,
    auth: publicAuth(connection.state?.auth),
    joinedAt: connection.state?.joinedAt ?? null,
    position: connection.state?.position ?? null,
  };
}

function sendJson(connection, payload) {
  connection.send(JSON.stringify(payload));
}

function broadcastJson(room, payload, excludedIds = []) {
  room.broadcast(JSON.stringify(payload), excludedIds);
}

export default class Server {
  constructor(room) {
    this.room = room;
    this.seq = 0;
    this.recent = [];
  }

  static async onBeforeConnect(request, lobby) {
    try {
      const auth = await authenticate(request, lobby);
      writeJsonHeader(request, "x-pokebells-auth", auth);
      return request;
    } catch (error) {
      return jsonResponse({
        ok: false,
        version: VERSION,
        error: error?.message ?? String(error),
      }, { status: 401 });
    }
  }

  getConnectionTags(_connection, ctx) {
    const auth = readJsonHeader(ctx.request, "x-pokebells-auth");
    const tags = [auth?.mode ?? "unknown"];
    if (auth?.wallet && auth.wallet !== "probe") {
      tags.push(`wallet:${auth.wallet}`);
    }
    return tags;
  }

  async onStart() {
    this.recent = (await this.room.storage.get("recent")) ?? [];
    this.seq = (await this.room.storage.get("seq")) ?? (this.recent.at(-1)?.seq ?? 0);
  }

  async onRequest(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return jsonResponse({
        ok: false,
        error: "Method not allowed.",
      }, { status: 405 });
    }

    const connections = [...this.room.getConnections()].map(publicConnection);

    return jsonResponse({
      ok: true,
      version: VERSION,
      room: this.room.id,
      connectedCount: connections.length,
      connections,
      recent: this.recent.slice(-20),
    });
  }

  async onConnect(connection, ctx) {
    const auth = readJsonHeader(ctx.request, "x-pokebells-auth") ?? {
      mode: "unknown",
      wallet: null,
      origin: ctx.request.headers.get("origin") ?? "missing",
    };
    const state = {
      auth,
      joinedAt: nowIso(),
      lastSentAt: 0,
      lastPositionAt: 0,
      position: null,
    };
    connection.setState(state);

    sendJson(connection, {
      type: "hello",
      version: VERSION,
      room: this.room.id,
      connectionId: connection.id,
      auth: publicAuth(auth),
      connectedCount: [...this.room.getConnections()].length,
      peers: [...this.room.getConnections()]
        .filter((peer) => peer.id !== connection.id)
        .map(publicConnection),
      recent: this.recent.slice(-10),
    });

    broadcastJson(this.room, {
      type: "presence",
      action: "join",
      room: this.room.id,
      ts: nowIso(),
      connectionId: connection.id,
      auth: publicAuth(auth),
      connectedCount: [...this.room.getConnections()].length,
    }, [connection.id]);
  }

  async appendRecent(envelope) {
    this.recent = [...this.recent, envelope].slice(-RECENT_LIMIT);
    await this.room.storage.put("recent", this.recent);
    await this.room.storage.put("seq", this.seq);
  }

  async onMessage(message, sender) {
    if (bytesLength(message) > MAX_MESSAGE_BYTES) {
      sendJson(sender, {
        type: "error",
        code: "message_too_large",
        maxBytes: MAX_MESSAGE_BYTES,
      });
      return;
    }

    let parsed;
    try {
      parsed = typeof message === "string" ? JSON.parse(message) : { type: "binary", byteLength: message.byteLength };
    } catch {
      parsed = { type: "chat", body: String(message ?? "") };
    }

    const state = sender.state ?? {};
    const now = Date.now();
    const auth = state.auth ?? { mode: "unknown", wallet: null };
    const base = {
      seq: this.seq + 1,
      room: this.room.id,
      ts: nowIso(),
      from: publicAuth(auth),
      connectionId: sender.id,
    };

    if (parsed.type === "position") {
      if (now - (state.lastPositionAt ?? 0) < MIN_POSITION_INTERVAL_MS) {
        return;
      }

      const position = {
        mapId: cleanText(parsed.mapId ?? parsed.map_id ?? this.room.id, 80),
        x: clampNumber(parsed.x, 0, 319, 0),
        y: clampNumber(parsed.y, 0, 287, 0),
        direction: DIRECTION_RE.test(String(parsed.direction ?? "")) ? String(parsed.direction) : "idle",
        frame: Math.trunc(clampNumber(parsed.frame, 0, 3, 0)),
        label: cleanText(parsed.label ?? parsed.name ?? auth.wallet ?? sender.id, 24),
        color: cleanText(parsed.color ?? "#3f7cff", 16),
      };
      sender.setState({
        ...state,
        lastPositionAt: now,
        position,
      });

      broadcastJson(this.room, {
        type: "position",
        ...base,
        position,
      }, [sender.id]);
      return;
    }

    if (now - (state.lastSentAt ?? 0) < MIN_SEND_INTERVAL_MS) {
      sendJson(sender, {
        type: "error",
        code: "rate_limited",
        retryAfterMs: MIN_SEND_INTERVAL_MS,
      });
      return;
    }
    sender.setState({ ...state, lastSentAt: now });

    if (parsed.type === "pokebells-websocket-probe" || parsed.type === "ping") {
      sendJson(sender, {
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
        sendJson(sender, { type: "error", code: "empty_chat_message" });
        return;
      }

      this.seq += 1;
      const envelope = {
        type: "chat",
        ...base,
        seq: this.seq,
        body,
      };
      await this.appendRecent(envelope);
      broadcastJson(this.room, envelope);
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
      broadcastJson(this.room, envelope);
      return;
    }

    sendJson(sender, {
      type: "echo",
      ...base,
      received: parsed,
    });
  }

  async onClose(connection) {
    const auth = connection.state?.auth ?? null;
    broadcastJson(this.room, {
      type: "presence",
      action: "leave",
      room: this.room.id,
      ts: nowIso(),
      connectionId: connection.id,
      auth: publicAuth(auth),
      connectedCount: Math.max(0, [...this.room.getConnections()].length - 1),
    }, [connection.id]);
  }

  async onError(connection, error) {
    console.error("connection error", connection.id, error);
  }
}
