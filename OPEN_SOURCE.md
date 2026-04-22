# Open-source resilience model

PokeBells is designed so **anyone can fork the infrastructure and keep the
game running** without the original operators. This document describes what's
open, where the state lives, and how to take over the relay.

## What's open (MIT, see `LICENSE`)

| Component | Path | Role |
|---|---|---|
| Indexer | [`game/indexer/`](game/indexer/) | CF Worker + D1 DB that validates and caches capture/reveal/save/evolve inscriptions |
| Companion UI | [`companion/pokebells/index.html`](companion/pokebells/index.html) | Mint + reveal + save flows, wallet integration |
| PBRP relay | [`game/cf-relay/`](game/cf-relay/) | Hostless signature-verified relay for sign-in handshakes |
| Sign-in helpers | [`game/signin-verify.mjs`](game/signin-verify.mjs), [`game/pbrp/`](game/pbrp/) | Session key + request verification |
| Bootloader manifest schema | [`game/manifest.template.json`](game/manifest.template.json) | Maps `p:pokebells-manifest` keys to child inscription ids |
| Bells capture schema docs | [`memory/schema_v14_commit_reveal.md`](memory/schema_v14_commit_reveal.md) | Canonical spec for `p:pokebells` op types |

### What's NOT open

- The Pokemon Crystal ROM (`game/pokecrystal.gbc`, `game/pokecrystal-pokebells.gbc`)
  is gitignored. Rebuild from source: see [memory/pokebells_rom_patch.md](memory/pokebells_rom_patch.md).
  The disassembly at [pret/pokecrystal](https://github.com/pret/pokecrystal) is
  community-maintained and licensed separately.
- Any Pokemon sprite / animation asset from the pokecrystal disasm.
  We ship sprite generators (`tools/import-pokecrystal-sprites.mjs`) that
  re-derive these locally — no Nintendo-owned bytes are redistributed.
- ROM chunks in `game/chunks/` (gitignored).

## Where does the game state live?

Everything user-owned is **on-chain** via Bells ordinal inscriptions. The
indexer is a cache — you can throw it away and rebuild from the inscriptions.

| State | Storage | On-chain? | Destructible? |
|---|---|---|---|
| Captured Pokemon | `op:"capture"` inscription | ✅ | immutable |
| Revealed IVs + EVs + ram snapshot | `op:"reveal"` inscription | ✅ | immutable |
| Evolution history | `op:"evolve"` inscriptions (signed) | ✅ | immutable |
| Level / moves / EV deltas over time | `op:"update"` inscriptions (signed) | ✅ | immutable |
| 32 KB SRAM save | `op:"save-snapshot"` inscription | ✅ | immutable; latest save_version wins |
| Bootloader module map | `p:pokebells-manifest` inscription | ✅ | new inscription replaces old |
| Canonical indexer / companion URLs | `p:pokebells-collection` inscription (planned) | ✅ | new inscription extends the list |
| Browser ROM cache | IndexedDB `roms` store | ❌ | safe to clear, re-fetched from chunks |
| Local SRAM mirror | IndexedDB `saves` store | ❌ | safe to clear, re-fetched from `op:"save-snapshot"` |
| Private reveal preimages (salt + ivs + ram) | IndexedDB `captureReveals` store | ❌ | if lost, captures can't be revealed later — back them up by inscribing the reveal early |

## The "anyone can take over" checklist

If the original operators disappear (domain expiry, dev incapacitated, etc.):

### Take over the indexer (2-3 hours)

1. Fork https://github.com/Ceyz/pokebells to your own account.
2. Create a Cloudflare account, create a D1 database named
   `pokebells-indexer`, paste the ID into `game/indexer/wrangler.toml`.
3. Add CF API token secret (`CLOUDFLARE_API_TOKEN` with Workers Scripts
   + D1 Edit scopes) to your GitHub Actions secrets.
4. Push a commit. CI applies `schema.sql` + deploys the Worker to your
   account. You now have a working empty indexer at
   `https://pokebells-indexer.<your-subdomain>.workers.dev`.
5. Tell users: `?indexer=https://pokebells-indexer.<your-subdomain>.workers.dev`
   OR `localStorage.setItem('pokebells:indexer_url', '<url>')`.

### Rebuild the indexer state (slow, ~all historical captures)

There are three paths, from easiest to hardest:

**A. Cooperative handoff.** Ask the previous operator to dump D1 via
`wrangler d1 export pokebells-indexer --output=pokebells.sqlite` and
import into yours via `wrangler d1 execute --file=pokebells.sqlite`.
Full state transfer in minutes.

**B. Re-ingest from user tips.** Users who know their inscription ids
POST them to your indexer's `/api/captures` or `/api/reveals` or
`/api/saves`. Incremental rebuild, no operator coop needed.

**C. Chain scan (no Nintondo API yet).** Run a Bells full node, walk
every block from the collection's mint-root block forward, extract
inscriptions, filter by `p == "pokebells"`, feed to your indexer.
Time-intensive but fully decentralized. See
`tools/bootstrap-indexer-replay.mjs` (planned) for a reference walker
once a Bells ord-like index is available.

### Take over the companion (15 minutes)

1. Host a static copy of `companion/pokebells/index.html` anywhere
   (Cloudflare Pages, GitHub Pages, your own server).
2. Edit `INDEXER_BASE` in the HTML to point at your or the community's
   indexer URL.
3. Tell users: `?companion=<your-url>` OR
   `localStorage.setItem('pokebells:companion_url', '<url>')`.

### The 100% decentralized play URL (wallet-bridge pattern)

**Problem.** The Nintondo wallet extension injects `window.nintondo` on
`nintondo.io` but NOT on `bells-{network}-content.nintondo.io/content/<id>`.
So the canonical on-chain URL of the game bootloader (the root inscription
served from the content host) cannot directly talk to the wallet. Without
a wallet, no mint, no reveal, no save.

**Solution.** A thin wrapper HTML we ship as
[`companion/pokebells/play-bridge.html`](companion/pokebells/play-bridge.html)
that any operator (you, a mirror, a community member) can host on any
origin where the wallet extension DOES inject (nintondo.io itself,
bellforge.app, a user's localhost, Cloudflare Pages, GitHub Pages, IPFS
gateway, etc.). That wrapper:

1. Embeds the on-chain game in an iframe (`?game=<url>` param, default is
   the mainnet root inscription content URL).
2. Listens for `postMessage({__pokebells_bridge:1, type:'nintondo:call',
   method, args, id})` from the iframe.
3. Forwards each call to the local `window.nintondo[method](...args)`.
4. Posts the result back to the iframe as
   `{type:'nintondo:result', id, result|error}`.

On the game side, `game/index.html` ships an inline ~50-line shim that:
- Detects "in iframe + no `window.nintondo` injected" → installs a Proxy
  at `window.nintondo` that forwards every method call across postMessage
  to the parent bridge.
- Does nothing when the wallet IS already injected (dev, localhost,
  bellforge.app-served game) — the adapter talks to the real extension
  directly in that case.

The game code (`wallet-adapter.mjs`, `shell.js`, companion flows) never
sees the difference. It's transparent.

**User flow in full decentralization:**

1. User opens ANY bridge URL. For example:
   - `https://bellforge.app/pokebells/play-bridge.html` (canonical)
   - `https://community-mirror.example/play-bridge.html` (mirror)
   - `http://localhost:8765/companion/pokebells/play-bridge.html` (self-hosted)
   - Any inscribed copy of play-bridge.html served from a content host
     that the wallet targets (unusual but possible).
2. Bridge HTML loads, detects `window.nintondo`, shows "wallet ✓".
3. Bridge embeds the game inscription URL in an iframe (configurable via
   `?game=<url>`).
4. Game shim detects iframe + no wallet → installs postMessage proxy.
5. User plays. When they mint/reveal/sync-save, the game calls
   `window.nintondo.signMessage(...)` → proxy → bridge → real wallet →
   result → proxy → game. Zero-friction.

Bookmark any bridge URL and the canonical on-chain game stays playable
for as long as SOMEONE runs a copy of play-bridge.html ANYWHERE the
Nintondo wallet injects.

**Fully self-hosted quickstart (2 commands):**

```bash
git clone https://github.com/Ceyz/pokebells.git
cd pokebells && python -m http.server 8765
# Open http://localhost:8765/companion/pokebells/play-bridge.html
#   ?game=http://localhost:8765/game/index.html?manifest=manifest.pokebells.json
```

If the Nintondo wallet extension includes `localhost` in its
content_scripts.matches (it typically does for dev), `window.nintondo`
is injected on both the bridge page AND the game iframe. The bridge
becomes a no-op and everything works as if on bellforge.app.

### Inscribed fallback (when even GitHub is down)

The indexer source code can itself be inscribed on Bells so fetching it
never depends on any specific host. See `tools/package-indexer-for-inscription.mjs`
(shipped) — produces a deterministic bundle of `worker.js + validator.js +
db.js + schema.sql + package.json + wrangler.toml + README.md` ready to
inscribe as a multi-file archive OR individually. The per-file hashes
are pinned so any consumer can verify they got the canonical bytes.

Post-mint roadmap: inscribe the indexer bundle + reference its ids
inside `p:pokebells-collection`. Then the bootstrap becomes:
1. Fetch `p:pokebells-collection` inscription from any Bells content host
2. Read `indexer_source_inscriptions[]`
3. Fetch each source file
4. Run locally via `wrangler dev` or deploy to your CF account

GitHub + this repo become optional convenience at that point.

## Upgrade governance

- Schema changes (capture / reveal / update / evolve / save-snapshot
  shape) are ratified by inscribing a new `p:pokebells-manifest` with an
  updated `schema_version` field. Older versions continue to validate
  against the original schema doc inscribed at mainnet-root mint time.
- Breaking changes (deprecations, field removals) require inscribing a
  new collection metadata inscription that bumps the protocol `v`.
- Community forks can diverge schema-wise: the `p` field distinguishes
  them (`p: "pokebells"` vs a fork's `p: "pokebells-myfork"`), and the
  on-chain collection inscription binds the canonical indexer_urls[]
  list for each `p` namespace.

## Trust model

**Indexer operators are not trusted.** Every capture / reveal / update /
save validation is reproducible — the indexer's D1 row can be re-derived
from the raw inscription content bytes + the validator code, both of
which are public. If an operator rejects a legitimate capture you can
run your own indexer, post the same inscription to it, and get the
correct row.

**Canonical URLs are trusted only for discovery.** The companion + game
shell read indexer URLs from: (1) URL param, (2) localStorage, (3)
fallback list baked into the inscribed shell. None of these are
security-critical — a malicious indexer cannot forge captures (client-
and validator-side cryptographic checks see to that), it can only
refuse to serve them.

**Wallet signatures are the only real authority.** `signed_in_wallet`
binds each capture to a Bells wallet. `signature` (coming with op:
update / evolve) proves ownership-transfers + state deltas. An indexer
that accepts an update without a valid signature is broken; clients
can reject it and fall back to a peer indexer.
