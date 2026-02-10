# Lytx Script Templates

This directory contains the JavaScript tracking scripts that are bundled and served to client websites.

## Script Variants

| Export | File | Description |
|--------|------|-------------|
| `script_core` | `lytxpixel-core.ts` | Core tracking only, NO third-party vendors |
| `script_tag_manager` | `lytxpixel.ts` | Full version WITH third-party vendor integrations |

## IMPORTANT: Tag Manager is OPT-IN

**By default, `tag_manager` is DISABLED for all sites.**

The `script_core` bundle is served unless a site explicitly enables `tag_manager` in their site configuration.

### What this means:

- **`tag_manager = false` (DEFAULT):** Site receives `script_core` - only Lytx event tracking, no third-party scripts
- **`tag_manager = true` (OPT-IN):** Site receives `script_tag_manager` - includes all vendor integrations

## Cookie & Privacy Compliance Warning

**When `tag_manager` is enabled, the following third-party vendor scripts may be loaded:**

- Google Analytics / Google Ads
- Meta (Facebook) Pixel
- LinkedIn Insight Tag
- Quantcast
- SimpleFi
- ClickCease

### USER RESPONSIBILITY

**If you enable `tag_manager` for a site, YOU are responsible for:**

1. **Cookie Consent:** Ensuring proper cookie consent banners/mechanisms are in place
2. **Privacy Policy:** Updating the site's privacy policy to disclose third-party tracking
3. **GDPR/CCPA Compliance:** Meeting all applicable privacy regulations
4. **Vendor Terms:** Complying with each vendor's terms of service

**Lytx does NOT manage cookie consent for third-party vendor tags.** 

The site owner/operator enabling `tag_manager` assumes full responsibility for any cookies or tracking pixels fired by these vendor integrations.

## File Structure

```
src/templates/
├── lytx-shared.ts       # Shared types, utilities, core functions
├── lytxpixel.ts         # Full version (tag_manager enabled)
├── lytxpixel-core.ts    # Core version (tag_manager disabled)
├── trackWebEvents.ts    # Event tracking API
└── vendors/             # Third-party vendor integrations
    ├── google.ts        # Google Analytics/Ads
    ├── meta.ts          # Meta/Facebook Pixel
    ├── linkedin.ts      # LinkedIn Insight Tag
    ├── quantcast.ts     # Quantcast
    ├── simplfi.ts       # SimpleFi
    └── clickcease.ts    # ClickCease
```

## How Bundling Works

Scripts are bundled at **build time** via the Vite plugin (`vite/vite-plugin-pixel-bundle.ts`):

1. `lytxpixel.ts` and `lytxpixel-core.ts` are bundled using esbuild
2. Bundled strings are exposed as virtual module `virtual:lytx-pixel-raw`
3. The appropriate bundle is served based on the site's `tag_manager` setting

No runtime bundling occurs - both bundles are pre-compiled and embedded in the worker.

## Modifying Scripts

- **Shared logic:** Edit `lytx-shared.ts` - changes apply to both versions
- **Core-only changes:** Edit `lytxpixel-core.ts`
- **Vendor integration changes:** Edit `lytxpixel.ts` or files in `vendors/`

After making changes, run `bun run build` to regenerate the bundles.
