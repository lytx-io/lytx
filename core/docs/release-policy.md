# `@lytx/core` Semver and Release Policy

This document defines versioning semantics, release workflow, changelog conventions, and compatibility support for `@lytx/core`.

## Versioning model

`@lytx/core` follows semantic versioning for the supported API contract in `docs/oss-contract.md`.

- Patch (`x.y.Z`)
  - Bug fixes and low-risk internal improvements.
  - No intentional breaking API changes.
- Minor (`x.Y.z`)
  - Backward-compatible features and additive API surface.
  - May include deprecations with migration guidance.
- Major (`X.y.z`)
  - Breaking API/runtime behavior changes.
  - Must include migration documentation.

## Changelog conventions

Each release should include a changelog entry with these sections:

- `Added`
- `Changed`
- `Deprecated`
- `Removed`
- `Fixed`
- `Security`

Every breaking or behaviorally significant change must include:

- affected API/feature area
- impact summary
- migration guidance

Migration instructions are maintained in `docs/migration-guide.md`.

## Compatibility matrix

The matrix below defines expected compatibility targets for current releases.

| Component | Supported Range | Notes |
|---|---|---|
| Alchemy | `>=0.84.0 <1.0.0` | Reference deploy scripts use Alchemy Cloudflare resources + Redwood worker integration |
| RedwoodSDK (`rwsdk`) | `1.0.0-beta.49` | Primary tested baseline for worker/router/client integration |
| Wrangler | `>=4.59.3 <5.0.0` | Worker, D1, KV, Queue, Durable Object tooling |
| Vite | `>=7.3.1 <8.0.0` | Build/runtime integration and pixel virtual module wiring |

If compatibility bounds change, update this table in the same PR as the dependency change.

## Release workflow

1. Ensure all release-blocking issues are closed or explicitly deferred.
2. Run quality gates:
   - OSS smoke CI checks (`ci:oss`)
   - any package tests/typechecks required by the release scope
3. Update docs:
   - changelog entry
   - migration notes for breaking/deprecated behavior
   - compatibility matrix updates (if needed)
4. Bump package version in `core/package.json`.
5. Create and push release tag.
6. Publish release artifacts.

## Release checklist (enforced)

Before cutting a release, verify:

- [ ] `docs/oss-contract.md` reflects current stable/experimental/internal boundaries
- [ ] `docs/release-policy.md` compatibility matrix is current
- [ ] `ci:oss` is green for baseline and customized profiles
- [ ] Migration/deprecation notes exist for any non-trivial behavior changes
- [ ] Starter template (`demo/`) still uses public `@lytx/core` exports

## Deprecation minimums

- Stable API deprecations should remain available for at least one minor release when feasible.
- Removals happen in the next major unless security/runtime constraints require faster action.
