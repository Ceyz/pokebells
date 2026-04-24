# Testnet live P0 session — 4 items in one sitting

Covers the P0 mainnet-blockers that only a real browser + wallet can
validate: **content-host direct path**, **origin safety**, **storage
scoping**, and **`/content/<id>` vs `/html/<id>`**. One ~30 min
session, no new testnet sats needed (read-only tests on existing
inscriptions).

## Setup (5 min)

You need:

1. **Nintondo wallet extension installed** in your browser. The
   testnet wallet we've been using (`EKpFkdEunUFfoPMFp2X5YzML7S6w5uczgP`)
   is fine — we never SIGN anything in this session, just inspect
   injection behaviour.

2. **Two test inscription URLs** on `bells-testnet-content.nintondo.io/content/`:
   - **Primary — the actual PokeBells testnet root** (full game, loads
     shell.js + ROM emulator):
     `https://bells-testnet-content.nintondo.io/content/e1c15e0bd5b4be8a76cb03c35ebdb96388ea2528242f2cb57db6ce0e454f4ea2i0`
     (HTML title: "PokeBells Phase 1"; baked manifest id
     `e0217a8272823869e33d591fdb248b259d73c2fbd9ddfa605487802d01179a33i0`).
     Fallback if the above ever 404s: the 2026-04-22 mini-test root
     `0ea64bbd7b8589bb68b49cfc7dd9252ba20a684490131145b48d3c8a7d6c221di0`
     (simpler bootloader, no game — still proves wallet injection +
     content-host mechanics).
   - **Secondary** (any OTHER testnet inscription on the same host,
     to compare): use the probe collection from the Phase B+C live
     round-trip session:
     `https://bells-testnet-content.nintondo.io/content/1ecc86cd6983d4c8eab44d9f0b208bcba10852a37d17b6839d2d497819f5118di0`

3. **Browser dev tools** (F12). Console + Application tab will cover
   everything.

Copy each command below, paste into the browser console, paste the
output back into the chat with me. I'll interpret.

---

## Step 1 — Content-host direct: wallet injection works (P0 #1)

**Goal**: confirm the Nintondo extension injects `window.nintondo`
when you open an inscription directly from the content host. This
is the foundational assumption for the whole "play URL = content
host" architecture.

### Actions

1. Open a NEW tab.
2. Navigate to the **Primary URL** above.
3. Wait for the page to finish loading.
4. Open dev tools (F12), go to the Console tab.
5. Run these one by one:

```js
// A. Is the extension injected at all?
console.log('nintondo?', typeof window.nintondo);

// B. What methods does it expose?
console.log('methods:', window.nintondo ? Object.keys(window.nintondo) : 'n/a');

// C. Can we connect? (will trigger a wallet popup asking for permission)
await window.nintondo.connect('bellsTestnet').then(r => console.log('connect:', r));

// D. What address did the wallet return?
await window.nintondo.getAccount().then(a => console.log('account:', a));

// E. What network is active?
await window.nintondo.getNetwork().then(n => console.log('network:', n));
```

### Expected

- A prints `nintondo? object`.
- B prints an array of method names (`connect`, `getAccount`,
  `signPsbt`, etc.).
- C triggers a Nintondo popup. You click Approve. Returns your
  address.
- D returns `EKpFkdEunUFfoPMFp2X5YzML7S6w5uczgP` (or whichever
  account is active).
- E returns something like `bellsTestnet` or `testnet`.

### What I need back

Paste the full console output (A through E). If any step errors,
paste the error message verbatim.

---

## Step 2 — Origin safety: can a second inscription see the first tab's wallet state? (P0 #3)

**Goal**: confirm that another inscription on the same
`bells-testnet-content.nintondo.io` host does NOT automatically
inherit the wallet connection the user granted to the primary tab.
If it does, the mainnet threat model is broken — any inscription
could silently trigger `signPsbt` on your live session.

### Actions

1. KEEP the Primary tab open + connected (Step 1 left you logged
   in).
2. Open a SECOND new tab.
3. Navigate to the **Secondary URL** above (the probe collection JSON).
   The browser will display it as JSON. That's fine — we only need
   the origin to load so we can inspect it.
4. In that tab's dev tools Console:

```js
// Is window.nintondo also injected here?
console.log('nintondo?', typeof window.nintondo);

// If yes: does it auto-report the connected account without a popup?
if (window.nintondo) {
  try {
    const acct = await window.nintondo.getAccount();
    console.log('auto-account:', acct);
  } catch (e) {
    console.log('getAccount threw:', e.message);
  }
  // And the network state?
  try {
    const net = await window.nintondo.getNetwork();
    console.log('auto-network:', net);
  } catch (e) {
    console.log('getNetwork threw:', e.message);
  }
}

// The really scary one: can it request signPsbt without user approval?
// (We won't call it for real — just check if the method exists.)
console.log('has signPsbt?', typeof window.nintondo?.signPsbt === 'function');
```

5. **DO NOT call `signPsbt` for real.** The test is about checking
   the auth/permission surface, not executing.

### Expected (safe outcome)

- `window.nintondo` may be injected (extensions usually do inject
  per-frame).
- `getAccount` either throws (not-connected) OR triggers a fresh
  popup asking for this origin's permission.
- If it returns the account WITHOUT a popup, the extension is
  sharing state across inscriptions on the same host — that's the
  unsafe outcome.
- `has signPsbt? true` is OK — what matters is whether signPsbt
  would trigger a popup or not.

### What I need back

Full console output. Specifically: did `getAccount` return silently,
throw, or open a popup?

---

## Step 3 — Storage scoping: do different inscriptions share IndexedDB / localStorage? (P0 #4)

**Goal**: confirm that one inscription's stored data isn't visible
to another inscription on the same host. If they are, a rogue
inscription could tamper with PokeBells' pendingCaptures IDB store
or SRAM save buffer.

### Actions

1. In the **Primary** tab (Step 1), Console:

```js
// Write a marker to localStorage
localStorage.setItem('pokebells:live-p0-probe', 'written-by-primary-tab');
console.log('primary localStorage:', localStorage.getItem('pokebells:live-p0-probe'));

// List all IndexedDB databases this origin has access to
const dbs = await indexedDB.databases();
console.log('primary IDBs:', dbs.map(d => `${d.name}@v${d.version}`));
```

2. In the **Secondary** tab (Step 2), Console (same origin, DIFFERENT
   inscription id):

```js
// Can this tab see the marker the primary tab wrote?
const seen = localStorage.getItem('pokebells:live-p0-probe');
console.log('secondary localStorage sees primary marker?', seen);

// Same question for IDB
const dbs = await indexedDB.databases();
console.log('secondary IDBs:', dbs.map(d => `${d.name}@v${d.version}`));
```

3. Cleanup (in primary tab):

```js
localStorage.removeItem('pokebells:live-p0-probe');
```

### Expected

Browsers scope localStorage + IDB BY ORIGIN (host + port + scheme).
Since both inscriptions are on
`bells-testnet-content.nintondo.io`, they SHARE storage. The
secondary tab WILL see the marker.

**This is the known-unsafe finding we've been tracking**. The fix on
our side: (a) the multi-tab writer lease already blocks the
obvious corruption vector for PokeBells itself, (b) mainnet
should not store anything sensitive on localStorage that a
different inscription could exploit (demoted to "validated cache"
per ROOT-APP-DESIGN.md).

### What I need back

Both tabs' full console output, specifically: what did the
secondary tab see in localStorage / IDBs?

---

## Step 4 — `/content/<id>` vs `/html/<id>` (P0 #2)

**Goal**: pick the canonical Play URL form. `/content/` serves the
raw inscription bytes with the correct Content-Type; `/html/`
wraps the inscription in Nintondo's HTML viewer chrome. We need to
know which works reliably for our game + wallet + storage.

### Actions

1. Open `https://bells-testnet-content.nintondo.io/content/0ea64bbd7b8589bb68b49cfc7dd9252ba20a684490131145b48d3c8a7d6c221di0`
   (or the actual PokeBells root if you have it).
2. Same URL but swap `/content/` for `/html/`:
   `https://bells-testnet-content.nintondo.io/html/0ea64bbd7b8589bb68b49cfc7dd9252ba20a684490131145b48d3c8a7d6c221di0`
3. Compare:
   - Does the page load?
   - Is `window.nintondo` injected? (`typeof window.nintondo` in each)
   - Does `await window.nintondo.connect('bellsTestnet')` work?
   - Is there a wrapper / navbar / Nintondo UI around the page?
   - Try `localStorage.setItem('test', '1')` + reload — does it persist?

### What I need back

For each of the two URLs, a short summary:
- Loads? yes/no
- `window.nintondo` injected? yes/no
- Connect works? yes/no
- Has Nintondo chrome around it? yes/no
- localStorage persists? yes/no

---

## Reporting format

Paste back a single block like this when done (no need to format it
perfectly — I'll extract what I need):

```
[Step 1]
A. <output>
B. <output>
C. <output>
D. <output>
E. <output>

[Step 2]
<full console output>

[Step 3 — primary]
<full console output>

[Step 3 — secondary]
<full console output>

[Step 4 — /content]
- Loads: ...
- nintondo: ...
- Connect: ...
- Chrome: ...
- localStorage: ...

[Step 4 — /html]
- Loads: ...
- nintondo: ...
- Connect: ...
- Chrome: ...
- localStorage: ...
```

I'll interpret + write the findings into MAINNET-PLAN.md with the
appropriate P0 status updates. If anything looks surprising (like
step 2 silently leaking the wallet connection), I'll flag it as a
mainnet blocker before proceeding.

## What this session does NOT test

Deliberately out of scope to keep the session focused:
- Partial-recovery mint flow (needs fresh wallet funds + a real
  catch — separate session).
- Queue / re-notify across reload (needs real indexer round-trip —
  we already live-validated this in
  `tools/phase-b-live-probe.log`).
- Fork resilience from OPEN_SOURCE.md (needs a fresh Cloudflare
  account — separate session).

Those stay on the P0 list for a follow-up.
