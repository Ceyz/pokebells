# PokeBells Gen 2 Testnet Inscription Checklist

Generated: 2026-04-23T04:05:18.767Z
Assets total: 526
Tier 1 known bytes: 3271485 (≈ 3.12 MB)

## Workflow

1. Open `https://nintondo.io/inscriber` on Bells testnet with a funded tBEL wallet.
2. For each row in a tier, upload the file (renamed as shown in `inscribeAs`), confirm, record the `<64hex>i0` id next to the row.
3. Before inscribing a tier-2+ manifest, open the template JSON and replace every `REPLACE_ME_*` / `*_INSCRIPTION_ID` placeholder with the real ids collected in earlier tiers.
4. When all tiers are done, open `https://bellforge.app/pokebells/?manifest=<MAIN_MANIFEST_INSCRIPTION_ID>&network=bells-testnet` and confirm the bootloader loads end-to-end (console log: `[boot] shell evaluated`).

## Tier 1 — Leaves (order inside the tier does not matter)

### 1a. ROM chunks (9, 2097152 bytes)

| Index | Inscribe as | Bytes | sha256 | Source |
|---|---|---|---|---|
| 0 | `pokecrystal.part000.bin` | 245760 | `9f42581576d8048e…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part000.bin` |
| 1 | `pokecrystal.part001.bin` | 245760 | `f5cd24b14fdb4de9…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part001.bin` |
| 2 | `pokecrystal.part002.bin` | 245760 | `9693b1821eb49594…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part002.bin` |
| 3 | `pokecrystal.part003.bin` | 245760 | `06f9a59b6ce38028…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part003.bin` |
| 4 | `pokecrystal.part004.bin` | 245760 | `53052f71da35d899…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part004.bin` |
| 5 | `pokecrystal.part005.bin` | 245760 | `51effb5334a57166…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part005.bin` |
| 6 | `pokecrystal.part006.bin` | 245760 | `1a2d5c849c68bcd1…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part006.bin` |
| 7 | `pokecrystal.part007.bin` | 245760 | `01e167efda1d74c0…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part007.bin` |
| 8 | `pokecrystal.part008.bin` | 131072 | `157b54a11baee659…` | `game/chunks/pokecrystal-d6702e353dcb/pokecrystal.part008.bin` |

### 1b. Binjgb runtime (2, 120311 bytes)

| Role | Inscribe as | Bytes | sha256 | Source |
|---|---|---|---|---|
| runtime-js | `binjgb.txt` | 21626 | `4cadb3dbe040fc77…` | `poc/binjgb.js` |
| runtime-wasm | `binjgb.wasm` | 98685 | `a6267f82c41d1c24…` | `poc/binjgb.wasm` |

### 1c. Sprites (502 PNGs, 251928 bytes)

502 PNGs — one entry per dex × {normal, shiny}. Full list in `inscription-checklist.testnet.json`.

### 1d. ES modules (8, 802094 bytes)

**Inscribe each as `.txt`** (the Inscriber rejects `.js`/`.mjs`).

| Key | Inscribe as | Bytes | sha256 | Source |
|---|---|---|---|---|
| `capture_core` | `capture_core.txt` | 86712 | `0c6ac4f38ad2ec9b…` | `game/capture-core.mjs` |
| `gen2_species` | `gen2_species.txt` | 88346 | `e24c4574657c4249…` | `game/gen2-species.mjs` |
| `gen2_pc_storage` | `gen2_pc_storage.txt` | 6605 | `ad403c244a7157f0…` | `game/gen2-pc-storage.mjs` |
| `wallet_adapter` | `wallet_adapter.txt` | 22658 | `e99656ea84e506fb…` | `game/wallet-adapter.mjs` |
| `signin_verify` | `signin_verify.txt` | 32220 | `4b8943e2585bc7de…` | `game/signin-verify.mjs` |
| `pbrp_session_key` | `pbrp_session_key.txt` | 10017 | `d5c26054ee274bf2…` | `game/pbrp/session-key.mjs` |
| `pokebells_inscriber` | `pokebells_inscriber.txt` | 423749 | `2655a1eaa7990492…` | `companion/pokebells/inscriber/pokebells-inscriber.browser.mjs` |
| `shell` | `shell.txt` | 131787 | `e69617f71ab09d9c…` | `game/shell.js` |

## Tier 2 — Aggregate manifests (fill tier-1 ids first)

### rom-manifest

- Inscribe as: `pokecrystal-rom.json`
- Source template: `game/manifest.testnet-template.json`
- Placeholder: `ROM_MANIFEST_INSCRIPTION_ID`
- Note: After tier 1: open this JSON, replace every ROM_CHUNK_*/BINJGB_*_INSCRIPTION_ID with the real i0 strings, recompute bytes+sha256, then inscribe.

### sprite-pack-manifest

- Inscribe as: `sprite-pack.json`
- Source template: `tools/sprites-out-gen2/sprite-pack.manifest.template.json`
- Placeholder: `SPRITE_PACK_INSCRIPTION_ID`
- Note: After tier 1 sprites: fill in every sprite id, inscribe.

### collection-metadata

- Inscribe as: `pokebells-collection.json`
- Source template: `game/collection.template.json`
- Placeholder: `COLLECTION_INSCRIPTION_ID`
- Note: Write a fresh {"p":"pokebells-collection","v":1,"name":"PokeBells","slug":"pokebells",...} JSON and inscribe. See the main manifest for the exact schema consumers expect.

## Tier 3 — Main bootloader manifest

- Inscribe as: `pokebells-manifest.json`
- Source template: `game/manifest.template.json`
- Placeholder: `MAIN_MANIFEST_INSCRIPTION_ID`
- Note: After tier 2: fill every *_inscription_id (capture_core, gen2_*, wallet_adapter, signin_verify, pbrp_session_key, pokebells_inscriber, shell, rom_manifest, collection) with real i0 strings, inscribe.

## Tier 4 — Root HTML

- Inscribe as: `pokebells.html`
- Source template: `game/index.html`
- Placeholder: `ROOT_INSCRIPTION_ID`
- Note: Edit boot.js DEFAULT_TESTNET_MANIFEST_ID to the main manifest id from tier 3, bundle with index.html (inline or concat), inscribe as a single .html file. Keep the same file for mainnet (with DEFAULT_MAINNET_MANIFEST_ID).

