# MSX Village Web App

React and TypeScript with a Cloudflare Worker, D1, and a pinned Git checkout of WebMSX. Live website: [msx-village.jannone.workers.dev](https://msx-village.jannone.workers.dev/).

## Development

Use Node.js 24 or newer and Git. From `webapp`:

```sh
npm ci
npm run prepare:emulator
npx wrangler d1 migrations apply DB --local
npm run dev
```

`prepare:emulator` clones WebMSX from Git at the commit in `../dependencies.json`, then copies its embedded C-BIOS distribution into ignored output. It never substitutes a CDN or npm emulator. The wrapper is maintained in `public/emulator/index.html`; upstream files remain unmodified.

Create an invitation for local registration:

```sh
node scripts/invite.mjs --output /tmp/village-invitation.txt
```

For production, add `--remote`. Invitations expire after seven days and can create one account. Keep invitation files private and outside Git. The database stores their SHA-256 hashes. Community operators should issue one invitation per person; software enforces one plot per account, without claiming to prove unique humans.

## Validation

```sh
npm run cf-typegen
npm run build
node tests/api.mjs
node tests/settlement.mjs
node tests/save-acknowledgement.mjs
npx wrangler deploy --dry-run
```

API tests require a running local dev server. They seed synthetic local invitations and verify passwords, cookie sessions, CSRF protection, invitation reuse, competing claims, ownership, stale saves, ROM size and guest permissions. They refuse a non-local URL. `VILLAGE_TEST_URL` overrides the local address. Test accounts remain in the local D1 database.

The Worker uses Node-compatible scrypt with N=32768, r=8, p=3. Production authentication needs enough Worker CPU budget for password derivation; test on the actual account plan. Password hashes and hashed sessions never enter snapshots. Sessions use HttpOnly, Secure, SameSite=Strict cookies; writes require the same origin. Registration and sign-in have database-backed rate limits.

## API and storage

- `POST /api/auth/register`: username, password, invitation; creates an account and session.
- `POST /api/auth/login`, `POST /api/auth/logout`: account sessions.
- `GET /api/me`: current user and owned plot.
- `GET /api/world?x=0&y=0`: public saved exhibits in a 9 × 9 region.
- `POST /api/plots/claim`: coordinates; one account, one plot. Exterior and interior initialize in the same insert.
- `PUT /api/settlement`: expected revision and validated settlement. Ownership is derived from the session. Atomic revision checks reject stale writes with 409. Database triggers retain each revision.
- `GET /api/snapshot.rom?x=0&y=0`: fixed 1 MiB ASCII8 snapshot. Defaults to the signed-in owner's neighborhood. Guest or distant-region ROMs have no editable owner plot.

Migrations define accounts, invitations, sessions, plots, immutable settlement history, request limits, and separate custom asset/revision/reference tables. Custom artwork authoring is deferred; these tables reserve stable ownership and revision relationships. Current maps use only the standard catalog. Migration 0003 adds artwork dimensions, object footprint/solidity, and frame layout to immutable artwork revisions for future authoring.

Settlement and ROM formats are version 2. Catalog entries determine object size and solidity; saves cannot supply replacements for that metadata. Validation covers all occupied cells, prohibits overlapping object footprints or entrance overlap, and requires the 2×2 door to fit. Saves retain the 1744-byte layout and kind/x/y triples; new catalog IDs 8–11 supply 2×2 objects while IDs 0–7 retain their one-tile dimensions.

Stored v1 settlements and immutable history are preserved. Reading current plots or assembling a ROM converts v1 content to v2: maps, objects, and avatar choice remain intact; an entrance grows to 2×2 at its existing anchor where possible, otherwise moves to the nearest fitting location free of decorative objects. The next successful owner save persists v2 as a new revision. V1 submissions are rejected so an old running ROM cannot overwrite revised semantics; players should save before the update and load a fresh snapshot after it.

## Browser save bridge

The parent page polls the game’s versioned RAM bridge through the same-origin iframe’s WebMSX bus. It freezes edits while copying the owner's 1744-byte buffer, submits the expected revision, and acknowledges success only after persistence. Authentication stays in the website. A failed account-details refresh cannot turn an already confirmed save into a failure. API requests time out after 15 seconds, keeping RAM edits available for retry. Failed requests retain RAM edits; expired sessions can sign back in without reloading the game. Conflict controls explicitly choose either the latest saved version or replacing it with the current session. Leaving or reloading unsaved work requires confirmation.

## Deployment

Cloudflare Workers Builds deploys pushes to `main` in `jannone/msx-village`, with root `webapp`, build `npm run build`, and deploy `npx wrangler deploy`. Preview builds are disabled. The build fetches the pinned WebMSX Git commit; the compiled MSX core is checked in so Cloudflare does not need SDCC.

Before deploying schema changes:

```sh
npx wrangler d1 migrations apply DB --remote
```

Regenerate `worker-configuration.d.ts` after binding or compatibility changes. The Vite plugin generates the deployment configuration; never edit `dist`. `npm run deploy` supports a manual build/deploy. The `sharp` override pins a patched transitive tooling dependency.
