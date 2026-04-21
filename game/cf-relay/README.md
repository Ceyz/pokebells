# PokeBells CF Relay

Raw Cloudflare Worker + Durable Object implementation of the PokeBells relay.
Same wire protocol as the PartyKit-probe server (`/parties/main/<room>`),
same auth modes (probe rooms bypass wallet check, others require a signed
PokeBells session URL), same rate limits. No third-party account, no
interactive CLI login — deploys with only `CLOUDFLARE_ACCOUNT_ID` +
`CLOUDFLARE_API_TOKEN` via `wrangler deploy`.

## Deploy

From CI: push to `main` with changes under `game/cf-relay/` triggers
`.github/workflows/cf-relay.yml`, which runs `npx wrangler deploy` with the
same CF secrets already configured for the repo.

Local:

```powershell
cd Z:\PokeBells\game\cf-relay
npm ci
npx wrangler deploy
```

First deploy uses the `workers.dev` subdomain (returned as
`pokebells-relay.<account>.workers.dev`). Update the probe's **Relay host**
field to that hostname to test.

## Custom Domain (later)

Uncomment the `[[routes]]` block in `wrangler.toml` and redeploy to bind
`party.bellforge.app`. The `CLOUDFLARE_API_TOKEN` needs Workers Scripts:Edit,
Zone:Zone:Edit, Zone:DNS:Edit on the `bellforge.app` zone. Wrangler will
auto-create the DNS record.

## Architecture

- `src/worker.js` — stateless entry. Routes `/parties/main/<room>` to one
  Durable Object per room (`env.RELAY_ROOM.idFromName(roomId)`).
- `src/relay-room.js` — `RelayRoom` DO. Authenticates via
  `../../signin-verify.mjs`, upgrades to WebSocket, relays signed
  messages, stores the last 50 in DO storage for newcomer catch-up.

## PBRP and This Relay

Per Phase 4.5 design: the relay is dumb transport. PBRP envelopes carry
their own session signatures and are verified client-side. The relay only
enforces rate limits, message size caps, and optional wallet gating on
non-probe rooms. Any other relay (PartyKit, a self-hosted node, a future
P2P layer) can replace this one without breaking clients.
