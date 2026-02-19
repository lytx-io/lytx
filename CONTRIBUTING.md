# Contributing to Lytx Kit

Thanks for contributing to Lytx Kit.

## Development setup

1. Install dependencies:

```bash
bun install
```

2. Read package docs:

- Core library docs: `core/README.md`
- OSS contract: `core/docs/oss-contract.md`
- Self-host quickstart: `core/docs/self-host-quickstart.md`

## Workflow expectations

- Prefer opening or linking an issue before large changes.
- Keep changes scoped and include docs updates for user-facing behavior.
- Use public `lytx` exports in examples and templates.
- For API surface changes, update `core/docs/oss-contract.md`.

## Pull request checklist

- [ ] Problem statement and scope are clear
- [ ] Code changes are minimal and focused
- [ ] Relevant docs are updated
- [ ] OSS smoke checks pass (`bun run ci:oss`)
- [ ] Breaking changes include migration notes

## Commit style

Use concise, conventional commit messages that explain intent (for example: `feat(core): add ...`, `docs(core): update ...`, `fix(demo): ...`).

## Code of conduct

Be respectful, constructive, and collaborative in all discussions and reviews.
