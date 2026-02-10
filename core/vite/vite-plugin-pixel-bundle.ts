/**
 * Vite Plugin: Lytx Pixel Bundle
 * 
 * This plugin bundles the lytxpixel scripts at build time and exposes them
 * as virtual modules. This replaces the manual rawScriptString.ts build step.
 * 
 * Two bundles are generated:
 * - Full version (with third-party vendors): for tag_manager = true
 * - Core version (no vendors): for tag_manager = false
 * 
 * Usage:
 *   import { script_tag_manager, script_core } from 'virtual:lytx-pixel-raw';
 */
import { build } from 'esbuild';
import path from 'path';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:lytx-pixel-raw';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_MODULE_ID;

interface CachedBundles {
  full: string | null;
  core: string | null;
}

export function lytxPixelBundlePlugin(): Plugin {
  let cachedBundles: CachedBundles = { full: null, core: null };
  let rootDir: string;

  return {
    name: 'vite-plugin-lytx-pixel-bundle',

    configResolved(config) {
      rootDir = config.root;
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_ID;
      }
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_ID) {
        // Build both bundles in parallel if not cached
        const [fullBundle, coreBundle] = await Promise.all([
          cachedBundles.full ?? bundlePixelScript(rootDir, 'full'),
          cachedBundles.core ?? bundlePixelScript(rootDir, 'core'),
        ]);
        
        cachedBundles.full = fullBundle;
        cachedBundles.core = coreBundle;

        return `
export const script_tag_manager = ${JSON.stringify(fullBundle)};
export const script_core = ${JSON.stringify(coreBundle)};
`;
      }
    },

    // Invalidate cache in dev mode when source files change
    handleHotUpdate({ file }) {
      if (
        file.includes('templates/lytxpixel') ||
        file.includes('templates/vendors') ||
        file.includes('templates/trackWebEvents')
      ) {
        cachedBundles = { full: null, core: null };
      }
    },
  };
}

async function bundlePixelScript(rootDir: string, variant: 'full' | 'core'): Promise<string> {
  const entryFile = variant === 'full' ? 'lytxpixel.ts' : 'lytxpixel-core.ts';
  const entryPoint = path.resolve(rootDir, `src/templates/${entryFile}`);
  
  // Log info about tracking domain (only on first bundle to avoid duplicate logs)
  if (variant === 'full') {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════════╗');
    console.log('  ║                                                          ║');
    console.log('  ║  🔗 LYTX TRACKING SCRIPT                                 ║');
    console.log('  ║                                                          ║');
    console.log('  ║  📡 Domain is set dynamically at runtime from request    ║');
    console.log('  ║                                                          ║');
    console.log('  ╚══════════════════════════════════════════════════════════╝');
    console.log('');
  }

  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    target: 'es2017',
    format: 'esm',
    treeShaking: true,
    charset: 'utf8',
    minify: true,
  });

  let code = result.outputFiles[0].text;

  // Convert named exports to variable assignments (e.g., "export{L as parseData}" -> "var parseData=L;")
  // This preserves the exported names so they can be called from the wrapper script
  code = code
    .replace(/export\s*\{([^}]+)\};?/g, (match, exports) => {
      // Parse exports like "L as parseData, M as trackEvents" or just "parseData"
      return exports.split(',').map((exp: string) => {
        const parts = exp.trim().split(/\s+as\s+/);
        if (parts.length === 2) {
          // "L as parseData" -> "var parseData=L;"
          return `var ${parts[1].trim()}=${parts[0].trim()};`;
        } else {
          // "parseData" -> already available, no action needed
          return '';
        }
      }).join('');
    })
    .replace(/export\s+default\s+[^;]+;?/g, '')
    .trim();

  return code;
}

export default lytxPixelBundlePlugin;
