# Lytx Kit

Open-source web analytics platform built on [RedwoodSDK](https://rwsdk.com) and Cloudflare Workers.

## Structure

- **`core/`** — The `@lytx/core` library. Contains all pages, components, API routes, middleware, and Durable Objects for the analytics platform.
- **`cli/`** — CLI tooling (setup wizard, data import scripts).
- **`create-lytx/`** — Draft app scaffolder and starter templates (including Cloudflare starter).

## Getting Started

See [core/README.md](core/README.md) for full documentation on how to integrate Lytx into your Redwood app.

## App Scaffolder (Draft)

The monorepo now includes a draft scaffolder package at `create-lytx/` with a maintained Cloudflare starter template.

Run locally from this repo:

```bash
bun create-lytx/bin/lytx.mjs my-analytics --template cloudflare
```

Interactive setup + defaults:

```bash
bun create-lytx/bin/lytx.mjs my-analytics --template cloudflare --interactive
```

Scaffold and provision in one command:

```bash
bun create-lytx/bin/lytx.mjs my-analytics --template cloudflare --provision --stage dev --yes
```

Planned published usage:

```bash
bunx create-lytx my-analytics --template cloudflare
```

Generated projects are aligned with the `demo/` setup pattern and include:

- `alchemy.run.ts` wired to `@lytx/core/resource-names`
- `src/worker.tsx` using `createLytxApp(...)`
- Redwood + Vite starter files and `.env.example`

After scaffolding:

```bash
cd my-analytics
cp .env.example .env
bun install
bun run dev
```

## Governance

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [Pull request template](.github/pull_request_template.md)
- [Issue templates](.github/ISSUE_TEMPLATE/)

### Quick Start

```bash
cd core
bun install
bun run setup      # Interactive setup wizard
bun run dev        # Start local development
```

## License

MIT — see [LICENSE](LICENSE) for details.
