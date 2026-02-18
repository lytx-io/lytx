# @lytx/core Consumer Starter

This workspace is a minimal starter template for consuming `@lytx/core` with Alchemy + RedwoodSDK.

For full setup and troubleshooting guidance, see `../core/docs/self-host-quickstart.md`.

Template files:

- `demo/src/worker.tsx`
- `demo/vite.config.ts`
- `demo/alchemy.run.ts`

The starter uses only documented public `@lytx/core` entrypoints (`createLytxApp`, `SiteDurableObject`) and the documented naming helper subpath (`@lytx/core/resource-names`).

## Quick start

1. Enter the demo workspace:

```bash
cd demo
```

2. Install dependencies:

```bash
bun install
```

3. Create local env file:

```bash
cp .env.example .env
```

4. Fill required secrets in `.env`.

If you use verification/invite emails, set `EMAIL_FROM` to a real sender address and set `RESEND_API_KEY`.

Important: set `BETTER_AUTH_URL` to the exact origin your app is served from (for example `http://localhost:5173` locally and your production URL in deployed environments).

5. Run locally:

```bash
bun run dev
```

## Notes

- `alchemy.run.ts` supports deterministic resource naming (`LYTX_RESOURCE_*`) and optional app/tracking domains (`LYTX_APP_DOMAIN`, `LYTX_TRACKING_DOMAIN`).
- Modular feature flags (`LYTX_FEATURE_*`) default to enabled in `alchemy.run.ts` when unset.
- `src/worker.tsx` uses `createLytxApp(...)`, including optional tracking route prefix via `tagRoutes.pathPrefix`.
