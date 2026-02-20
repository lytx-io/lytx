# Lytx Cloudflare Starter

This project was scaffolded from the Lytx `cloudflare` template.

## Quick Start

```bash
bun install
bun run dev
```

If you scaffolded with `--no-env`, create one first:

```bash
cp .env.example .env
```

Optional one-command provisioning:

```bash
bun alchemy deploy --stage dev
```

## What You Get

- `createLytxApp`-based worker wiring in `src/worker.tsx`
- Alchemy infra setup in `alchemy.run.ts`
- Deterministic Cloudflare resource naming via `lytx/resource-names`

## Config Defaults

- `LYTX_AUTH_GOOGLE` / `LYTX_AUTH_GITHUB` toggle social providers in `src/worker.tsx`.
- `LYTX_SIGNUP_MODE` controls public signup behavior (`bootstrap_then_invite` default; options: `open`, `bootstrap_then_invite`, `invite_only`).
- With `bootstrap_then_invite`, the first signup creates the admin account, then public signup closes automatically.
- `LYTX_APP_DOMAIN` / `LYTX_TRACKING_DOMAIN` preconfigure domains in `alchemy.run.ts`.
- `AI_PROVIDER`, `AI_MODEL`, and `AI_BASE_URL` configure AI vendor/model routing.
- `AI_ACCOUNT_ID` is used for `cloudflare` provider when `env.AI` binding is not present.

## Core Docs

- `lytx` README: https://github.com/lytx-io/lytx/tree/master/core
- Self-host guide: https://github.com/lytx-io/lytx/blob/master/core/docs/self-host-quickstart.md
