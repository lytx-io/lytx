# create-lytx (draft)

Draft scaffolder for spinning up a new Lytx app from maintained templates.

## Planned usage

```bash
bunx create-lytx my-analytics --template cloudflare
npx create-lytx my-analytics --template cloudflare
npm create lytx@latest my-analytics -- --template cloudflare
```

## Current local usage

```bash
bun create-lytx/bin/lytx.mjs my-analytics --template cloudflare
```

Interactive setup (domains/auth toggles):

```bash
bun create-lytx/bin/lytx.mjs my-analytics --template cloudflare --interactive
```

One-command scaffold + provision:

```bash
bun create-lytx/bin/lytx.mjs my-analytics --template cloudflare --provision --stage dev --yes
```

Notes:

- The CLI now writes `.env` from `.env.example` automatically.
- Use `--interactive` to fill domains, sender, API keys/secrets, and feature flags.
- Use `--no-env` to skip writing `.env`.

## Current template

- `cloudflare` - RedwoodSDK + Alchemy + `lytx` app-factory starter

## Notes

- Templates are versioned in-repo so scaffolded projects match the monorepo baseline.
- The generated app is intentionally close to `demo/` with package-consumer imports.
