# `lytx` Changelog

## Unreleased

### Added

- `createLytxApp` now supports typed route UI overrides via `routes.ui.dashboard`, `routes.ui.events`, and `routes.ui.explore`.
- `createLytxApp` now supports typed document override via `routes.document`.
- Route override callbacks expose strongly typed route `info` and route-specific default props/helpers for safer customization with editor autocomplete.
- `createLytxApp` now supports typed RedwoodSDK route extension via `routes.additionalRoutes`.
- Stable `lytx/vite` consumer helpers are now exported (`lytxConsumerVitePlugin`, `lytxPixelBundlePlugin`).

### Changed

- `CreateLytxAppConfig` now accepts a `routes` object for route UI overrides while preserving existing defaults when no override is provided.
- `routes.document` overrides the render wrapper component used by core `render(...)`.
- `routes.additionalRoutes` entries are appended to the core worker route tree.
- `lytxConsumerVitePlugin()` now defaults to the built-in `lytx` document instead of requiring a local `src/Document.tsx`.
- Core stylesheet includes explicit `@source` scanning so default document styling works in consumer apps without a local document wrapper.

### Migration notes

- This is additive and backward-compatible. Existing `createLytxApp(...)` calls continue to work unchanged.
- When overriding route UI, keep core API contracts in sync with your custom page logic; review `/api` docs before replacing default behavior.
- If `routes.additionalRoutes` defines the same path as a core route, core route order still takes precedence.
