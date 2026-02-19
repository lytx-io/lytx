# Lytx Cloudflare Starter

This project was scaffolded from the Lytx `cloudflare` template.

## Quick Start

```bash
cp .env.example .env
bun install
bun run dev
```

## What You Get

- `createLytxApp`-based worker wiring in `src/worker.tsx`
- Alchemy infra setup in `alchemy.run.ts`
- Deterministic Cloudflare resource naming via `@lytx/core/resource-names`

## Core Docs

- `@lytx/core` README: https://github.com/lytx-io/kit/tree/master/core
- Self-host guide: https://github.com/lytx-io/kit/blob/master/core/docs/self-host-quickstart.md
