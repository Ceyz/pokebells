# Extension vs Substitution — PokeBells design principle

PokeBells is a Pokemon-style monster-catching game where every capture
becomes an ordinal inscription on the Bells blockchain. We mean it — the
chain is the source of truth, not a backup of an off-chain database.

This doc records the principle we use to decide whether a given off-chain
service (indexer, hub, bridge, electrs proxy, etc.) is acceptable and how
to scope it so the project stays "Bitcoin-native" rather than "Bitcoin
with a centralised middleman".

## The principle (credit: switch_900)

> Breaking out of the sandbox should be a feature, not a dependency.
>
> If the data is on Bitcoin, everyone should have free and fair access to it.
> If the data is not on Bitcoin, the sandbox should still matter.
>
> The polished path can be automatic. The resilient path must still exist.

Translation for builders:

| Allowed | Forbidden |
|---|---|
| **Extension** — convenience layers, optional acceleration, fallbacks | **Substitution** — moving core logic / asset data / trust off-chain |
| Public Bitcoin data accessed via convenient APIs | Off-chain "essential" data the app needs to function |
| Communication / relay infrastructure | Private server dependence with no fallback |
| Convenience broadcasting | Critical broadcast path with no Bitcoin Core fallback |
| Optional automation that smooths UX | Automation that becomes the only path |

The litmus test: **the app must still fundamentally work without the
external connection**. If you turn off bellforge.app + our indexer
tomorrow, can a stranger still verify, trade, and (with manual effort)
re-display every Pokemon? If yes, the off-chain layer is an extension.
If no, you've smuggled in a substitution.

## PokeBells audit

| Component | Status | Verdict |
|---|---|---|
| Game source code (`boot.js`, `shell.js`, `capture-core.mjs`, …) | Inscribed on-chain via the manifest tree | ✅ Substance |
| ROM chunks (Pokemon Crystal _POKEBELLS) | Inscribed on-chain (9 chunks + manifest) | ✅ Substance |
| Sprite pack (251 species × 2 variants) | Inscribed on-chain via `p:pokebells-sprites` manifest | ✅ Substance |
| `op:"capture_commit"` (cryptographic receipt) | Inscribed on-chain | ✅ Substance |
| `op:"mint"` (canonical Pokemon NFT) | Inscribed on-chain with full preimages (IVs, EVs, shiny, RAM) | ✅ Substance — independently verifiable |
| `pokebells_inscriber` (client-side PSBT builder) | Inscribed on-chain as 8th ES module + bundled in Pages deploy | ✅ Substance — usable from any wallet-enabled origin |
| `play-bridge.html` (wallet relay shim) | Inscribed on-chain + served from bellforge.app + fork-able to any static host | ✅ Extension with deliberate fork-ability |
| `bellforge.app/pokebells/` (hub UI) | GitHub Pages from public repo | ✅ Extension — pure presentation layer |
| Indexer (`pokebells-indexer.ceyzcrypto.workers.dev`) | CF Worker reading the chain + serving cached query API | ✅ Extension — can be re-derived from chain by any fork |
| `electrs` (UTXO + tx broadcast) | Nintondo's hosted instance | ⚠️ Extension — **URL must be replaceable** (currently hardcoded fallback in some paths) |
| Nintondo wallet extension (`window.nintondo`) | Browser-side, user-installed | ✅ Substance — user owns the keys; the wallet UI is just signing |

## What stays off-chain by design

These layers are **acceptable substitutions** because (a) they accelerate
UX and (b) reverting to on-chain-only still gives a working flow:

- **The indexer's query API** (pokedex, leaderboard, trainer view).
  Without it, a sceptical user can fetch every `op:"mint"` inscription
  manually, run our published validator, and see the same set. Our
  worker just caches.
- **bellforge.app's UI**. Without it, anyone can clone
  [companion/pokebells/](companion/pokebells/) to any static host (or
  inscribe it on-chain too) and play exactly the same game.
- **Tx broadcast via electrs**. Without it, run a local Bells Core node
  and broadcast directly. The PSBT is identical.
- **Block hash provenance fetch via electrs**. Same fallback — Bells
  Core gives the same answer.

## What MUST stay on-chain

- **Capture commitments** (`ivs_commitment`, `ram_snapshot_hash`,
  `attestation`). Without these on-chain, the anti-cheat falls apart.
- **Mint preimages** (full IVs, salt, RAM snapshot). Without these
  on-chain, marketplaces would have to trust our indexer to "open" the
  commitments. v1.5 explicitly puts them in the mint inscription so any
  third party can verify.
- **The collection identity** (the set of valid `op:"mint"` inscriptions
  per `ref_capture_commit`). The on-chain `p:pokebells-collection`
  parent inscription (planned post-mainnet) lets any marketplace /
  wallet enumerate canonical Pokemon without our indexer.

## What's NOT acceptable (red lines)

These are the patterns we explicitly refuse, even if they'd improve UX:

- **Off-chain reveal as the default.** v1.4 had a
  `POST /api/reveals/offchain` endpoint that let users skip the second
  inscription. v1.5 removes this from the UI: the cryptographic anchor
  must be on-chain, full stop. The endpoint is kept in code only for
  legacy v1.4 testnet records.
- **Hidden indexer-side state.** If a Pokemon's traits aren't fully
  derivable from the inscription bytes + the canonical sprite manifest,
  we have an opaque dependency on us. Every check in
  [SCHEMA-v1.5.md](SCHEMA-v1.5.md) is reproducible from public data.
- **Quick mint mode.** Earlier drafts proposed "skip the second
  inscription, post preimages to indexer for instant reveal". Killed:
  fragments the collection (some Pokemon canonical, some indexer-only),
  weakens the trust model, and tempts users into the worse path because
  it's faster. One canonical flow, no fork.
- **Wallet API extensions that bypass user confirmation.** The wallet
  popup for every `signPsbt` is non-negotiable. We never sign on the
  user's behalf, ever, even with their session key.

## Resilience checklist (review at every release)

Before shipping a new feature, ask:

1. If `bellforge.app` and `*.workers.dev` are unreachable for 30 days,
   does this feature still work? If no — what's the fallback?
2. If the user blocks JS from `*.nintondo.io`, can they still verify the
   inscription bytes locally? (Should be yes — capture-core.mjs +
   gen2-species.mjs are themselves inscribed.)
3. If the indexer schema changes, are the on-chain inscriptions still
   valid, or did we silently couple the spec to our DB? (Spec changes
   should be additive — `ram_witness_scheme` is the example: new mints
   can publish `merkle:v1` without invalidating old `full_wram8k:v1`.)
4. Is there an "advanced" UI path that lets a power user bypass our
   default flow entirely (e.g. raw PSBT inspection, manual paste,
   `?indexer=...` override)? If no — add one.

## The line that matters

> If an inscription claims to be the app, the artwork, the object, or
> the source of truth, then the critical parts of that should remain
> grounded in Bitcoin. Otherwise the inscription becomes little more
> than a pointer to a service.

— switch_900

A PokeBells Pokemon is not "an entry in our indexer with a Bells
inscription as a receipt". It's a Bells inscription with our indexer as
a convenience cache. The day someone deploys a competing indexer + UI
on top of the same on-chain data, our players don't lose anything. That
property is the whole point.
