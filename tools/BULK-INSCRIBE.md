# Bulk inscriber — headless automation for the 527-asset dry run

## What this is

Two Node.js CLIs that let you inscribe the entire PokeBells asset set
(ROM chunks + sprites + modules + manifests) without pasting anything
into the Nintondo Inscriber UI.

- `tools/gen-bells-wallet.mjs` — generates a fresh Bells wallet (WIF +
  P2PKH address)
- `tools/bulk-inscribe.mjs` — reads `game/inscription-checklist.*.json`,
  signs every commit+reveal PSBT locally, broadcasts via Nintondo
  electrs, writes progress to `tools/bulk-inscribe-state.<network>.json`

Fully offline signing. The private key never leaves your machine.

## Security model

**Never paste a seed into this chat**, into argv, or into an env var in
a committed dotfile. The scripts only accept a key file you create
locally with 0600 perms. Use a **throwaway wallet** funded with
**exactly enough BEL** so if anything leaks, the damage is bounded.

## Workflow

### 1. Generate a throwaway wallet

```bash
node tools/gen-bells-wallet.mjs \
  --network bells-testnet \
  --out /tmp/inscribe.key
```

Prints the address. File permissions are `0600`. Fund this address with
just enough BEL (see "cost estimate" below).

### 2. Pre-flight: dry run

```bash
node tools/bulk-inscribe.mjs \
  --checklist game/inscription-checklist.testnet.json \
  --network bells-testnet \
  --dest-address <addr-you-want-to-OWN-the-inscriptions> \
  --key-file /tmp/inscribe.key \
  --fee-rate 3 \
  --limit 3
```

`--dry-run` is the default — no broadcasts. This builds + signs the
first 3 inscriptions and prints the planned txids. Verify:

- src address balance > planned fee
- inscription IDs look sensible (64 hex + `i0`)
- no throw

### 3. Live run

Remove `--limit` and add `--live`. On mainnet you also need `--yes`.

```bash
node tools/bulk-inscribe.mjs \
  --checklist game/inscription-checklist.testnet.json \
  --network bells-testnet \
  --dest-address <your-display-addr> \
  --key-file /tmp/inscribe.key \
  --fee-rate 3 \
  --live
```

Runs sequentially. Each inscription chains off the previous inscription's
change output (no waiting for confirmations). Expect 5-15 minutes for
527 assets on a decent network. Progress is persisted after every
successful broadcast so a crash mid-run is safe to resume.

### 4. Post-run

```bash
# Wipe the key file
shred -u /tmp/inscribe.key  # Linux/macOS
# or on Windows:
del /F /Q C:\Users\<you>\AppData\Local\Temp\inscribe.key
```

Leftover BEL in the throwaway wallet (change output from the last
inscription) can be swept manually via any Bells wallet.

The final `tools/bulk-inscribe-state.<network>.json` has the full
inscription-id mapping. Feed it into `tools/build-inscription-plan.mjs`
(or copy-paste into each manifest template) to wire up tier-2+ manifests.

## Cost estimate

Per inscription on testnet @ 3 sat/vB:

- Commit tx: ~180 vbytes × 3 = ~540 sats
- Reveal tx: ~5-40 kvB × 3 = a few hundred sats per KB of payload + 64
  base witness bytes
- Dust output: 1000 sats per reveal

For the full 527-asset set (~3.3 MB content):

- Raw content = 3,318,517 bytes
- Rough reveal fees ≈ 3,318,517 × 3 / 4 ≈ 2.5 M sats (0.025 BEL)
- Plus ~540 × 527 ≈ 285 K sats commit fees
- Plus 1000 × 527 dust ≈ 527 K sats
- **Total ≈ 3.3 M sats = ~0.033 BEL** for testnet at 3 sat/vB

Budget **1 BEL** on testnet for safety. On mainnet, check current fee
rates and scale `--fee-rate` accordingly.

## Unit tests

```bash
node tools/bulk-inscribe.test.mjs
```

Runs 9 offline tests covering signer derivation, P2PKH address, commit
+ reveal tx structure, multi-chunk payload, under-funded fail, UTXO
chaining, and real-sprite build. No network required.

## Architecture notes

- Keys: raw ECDSA via `bells-secp256k1`; WIF decode via `bs58check`.
  Taproot reveal signed via `signSchnorr`.
- PSBTs: `belcoinjs-lib` (fork of bitcoinjs-lib with Bells networks).
- Signer implements `{ publicKey, sign, signSchnorr }` so
  `Psbt.signAllInputs` works without the Nintondo wallet extension.
- UTXO selection: greedy smallest-first to avoid fragmenting large
  UTXOs. Change from each commit flows into the pool for the next
  asset so the whole batch runs off a single funding.
- Broadcast: electrs REST at `bells-{net}-api.nintondo.io/tx`. Chains
  unconfirmed txs — miners accept the full chain because each parent
  is valid standalone.

## When NOT to use this

- If you don't trust your local environment (e.g. shared machine with
  untrusted admin). Use the browser tool + wallet extension instead.
- If you need to inscribe with a parent ordinal (collection provenance).
  This tool is flat-only. Parent-child is post-PoC.
