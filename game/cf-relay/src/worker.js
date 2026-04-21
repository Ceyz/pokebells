// PokeBells CF relay — stateless worker entry. Routes /parties/main/<room>
// to one Durable Object per room. PartyKit-compatible URL shape so existing
// probes and clients don't need changes beyond the host.

export { RelayRoom } from "./relay-room.js";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "pokebells-cf-relay", version: "v1" });
    }

    const match = url.pathname.match(/^\/parties\/main\/([^/]+)\/?$/);
    if (!match) {
      return json({ ok: false, error: "not_found", path: url.pathname }, { status: 404 });
    }

    const roomId = decodeURIComponent(match[1]);
    if (!roomId || roomId.length > 120) {
      return json({ ok: false, error: "invalid_room" }, { status: 400 });
    }

    const id = env.RELAY_ROOM.idFromName(roomId);
    const stub = env.RELAY_ROOM.get(id);
    return stub.fetch(request);
  },
};
