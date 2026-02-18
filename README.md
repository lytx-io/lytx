# Lytx Kit

Open-source web analytics platform built on [RedwoodSDK](https://rwsdk.com) and Cloudflare Workers.

## Structure

- **`core/`** — The `@lytx/core` library. Contains all pages, components, API routes, middleware, and Durable Objects for the analytics platform.
- **`cli/`** — CLI tooling (setup wizard, data import scripts).

## Getting Started

See [core/README.md](core/README.md) for full documentation on how to integrate Lytx into your Redwood app.

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
