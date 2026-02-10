// Stub declarations used by tsconfig.json.
// Vite/RWSDK types are primarily provided by generated worker/runtime types.

/**
 * Virtual module: Lytx Pixel Bundle
 * 
 * This module is generated at build time by vite-plugin-pixel-bundle.
 * It contains the bundled JavaScript code for the Lytx tracking pixel.
 * 
 * Two bundles are available:
 * - script_tag_manager: Full version with third-party vendors (tag_manager = true)
 * - script_core: Core version without vendors (tag_manager = false)
 */
declare module 'virtual:lytx-pixel-raw' {
  /** Full bundled JavaScript with all third-party vendor integrations (tag_manager = true) */
  export const script_tag_manager: string;
  /** Core bundled JavaScript without third-party vendor integrations (tag_manager = false) */
  export const script_core: string;
}
