# MSX Village Web App

React and TypeScript frontend with a Cloudflare Worker API, built using Vite and the Cloudflare Vite plugin.

## Local development

Use Node.js 22.12 or newer. From this directory:

```sh
npm ci
npm run dev
```

The page fetches its greeting from `GET /api/hello`. Unknown API routes return JSON with status 404. Other URLs use the React SPA fallback.

## Validation and deployment

```sh
npm run cf-typegen
npm run build
npx wrangler deploy --dry-run
```

Regenerate `worker-configuration.d.ts` whenever Wrangler bindings or compatibility settings change. `npm run preview` serves the production build locally. `npm run deploy` builds and deploys manually using your Cloudflare authentication.

The `sharp` override pins the patched version of a transitive local-tooling dependency. Review it when upgrading Cloudflare tooling.

## GitHub auto deployment

Cloudflare Workers Builds connects `jannone/msx-village` to the `msx-village` Worker using:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `webapp` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview builds | Disabled |

Cloudflare installs dependencies from `package-lock.json`, runs the build including TypeScript checks, and deploys the generated Worker and static assets. The Vite plugin generates the deployment configuration; do not edit files in `dist`.

The initial app has no authentication, settlement writes, or database bindings. D1 will be added with the first persistent feature.
