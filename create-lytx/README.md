# create-lytx (draft)

Draft scaffolder for spinning up a new Lytx app from maintained templates.

## Planned usage

```bash
bunx create-lytx my-analytics --template cloudflare
```

## Current template

- `cloudflare` - RedwoodSDK + Alchemy + `@lytx/core` app-factory starter

## Notes

- Templates are versioned in-repo so scaffolded projects match the monorepo baseline.
- The generated app is intentionally close to `demo/` with package-consumer imports.
