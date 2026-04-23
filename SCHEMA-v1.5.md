# PokeBells Schema v1.5 — `capture_commit` + `mint`

**Status**: spec frozen 2026-04-23. Supersedes v1.4 (`op:"capture"` + `op:"reveal"`).
**Migration cost**: zero — only PoC testnet inscriptions exist, no mainnet to keep compatible.

## Why v1.5

v1.4 minted `op:"capture"` as the primary NFT and used `op:"reveal"` to expose
hidden traits later. Two problems with that:

1. **Marketplace pollution**: a marketplace that lists every `op:"capture"`
   inscription sees Pokémon with `attributes: ["IV HP": "Hidden"]` placeholders.
   The reveal arrives later, but the capture already polluted the listing.
2. **Confusing canonical NFT**: which inscription IS "the Pokémon"? The
   capture (with commitments) or the reveal (with the actual values)? Wallets
   and marketplaces have to guess.

v1.5 reframes the same two-inscription protocol so the boundary is clean:

- `op:"capture_commit"` is a **technical receipt** — opaque, no marketplace
  metadata, not a listable NFT. It exists purely to anchor the cryptographic
  commitments at capture time.
- `op:"mint"` is **the canonical Pokémon NFT** — marketplace-ready with
  top-level `name` / `image` / `attributes`, references its commit by id,
  contains the revealed preimages so the cryptographic anchor can be verified.

Same anti-cheat (commit-reveal binding via `ivs_commitment` and
`ram_snapshot_hash`), better separation of concerns, marketplace gets exactly
one inscription per Pokémon to index.

## Non-goals

- Off-chain reveal. v1.4 introduced `POST /api/reveals/offchain` as a
  fallback. v1.5 deprecates that path: the indexer endpoint stays in code
  for legacy testnet records but is not exposed in any UI. Mainnet
  inscriptions are all-or-nothing on-chain.
- Merkle proof for RAM snapshot. The `ram_witness_scheme` field is
  extensible (`"full_wram8k:v1"` today, future `"merkle:v1"`), but Merkle is
  not in scope for v1.5. Cost optimization, not correctness.
- Wallet signature over mint content. v1.6 hardening once Nintondo's
  `signMessage` BIP-322 format is probed (see memory
  `nintondo_signmessage_format.md`). Adds anti-forgery on top of the
  existing anti-replay (first-valid-per-commit + owner check).

## Inscription bodies

### `op:"capture_commit"`

The cryptographic receipt. Contains no species/level/IV-related data — those
are pinned implicitly via `ram_snapshot_hash` (the snapshot bytes determine
the party slot's species + level + DVs) and revealed in the matching `mint`.

```json
{
  "p": "pokebells",
  "op": "capture_commit",
  "schema_version": "1.5",

  "signed_in_wallet": "tb1p...",
  "session_sequence_number": 1,
  "capture_network": "bells-testnet",
  "block_hash_at_capture": "<64hex>",
  "game_rom_sha256": "<64hex>",

  "party_slot_index": 2,

  "ivs_commitment": "<64hex>",
  "ivs_commitment_scheme": "sha256:canonical(ivs)+salt_32b:v1",

  "ram_snapshot_hash": "<64hex>",
  "ram_commitment_scheme": "sha256:wram8k:v1",
  "svbk_at_capture": 1,

  "attestation": "<64hex>",
  "attestation_scheme": "sha256:block_hash+ram_snapshot_hash+svbk+signed_wallet+session_sequence+ivs_commitment+party_slot_index:v2.1"
}
```

**Field notes**:
- `party_slot_index` (1..6) is exposed as a top-level field AND folded into the
  attestation. Pinning the slot at commit time prevents a minter from later
  picking a different party slot from the same RAM snapshot.
- `svbk_at_capture` is always `1` for v1.1+ / v2.x attestations. v1 reads
  bank 0 + bank 1 with SVBK forced to 1 then restored.
- No `nft_metadata`. No top-level `name` / `image` / `attributes`. Marketplaces
  filtering on `op:"mint"` ignore commits.

### `op:"mint"`

The canonical Pokémon NFT. Marketplace-ready, contains the revealed preimages
that match the commit's hashes, mirrors `signed_in_wallet` so it's
self-descriptive without needing to fetch the commit.

```json
{
  "p": "pokebells",
  "op": "mint",
  "schema_version": "1.5",

  "ref_capture_commit": "<inscription_id>i0",
  "party_slot_index": 2,
  "signed_in_wallet": "tb1p...",

  "species_id": 155,
  "species_name": "Cyndaquil",
  "level": 5,
  "moves": [33, 34, 35, 36],
  "pp": [35, 15, 20, 0],
  "held_item": 0,
  "friendship": 70,
  "pokerus": 0,
  "status": "Paralyzed",
  "catch_rate": 45,

  "ivs": { "atk": 10, "def": 11, "spe": 12, "spd": 13 },
  "ivs_salt_hex": "<64hex>",
  "derived_ivs": { "hp": 5 },
  "evs": { "hp": 100, "atk": 200, "def": 300, "spe": 400, "spc": 500 },
  "shiny": false,

  "ram_snapshot": "<base64 8KB>",
  "ram_snapshot_encoding": "base64",
  "ram_witness_scheme": "full_wram8k:v1",

  "name": "Cyndaquil Lv.5",
  "description": "Cyndaquil captured in Pokemon Crystal via PokeBells.",
  "image": "/content/<sprite_inscription_id>",
  "attributes": [
    { "trait_type": "Collection", "value": "PokeBells" },
    { "trait_type": "Pokemon", "value": "Cyndaquil" },
    { "trait_type": "Dex No", "value": 155 },
    { "trait_type": "Level", "value": 5 },
    { "trait_type": "Shiny", "value": "No" },
    { "trait_type": "IV Total", "value": 46 },
    { "trait_type": "IV HP", "value": 5 },
    { "trait_type": "IV Attack", "value": 10 },
    { "trait_type": "IV Defense", "value": 11 },
    { "trait_type": "IV Speed", "value": 12 },
    { "trait_type": "IV Special", "value": 13 }
  ]
}
```

**Field notes**:
- `ref_capture_commit` resolves to a `capture_commit` inscription id ending in
  `iN`. Same network only.
- `party_slot_index` MUST equal `commit.party_slot_index`. Indexer rejects
  on mismatch.
- `signed_in_wallet` MUST equal `commit.signed_in_wallet`. Mirror exists
  only for marketplace standalone readability — the commit remains the
  authoritative source.
- `ram_witness_scheme: "full_wram8k:v1"` declares the witness opens the full
  8 KB snapshot. Future `"merkle:v1"` would replace `ram_snapshot` with
  `ram_merkle_proof`.
- Top-level `name` / `image` / `attributes` follow ordinals NFT metadata
  conventions. No nested `nft_metadata` mirror — the top level IS the
  metadata.

## Attestation v2.1 — canonical encoding

```
attestation_scheme = "sha256:block_hash+ram_snapshot_hash+svbk+signed_wallet+session_sequence+ivs_commitment+party_slot_index:v2.1"

canonical_preimage = concat(
  utf8(lowercase(trim(block_hash_hex))),         // 64 ASCII hex digits
  utf8(lowercase(trim(ram_snapshot_hash_hex))),  // 64 ASCII hex digits
  u8(svbk_at_capture),                           // 1 byte (0x01 in v1.1+/v2.x)
  utf8(signed_in_wallet),                        // variable, address as-is
  utf8(decimal(session_sequence_number)),        // ASCII decimal, no padding
  utf8(lowercase(trim(ivs_commitment_hex))),     // 64 ASCII hex digits
  u8(party_slot_index)                           // 1 byte (1..6)
)

attestation = hex(sha256(canonical_preimage))
```

**Encoding rules** (mandatory for cross-implementation matching):
- All hex strings: lowercase, trimmed, exactly 64 characters, no `0x` prefix.
- All single-byte fields: `Uint8Array(1)` masked `& 0xff`.
- Wallet address: raw string preserving Bells mixed-case (P2PKH starts with
  capital letter, e.g. `EeRU4...`).
- Session sequence number: `String(Number)` decimal, no leading zero, no
  padding.
- Concatenation is byte-level after UTF-8 encoding the strings.

Reference implementation: `computeCaptureAttestationV2_1()` in
[capture-core.mjs](game/capture-core.mjs).

## Indexer validation matrix

A `mint` is canonical (eligible for the collection + indexed for queries) iff
all 22 checks pass AND. Numbered 1..12 to match the high-level taxonomy;
sub-letters expand the marketplace projection checks added during v1.5
spec hardening.

| # | Check | Source |
|---|-------|--------|
| 1 | `commit.attestation_scheme == "sha256:...:v2.1"` | commit |
| 2 | `commit.attestation == hex(sha256(v2.1 canonical preimage))` | commit |
| 2b | `commit.game_rom_sha256` present + 64-char hex | commit |
| 3 | `mint.ref_capture_commit` resolves to a registered commit row | DB |
| 4 | `mint.party_slot_index === commit.party_slot_index` | cross |
| 5 | `mint.signed_in_wallet === commit.signed_in_wallet` | cross |
| 6 | `sha256(canonical_ivs(mint.ivs) ++ hexToBytes(mint.ivs_salt_hex)) == commit.ivs_commitment` | cross |
| 7 | `sha256(base64Decode(mint.ram_snapshot)) == commit.ram_snapshot_hash` | cross |
| 8 | Parse RAM @ `commit.party_slot_index` → species_byte / level_byte / DVs | mint |
| 9 | `mint.species_id === dexOf(species_byte)` && `mint.level === level_byte` | cross |
| 10 | `isGen2Shiny(DVs) === mint.shiny` | cross |
| **10b** | **`mint.ivs === DVs from slot` (atk, def, spe, spd all match)** | **cross** |
| 10c | `mint.derived_ivs.hp === deriveGbcHpIv(DVs)` | cross |
| 10d | `mint.species_name === catalog(species_byte).name` | catalog |
| 10e | `mint.moves === slot.moves && mint.pp === slot.pp` | cross |
| 10f | `mint.held_item === slot.heldItem && mint.friendship === slot.friendship && mint.pokerus === slot.pokerus` | cross |
| 10g | `mint.status === statusNameFromByte(slot.statusByte)` | cross |
| 10h | `mint.evs` is an object with all 5 EV keys, each matching `slot.evs[key]` | cross |
| 10i | `mint.catch_rate === catalog(species_byte).catchRate` | catalog |
| **10j** | **`mint.derived_ivs` is an object && `derived_ivs.hp === deriveGbcHpIv(slot.dvs)`** | cross |
| **10k** | **`mint.name === "${speciesName} Lv.${level}"`** (no nicknames in v1.5) | catalog+slot |
| **10l** | **`mint.image === resolveSpriteImage(speciesId, shiny)`** when sprite-pack manifest is bound. Mainnet indexer MUST bind it. If resolver returns null (sprite missing), reject — never fall back to "any string". | catalog |
| **10m** | **`mint.attributes` is an array of exactly 14 entries, deep-equal to canonical projection** (see buildPokemonMintRecord). Order, trait_type, value all enforced. | catalog+slot |
| 11 | `getRevealTx(mint.inscription_id).vout[0].scriptpubkey_address === mint.signed_in_wallet` | electrs |
| 12 | No prior valid mint exists with the same `ref_capture_commit` | DB |

**Failure semantics**: any failed check → the mint is NOT inserted into
the `pokemon` table (collection remains canonical-only). A row is written
to `ingestion_log` with `result='invalid'` and `reject_reason` = the
check name + diagnostic. The `commits` table keeps `valid` / `reject_reason`
columns for legacy reasons (schema 1.4 reveals still land there), but
`pokemon` has no invalid rows — either the mint passes all 22 checks and
joins the collection, or it lives only in the audit log.

**Network defaults**: GET endpoints (`/api/trainer/<id>`, `/api/pokedex`,
`/api/leaderboard`, `/api/stats`) default `network` to `bells-testnet`
until mainnet goes live. Revisit before the mainnet switch — default
should flip once the collection is launched.

## Owner check (electrs detail)

The reveal transaction's `vout[0]` is where the inscription "lives" — the
address that controls the new ord output. Our builder sets this to the
caller's wallet address (see [pokebells-inscriber inscribe.mjs](tools/pokebells-inscriber/src/inscribe.mjs)
`revealPsbt.addOutput({ address: toAddress, ... })`).

Indexer fetches via:
```
GET https://bells-testnet-api.nintondo.io/tx/<revealTxid>
```
and reads `data.vout[0].scriptpubkey_address`.

**Open caution**: must verify Nintondo's manual Inscriber UI also places the
inscription in `vout[0]`. If they use a different layout, this check needs to
adapt (likely by checking the first non-OP_RETURN output, or any output ≤ dust
+ inscription threshold). Tracked as part of the v1.5 implementation tests.

## Anti-attack matrix

| Attack | Defense | Notes |
|--------|---------|-------|
| Commit with `ivs_commitment` pre-hashing FAKE perfect IVs + real RAM | **Check 10b** (`mint.ivs === DVs in RAM slot`) | Even if attacker forges commit body, mint must publish RAM-derived IVs. Fake IVs in mint fail check 10b; real IVs in mint fail check 6 (commitment preimage). Pincer. |
| Mint with different IVs than committed | Check 6 (`ivs_commitment` preimage) | sha256 collision = infeasible |
| Mint with synthesized RAM that produces fake IVs | Check 7 (`ram_snapshot_hash` preimage) | RAM bytes determine party slot which determines IVs |
| Mint references a real commit but picks a different party slot | Check 4 (`party_slot_index` match) + slot pinned in attestation v2.1 | slot can't be silently swapped |
| Mint lies about moves / held_item / friendship / status / EVs | Checks 10e, 10f, 10g, 10h (RAM projection) | Every marketplace-visible trait re-derived from RAM and compared; any divergence = reject |
| Mint lies about species_name or catch_rate | Checks 10d, 10i (catalog projection) | Catalog is deterministic from pinned ROM |
| Mint lies about derived_ivs.hp (Gen 1 HP-IV formula) | Check 10c / 10j | `deriveGbcHpIv(DVs)` is deterministic; v1.5 also requires the field to be present |
| Mint lies in `attributes[]` (e.g. "IV Attack: 15" while real DV = 10) | Check 10m (strict deep-equal of canonical 14-entry array) | Marketplace UI sees only the canonical projection |
| Mint lies in `name` (e.g. "Mewtwo Legendary" instead of canonical "Cyndaquil Lv.5") | Check 10k | Format pinned by spec — nicknames are a future v1.6+ op |
| Mint lies in `image` (e.g. swaps shiny sprite onto non-shiny capture) | Check 10l | Sprite-pack manifest binds (speciesId, shiny) → inscription id |
| Bob copies Alice's mint JSON, re-inscribes with own wallet | Check 11 (vout[0] === signed_in_wallet) + Check 12 (first-valid-per-commit) | Bob's reveal tx vout[0] = Bob's address, mismatches mint claim |
| Replay an old capture from a stale game state | Block hash + attestation freshness rule (K-block staleness, post-mainnet) | indexer rejects if `block_hash_at_capture` too old vs inscription block |
| Inscribe a capture with a tampered ROM that pre-determines IVs | `game_rom_sha256` must match the canonical ROM pinned in the root inscription (mandatory in commit per check 2b) | indexer cross-check against root inscription post-mainnet |
| Two wallets race to mint the same commit | Check 12 (DB unique on `ref_capture_commit`) | first valid wins; second rejected |

## Marketplace integration

**Primary path**: our indexer (`pokebells-indexer.ceyzcrypto.workers.dev`)
applies all 22 checks and serves `GET /api/pokemon/<inscription_id>` returning
the canonical record. Bellforge + any third-party UI reads from there.

**Fork-able path**: anyone can fork the indexer ([game/indexer/](game/indexer))
and re-derive the same canonical set from the chain. The 22 checks are
deterministic given inscription content + electrs.

**Future**: a `p:pokebells-collection` parent inscription can be published
listing canonical mint inscription ids. Marketplaces that support
parent-gated collections (Nintondo's planned feature) can filter on
parent reference, eliminating the indexer dependency for listing.
Updates would happen via append-only child inscriptions referencing the
parent.

## Migration from v1.4

There is no migration. v1.4 testnet inscriptions remain readable but are
not part of the v1.5 collection. The companion stops emitting v1.4 records
on the day v1.5 ships. Indexer keeps v1.4 validation paths (legacy code) so
historical lookups still work.

The single deployed v1.4 endpoint kept for legacy:
- `POST /api/reveals/offchain` — unchanged, no UI exposure, deprecated.

## Forward compat fields

To minimize future schema churn:

- `attestation_scheme` is a free-form string. Bumping to `:v2.2` is non-breaking
  (validators reject unknown schemes; readers can implement multiple).
- `ram_commitment_scheme` and `ram_witness_scheme` are paired — a commit's
  scheme determines which witness schemes are acceptable. v1.6 might add
  `ram_witness_scheme: "merkle:v1"` against the same `"sha256:wram8k:v1"`
  commit (since a Merkle root over chunks is itself a sha256 of the full RAM,
  reducible).
- `signed_in_wallet` is wallet-format-agnostic — Bells P2PKH today
  (`EeRU4...`), future P2TR addresses (`bel1p...`) work without schema change.
