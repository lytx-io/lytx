# @lytx/core Consumer Starter

This workspace is a minimal starter template for consuming `@lytx/core` with Alchemy + RedwoodSDK.

Template files:

- `demo/src/worker.tsx`
- `demo/vite.config.ts`
- `demo/alchemy.run.ts`

The starter uses only public root exports from `@lytx/core` (`createLytxApp`, `SiteDurableObject`, `SyncDurableObject`, and `resolveLytxResourceNames`).

## Quick start

1. Install dependencies:

```bash
bun install
```

2. Create local env file:

```bash
cp .env.example .env
```

3. Fill required secrets in `.env`.

4. Run locally:

```bash
bun run dev
```

## Notes

- `alchemy.run.ts` supports deterministic resource naming (`LYTX_RESOURCE_*`) and optional app/tracking domains (`LYTX_APP_DOMAIN`, `LYTX_TRACKING_DOMAIN`).
- `src/worker.tsx` uses `createLytxApp(...)`, including optional tracking route prefix via `tagRoutes.pathPrefix`.
