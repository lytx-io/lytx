# Lytx Cloudflare Starter

This project was scaffolded from the Lytx `cloudflare` template.

## Quick Start

```bash
cp .env.example .env
bun install
bun run dev
```

Optional one-command provisioning:

```bash
bun alchemy deploy --stage dev
```

## What You Get

- `createLytxApp`-based worker wiring in `src/worker.tsx`
- Alchemy infra setup in `alchemy.run.ts`
- Deterministic Cloudflare resource naming via `@lytx/core/resource-names`

## Config Defaults

- `LYTX_AUTH_GOOGLE` / `LYTX_AUTH_GITHUB` toggle social providers in `src/worker.tsx`.
- `LYTX_APP_DOMAIN` / `LYTX_TRACKING_DOMAIN` preconfigure domains in `alchemy.run.ts`.

## Core Docs

- `@lytx/core` README: https://github.com/lytx-io/kit/tree/master/core
- Self-host guide: https://github.com/lytx-io/kit/blob/master/core/docs/self-host-quickstart.md
