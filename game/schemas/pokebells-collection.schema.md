# `p:pokebells-collection` — Collection manifest schema v1 (Crystal / v1.5 era)

The canonical root-of-trust inscription for the official PokeBells collection.
**Minted once, ever, per network.** Updated append-only via `op:"collection_update"`
(see below). Indexers identify "the" collection by its inscription id;
wallets and marketplaces display only captures that match the collection's
declared rules. Anyone can mint their own `p:pokebells-collection` and run a
parallel collection — the network is open, the canonical one is the one the
community + tooling agree to treat as canonical.

Source of truth for the on-chain mechanics: [game/ROOT-APP-DESIGN.md](../ROOT-APP-DESIGN.md).

## Shape

```json
{
  "p": "pokebells-collection",
  "v": 1,
  "name": "PokeBells",
  "slug": "pokebells",
  "description": "Pokemon Crystal on-chain captures — Bells ordinals. ...",
  "website": "https://bellforge.app/pokebells/",
  "license": "MIT",
  "networks": ["bells-mainnet", "bells-testnet"],

  "schema": {
    "capture_commit": "p:pokebells + op:capture_commit — opaque receipt, paired with op:mint before the NFT is canonical",
    "mint":           "p:pokebells + op:mint — canonical NFT with nft_metadata image referencing a sprite inscription, IVs/EVs/shiny revealed",
    "evolve":         "p:pokebells + op:evolve — appended to the original mint inscription_id, species + stats update"
  },

  "indexer_urls":   ["https://pokebells-indexer.ceyzcrypto.workers.dev"],
  "companion_urls": ["https://bellforge.app/pokebells/"],
  "bridge_urls":    ["https://bellforge.app/pokebells/play-bridge.html"],

  "root_app_urls":     [],
  "app_manifest_ids":  ["<manifest-v1-inscription-id>"],

  "update_authority": {
    "scheme":  "sat-spend-v1",
    "comment": "Valid collection_update must spend the UTXO holding this collection's inscription sat. See ROOT-APP-DESIGN.md."
  }
}
```

## Field rules

- `p`, `v`, `name`, `slug`, `license`, `website`, `networks` — protocol +
  human identity. `slug` is what wallets / indexers use as a short key
  (avoids name-collision games).
- `description` — Crystal / v1.5 summary. Must match the current protocol era
  (Gen 2 species 1..251, commit-reveal + mint schema, attestation v2.1).
- `schema` — informational map of the `p:pokebells` op types the indexer
  accepts for this collection. Not parsed programmatically; documents the
  protocol surface for humans reading the inscription body.
- `indexer_urls` — ordered list of indexer endpoints (latest at index 0).
  Clients consult them in order. Anyone can run a fork; the community picks
  which indexer they trust.
- `companion_urls` — ordered list of companion / hub URLs. Optional mirrors
  for the Play CTA.
- `bridge_urls` — ordered list of play-bridge URLs (iframe-sandbox / mirror
  fallback). Rarely needed on Nintondo content host (wallet injects
  directly), kept for marketplace thumbnails + third-party mirrors.

### New in Crystal / v1.5 era

- `root_app_urls` — ordered list of content-host URLs pointing at the
  current (and historical) root HTML inscriptions. Latest at index 0.
  May be **empty** at initial mint (the root HTML is inscribed AFTER
  the collection per the mint choreography; the first
  `op:"collection_update"` prepends the URL once the root exists).
- `app_manifest_ids` — ordered list of `p:pokebells-manifest` inscription
  ids. Latest at index 0. The boot chain reads this to discover the
  current module set; falls open to `DEFAULT_*_MANIFEST_ID` baked in
  root HTML when the indexer / content host is unreachable.
- `update_authority` — declares the authority scheme for
  `op:"collection_update"` inscriptions that prepend new entries to the
  `*_prepend` lists above. Frozen at collection mint time. v1 value:
  `"scheme": "sat-spend-v1"`.

### Historical field changes (from pre-Crystal drafts)

- **Removed** `rom_sha1`. The v1.5 protocol identifies the ROM by
  `game_rom_sha256` carried in every `capture_commit` / `mint` body;
  the collection does not need to re-declare it.
- **Removed** `capture_schema_version`, `attestation_scheme`,
  `save_schema_version`, `supported_manifest_versions`,
  `accepted_networks`, `policy` scalar fields. The v1.5 protocol pins
  these via shared constants in `capture-core.mjs` (synced into
  `game/indexer/src/capture-core.mjs` at deploy time), not via
  per-collection overrides. Reintroducing them would require a new
  collection root mint; out of scope for v1.
- **Removed** `operator_signature`. The Bells wallet `signMessage`
  scheme is still unresolved; we do not gate collection authority on
  it. Authority for **updates** comes from `update_authority.scheme =
  "sat-spend-v1"` (spending the collection inscription sat; see below).
  The collection root itself has no signature field — its
  authoritativeness is established by social consensus on the
  canonical inscription id.
- **Removed** `default_manifest_inscription_id`,
  `indexer_api_hint`, `sprite_pack_inscription_id`,
  `root_inscription_id`. Superseded by the append-only lists
  (`app_manifest_ids[]`, `indexer_urls[]`, `root_app_urls[]`). The
  sprite pack is referenced from the manifest, not from the
  collection.

## `op:"collection_update"` — append-only pointer bumps

Full spec in [ROOT-APP-DESIGN.md](../ROOT-APP-DESIGN.md). Short version:

- An operator who controls the UTXO holding the collection root
  inscription can issue an update by inscribing an
  `op:"collection_update"` body whose **commit transaction spends that
  UTXO**. The indexer verifies the commit-tx-input check as the sole
  proof of authority (no `signMessage` dependency).
- Allowed `set` keys (v1):
  `app_manifest_ids_prepend`, `root_app_urls_prepend`,
  `indexer_urls_prepend`, `companion_urls_prepend`,
  `bridge_urls_prepend`. All are **lists**, and update semantics are
  **prepend-only** (never remove, never reorder old entries).
- Scalar fields baked into the collection root (slug, name,
  description, update_authority.scheme, etc.) cannot be changed by an
  update. Scalar migration = new collection root.
- `update_sequence` is strictly monotonic per collection; replays and
  out-of-order sequences are rejected.
- **v1 same-block constraint**: a block containing BOTH a transfer of
  the collection root sat AND a `collection_update` for that same
  collection is rejected entirely (regardless of tx ordering within
  the block). Removable in v2 once the indexer has canonical tx-order
  satpoint tracking under reorg pressure.

## Indexer rules (v1)

1. Identify the collection by the inscription id of the
   `p:pokebells-collection` root inscription the community agrees is
   canonical. There is no on-chain vote — social consensus + tooling
   defaults.
2. On ingestion: validate the collection body matches the shape above
   (`p`, `v`, required fields, array shapes for the `_urls` / `_ids`
   lists). Reject bodies missing `update_authority` or with
   `update_authority.scheme` other than `sat-spend-v1`.
3. For every `p:pokebells` inscription on Bells, apply the standard
   v1.5 validator chain from `capture-core.mjs` (commit-reveal,
   attestation v2.1 recompute, mint canonical-image check, species
   1..251, etc.). Captures / mints referencing the collection's
   latest `app_manifest_ids[0]` are treated as canonical.
4. For `op:"collection_update"` inscriptions: verify authority via
   the `sat-spend-v1` check (commit tx spends the collection sat),
   verify `update_sequence` strict monotonicity, verify `set` keys are
   in the v1 allowlist + list-valued, and aggregate accepted updates
   into `/api/collection/latest`. Invalid updates go to
   `rejected_updates` for audit and do NOT affect the aggregated view.
5. Captures passing all checks go in the collection's canonical set.
   Captures failing are hidden from the canonical UI (still owned by
   the user on-chain).

## Upgrade path

- **Additive policy** (new URL in a list, new manifest id): issue an
  `op:"collection_update"` inscription. No new collection root needed.
- **Scalar change** (new slug, new `update_authority.scheme`, new
  `schema` map): mint a new `p:pokebells-collection` root. Tooling
  migrates by updating its canonical-collection-id list; both old and
  new are still valid inscriptions — social consensus picks one.
- **Authority rotation** (operator's wallet change / move to
  multisig): issue a `collection_update` whose commit tx is signed
  from the CURRENT holder and whose reveal tx output 0 sends the
  resulting sat to the new address / multisig. The next update is
  signed from there. **v1 does NOT support off-protocol transfers
  of the collection root** — moving the sat via a plain tx
  desyncs the indexer's derived satpoint (see
  `ROOT-APP-DESIGN.md` "Signer rotation model — v1 constraint").

## Status

**Phase A (schema extension) implemented 2026-04-24.** Collection
template (`game/collection.template.json`) carries the new fields.
Indexer validator (`game/indexer/src/validator.js`) accepts the new
shape. Ready for Phase B (indexer sat-spend validator for
`op:"collection_update"`) once Phase 0 probe passes on testnet. See
[ROOT-APP-DESIGN.md](../ROOT-APP-DESIGN.md) for phases and acceptance.
