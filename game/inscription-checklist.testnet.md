# PokeBells Gen 2 Testnet Inscription Checklist

Generated: 2026-04-24T15:39:41.997Z
Assets total: 529
Tier 1 known bytes: 3353399 (≈ 3.20 MB)

## Workflow

1. Open `https://nintondo.io/inscriber` on Bells testnet with a funded tBEL wallet.
2. For each row in a tier, upload the file (renamed as shown in `inscribeAs`), confirm, record the `<64hex>i0` id next to the row.
3. Before inscribing a tier-2+ manifest, open the template JSON and replace every `REPLACE_ME_*` / `*_INSCRIPTION_ID` placeholder with the real ids collected in earlier tiers.
4. When all tiers are done, open `https://bellforge.app/pokebells/?manifest=<MAIN_MANIFEST_INSCRIPTION_ID>&network=bells-testnet` and confirm the bootloader loads end-to-end (console log: `[boot] shell evaluated`).

## Tier 1 — Leaves (order inside the tier does not matter)

### 1a. ROM chunks (9, 2097152 bytes)

| Index | Inscribe as | Bytes | sha256 | Source |
|---|---|---|---|---|
| 0 | `pokecrystal.part000.bin` | 245760 | `f61c84f617074d98…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part000.bin` |
| 1 | `pokecrystal.part001.bin` | 245760 | `9bcf333bf468f64a…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part001.bin` |
| 2 | `pokecrystal.part002.bin` | 245760 | `121282dc7f3b6b97…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part002.bin` |
| 3 | `pokecrystal.part003.bin` | 245760 | `ab30342f30433dce…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part003.bin` |
| 4 | `pokecrystal.part004.bin` | 245760 | `53052f71da35d899…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part004.bin` |
| 5 | `pokecrystal.part005.bin` | 245760 | `51effb5334a57166…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part005.bin` |
| 6 | `pokecrystal.part006.bin` | 245760 | `1a2d5c849c68bcd1…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part006.bin` |
| 7 | `pokecrystal.part007.bin` | 245760 | `01e167efda1d74c0…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part007.bin` |
| 8 | `pokecrystal.part008.bin` | 131072 | `14915b72562ded7e…` | `game/chunks/pokecrystal-pokebells-6fad18f517f8/pokecrystal-pokebells.part008.bin` |

### 1b. Binjgb runtime (2, 120311 bytes)

| Role | Inscribe as | Bytes | sha256 | Source |
|---|---|---|---|---|
| runtime-js | `binjgb.txt` | 21626 | `4cadb3dbe040fc77…` | `poc/binjgb.js` |
| runtime-wasm | `binjgb.wasm` | 98685 | `a6267f82c41d1c24…` | `poc/binjgb.wasm` |

### 1c. Sprites (502 PNGs, 251928 bytes)

502 PNGs — one entry per dex × {normal, shiny}. Full list in `inscription-checklist.testnet.json`.

### 1d. ES modules (8, 460259 bytes)

**Inscribe each as `.txt`** (the Inscriber rejects `.js`/`.mjs`).

| Key | Inscribe as | Bytes | sha256 | Source |
|---|---|---|---|---|
| `capture_core` | `capture_core.txt` | 95862 | `8967fe9b89b4afc1…` | `game/capture-core.mjs` |
| `gen2_species` | `gen2_species.txt` | 88346 | `e24c4574657c4249…` | `game/gen2-species.mjs` |
| `gen2_pc_storage` | `gen2_pc_storage.txt` | 6605 | `ad403c244a7157f0…` | `game/gen2-pc-storage.mjs` |
| `pending_captures` | `pending_captures.txt` | 10527 | `4c4612c8c21d25a0…` | `game/pending-captures.mjs` |
| `wallet_adapter` | `wallet_adapter.txt` | 23440 | `c8f16cc540012cbc…` | `game/wallet-adapter.mjs` |
| `signin_verify` | `signin_verify.txt` | 32220 | `4b8943e2585bc7de…` | `game/signin-verify.mjs` |
| `pbrp_session_key` | `pbrp_session_key.txt` | 11052 | `3799a0d1a8f41cf7…` | `game/pbrp/session-key.mjs` |
| `shell` | `shell.txt` | 192207 | `2f6a646672fc5cf2…` | `game/shell.js` |

## Tier 2 — Aggregate manifests (fill tier-1 ids first)

### sprite-pack-manifest

- Inscribe as: `sprite-pack.json`
- Source template: `tools/sprites-out-gen2/sprite-pack.manifest.template.json`
- Placeholder: `SPRITE_PACK_INSCRIPTION_ID`
- Note: After tier 1 sprites: fill in every sprite id, inscribe.

### rom-manifest

- Inscribe as: `pokecrystal-rom.json`
- Source template: `game/manifest.pokebells-testnet-template.json`
- Placeholder: `ROM_MANIFEST_INSCRIPTION_ID`
- Note: After tier 1 + sprite-pack: fill every ROM_CHUNK_* + BINJGB_* + SPRITE_PACK_INSCRIPTION_ID, inscribe.

### collection-metadata

- Inscribe as: `pokebells-collection.json`
- Source template: `game/collection.template.json`
- Placeholder: `null`
- Note: Tier 3b: inscribe AFTER main-manifest. tools/bulk-inscribe.mjs fillCollectionMetadata substitutes REPLACE_WITH_MANIFEST_V1_INSCRIPTION_ID_BEFORE_MINT in game/collection.template.json with the main-manifest inscription id from progress before inscribing.

## Tier 3 — Main bootloader manifest

- Inscribe as: `pokebells-manifest.json`
- Source template: `game/manifest.template.json`
- Placeholder: `MAIN_MANIFEST_INSCRIPTION_ID`
- Note: After tier 2: fill every *_inscription_id (capture_core, gen2_*, wallet_adapter, signin_verify, pbrp_session_key, pokebells_inscriber, shell, rom_manifest) with real i0 strings, inscribe. The collection id is NOT in the manifest (Phase C: the pointer goes collection→manifest, not manifest→collection).

## Tier 4 — Root HTML

- Inscribe as: `pokebells.html`
- Source template: `game/index.html`
- Placeholder: `ROOT_INSCRIPTION_ID`
- Note: tools/bulk-inscribe.mjs fillRootHtml bakes DEFAULT_*_MANIFEST_ID (from main-manifest progress) AND DEFAULT_*_COLLECTION_ID (from collection-metadata progress) into game/boot.js before inlining into index.html. Longest-prefix-first substitution so the manifest placeholder does not clobber the collection one.

