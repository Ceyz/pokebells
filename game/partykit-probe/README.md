# PokeBells PartyKit / MMO Probe

Tiny PartyKit server for the Nintondo inscription WebSocket canary and the future
PokeBells chat / challenge / event layer.

It has two connection modes:

- `probe` mode: any connection to a room named `pokebells-probe...` is accepted.
  Use this first to prove that the Nintondo inscription sandbox allows outbound
  WebSockets.
- `wallet` mode: non-probe rooms require the same signed PokeBells sign-in
  fields as the game URL: `wallet`, `sig`, `issued`, `expires`, `nonce`, and
  `inscription` / `inscription_id`. The server verifies the Nintondo signature
  with `game/signin-verify.mjs` before accepting the WebSocket.

It also supports Phase 4.5 position messages:

```json
{
  "type": "position",
  "mapId": "pokebells-probe-map-1",
  "x": 160,
  "y": 144,
  "direction": "down",
  "frame": 1,
  "label": "player",
  "color": "#2f6fe4"
}
```

The server broadcasts those ephemeral positions to the other clients in the
same room. Nothing about positions is canonical or on-chain.

## Deploy Without Local Setup

Use the GitHub Action:

```text
.github/workflows/partykit-cloudflare.yml
```

Add these GitHub repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Also add either this secret or provide the domain input when running the
workflow:

```text
PARTYKIT_DOMAIN=party.bellforge.app
```

Then run **Deploy PartyKit to Cloudflare** from the GitHub Actions tab. This
uses PartyKit cloud-prem, so it deploys into your own Cloudflare account.

PartyKit's docs describe the same deploy shape as:

```powershell
CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> npx partykit deploy --domain party.bellforge.app
```

The WebSocket host does not need Nintondo wallet injection. A `partykit.dev`,
`workers.dev`, or custom Cloudflare host is fine for the realtime server. The
custom non-PSL domain rule still matters for the Companion wallet page, not for
the WebSocket relay.

## Optional Local Install

```powershell
cd Z:\PokeBells\game\partykit-probe
npm install
```

## Optional Local Deploy

If `pokebells-probe` is already taken under your PartyKit account, edit
`partykit.json` and change `name`.

```powershell
cd Z:\PokeBells\game\partykit-probe
npm run deploy
```

PartyKit will print a host like:

```text
pokebells-probe.<your-user>.partykit.dev
```

## Test WebSocket Connectivity

Inscribe:

```text
Z:\PokeBells\game\mainnet-canary\websocket-partykit-probe.html
```

Open the resulting Nintondo inscription with:

```text
?host=pokebells-probe.<your-user>.partykit.dev&room=pokebells-probe
```

The probe will connect to:

```text
wss://pokebells-probe.<your-user>.partykit.dev/parties/main/pokebells-probe
```

The optional HTTP health URL is:

```text
https://pokebells-probe.<your-user>.partykit.dev/parties/main/pokebells-probe
```

Expected success:

- `WebSocket open`
- a `hello` message from the server
- a `probe-ack` after the probe sends its first payload

## Test Avatars On The Same Map

Inscribe:

```text
Z:\PokeBells\game\mainnet-canary\mmo-overlay-probe.html
```

Open it in two browsers, two devices, or two tabs with the same host and room:

```text
?host=party.bellforge.app&room=pokebells-probe-map-1
```

or with the default PartyKit managed host:

```text
?host=pokebells-probe.<your-user>.partykit.dev&room=pokebells-probe-map-1
```

Move with arrows/WASD. Success means:

- both clients connect
- each client shows `peers: 1`
- the other player's avatar moves on the same map canvas

That validates the core Phase 4.5 question before wiring the overlay to the
real emulator map ID `$D35E` and player coordinates.

## Wallet-Gated Rooms

For real chat/map rooms, do not use a `pokebells-probe...` room name. Pass the
signed session fields from the Companion:

```text
wss://<host>/parties/main/global?wallet=<addr>&sig=<sig>&issued=<ms>&expires=<ms>&nonce=<n>&inscription=<id>&network=bells-testnet
```

Cleaner future format:

```text
wss://<host>/parties/main/global?token=pb-chat-v1.<base64url-json>
```

where the JSON contains:

```json
{
  "wallet": "bel1...",
  "sig": "...",
  "issued": 1776600000000,
  "expires": 1776603600000,
  "nonce": "123",
  "inscription": "58bf...i0",
  "network": "bells-mainnet"
}
```

The PartyKit layer is not canonical. It should only carry chat, presence,
challenge coordination, and live UX events. Ownership, mint validity, and
anti-cheat stay on Bells inscriptions plus the open-source indexer.
