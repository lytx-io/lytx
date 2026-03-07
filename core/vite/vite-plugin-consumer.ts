import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { lytxPixelBundlePlugin } from './vite-plugin-pixel-bundle.ts';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ENTRY_URL_PATH = '/src/client.tsx';
const RESOLVED_CLIENT_FALLBACK_ID = '\0virtual:lytx-client-entry-fallback';

type ViteManifestEntry = {
  file: string;
  src?: string;
};

export interface LytxConsumerVitePluginOptions {
  projectRoot?: string;
  documentPath?: string;
  port?: number;
  fsAllow?: string[];
}

export function lytxConsumerVitePlugin(options: LytxConsumerVitePluginOptions = {}): Plugin[] {
  const projectRoot = options.projectRoot ?? process.cwd();
  const defaultFsAllow = [path.resolve(projectRoot, '..')];
  const localClientEntryPath = path.resolve(projectRoot, 'src/client.tsx');
  const fallbackClientModulePath = path.resolve(PACKAGE_ROOT, 'src/client.tsx');
  const fallbackClientFsUrl = `/@fs/${fallbackClientModulePath.replace(/\\/g, '/')}`;
  let isServe = false;
  let base = '/';

  const buildClientFallbackModule = (forDevServer: boolean): string => {
    const targetImport = forDevServer ? fallbackClientFsUrl : fallbackClientModulePath;
    return [
      'import RefreshRuntime from "/@react-refresh";',
      'if (!window.__vite_plugin_react_preamble_installed__) {',
      '  RefreshRuntime.injectIntoGlobalHook(window);',
      '  window.$RefreshReg$ = () => {};',
      '  window.$RefreshSig$ = () => (type) => type;',
      '  window.__vite_plugin_react_preamble_installed__ = true;',
      '}',
      `import ${JSON.stringify(targetImport)};`,
      '',
    ].join('\n');
  };

  const configPlugin: Plugin = {
    name: 'vite-plugin-lytx-consumer-config',
    config() {
      return {
        publicDir: path.resolve(PACKAGE_ROOT, 'public'),
        resolve: {
          alias: {
            ...(options.documentPath
              ? { '@/Document': path.resolve(projectRoot, options.documentPath) }
              : {}),
            '@': path.resolve(PACKAGE_ROOT, 'src'),
            '@cli': path.resolve(PACKAGE_ROOT, 'cli'),
            '@app': path.resolve(PACKAGE_ROOT, 'src/app'),
            '@utilities': path.resolve(PACKAGE_ROOT, 'src/utilities'),
            '@components': path.resolve(PACKAGE_ROOT, 'src/app/components'),
            '@pages': path.resolve(PACKAGE_ROOT, 'src/pages'),
            '@api': path.resolve(PACKAGE_ROOT, 'src/api'),
            '@lib': path.resolve(PACKAGE_ROOT, 'lib'),
            '@db': path.resolve(PACKAGE_ROOT, 'db'),
            '@generated': path.resolve(PACKAGE_ROOT, 'generated'),
          },
        },
        server: {
          host: '0.0.0.0',
          allowedHosts: true,
          port: options.port ?? 5173,
          fs: {
            allow: options.fsAllow ?? defaultFsAllow,
          },
        },
      };
    },
  };

  const clientEntryFallbackPlugin: Plugin = {
    name: 'vite-plugin-lytx-consumer-client-entry-fallback',
    enforce: 'pre',
    configResolved(config) {
      isServe = config.command === 'serve';
      base = config.base;
    },
    resolveId(id) {
      if (id === CLIENT_ENTRY_URL_PATH && !fs.existsSync(localClientEntryPath)) {
        return RESOLVED_CLIENT_FALLBACK_ID;
      }
    },
    load(id) {
      if (id !== RESOLVED_CLIENT_FALLBACK_ID) return;
      return isServe
        ? buildClientFallbackModule(true)
        : `import ${JSON.stringify(fallbackClientModulePath)};`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = req.url?.split('?')[0];
        if (requestPath !== CLIENT_ENTRY_URL_PATH || fs.existsSync(localClientEntryPath)) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/javascript');
        res.end(buildClientFallbackModule(true));
      });
    },
  };

  const resolveBuiltClientEntryPath = (manifest: Record<string, ViteManifestEntry>): string | null => {
    const directMatch = manifest['src/client.tsx'] ?? manifest[CLIENT_ENTRY_URL_PATH];
    const fallbackMatch = manifest['virtual:lytx-client-entry-fallback'];
    const nestedMatch = Object.values(manifest).find((entry) => {
      if (!entry.src) return false;
      return (
        entry.src === 'src/client.tsx'
        || entry.src === CLIENT_ENTRY_URL_PATH
        || entry.src.endsWith('/src/client.tsx')
        || entry.src === 'virtual:lytx-client-entry-fallback'
      );
    });
    const resolvedFile = directMatch?.file ?? fallbackMatch?.file ?? nestedMatch?.file;
    if (!resolvedFile) return null;

    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return `${normalizedBase}${resolvedFile}`;
  };

  const rewriteRenderedClientEntryPlugin: Plugin = {
    name: 'vite-plugin-lytx-consumer-rewrite-rendered-client-entry',
    async generateBundle(_, bundle) {
      if (process.env.RWSDK_BUILD_PASS !== 'linker') {
        return;
      }
      const manifestPath = path.resolve(projectRoot, 'dist/client/.vite/manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return;
      }

      const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent) as Record<string, ViteManifestEntry>;
      const builtClientEntryPath = resolveBuiltClientEntryPath(manifest);
      if (!builtClientEntryPath) {
        return;
      }

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || !output.code.includes(CLIENT_ENTRY_URL_PATH)) {
          continue;
        }

        let rewrittenCode = output.code;
        rewrittenCode = rewrittenCode.replaceAll(`href:"${CLIENT_ENTRY_URL_PATH}"`, `href:"${builtClientEntryPath}"`);
        rewrittenCode = rewrittenCode.replaceAll(`href:'${CLIENT_ENTRY_URL_PATH}'`, `href:'${builtClientEntryPath}'`);
        rewrittenCode = rewrittenCode.replaceAll(`src:"${CLIENT_ENTRY_URL_PATH}"`, `src:"${builtClientEntryPath}"`);
        rewrittenCode = rewrittenCode.replaceAll(`src:'${CLIENT_ENTRY_URL_PATH}'`, `src:'${builtClientEntryPath}'`);
        rewrittenCode = rewrittenCode.replaceAll(`'import("${CLIENT_ENTRY_URL_PATH}")'`, `'import("${builtClientEntryPath}")'`);
        rewrittenCode = rewrittenCode.replaceAll(`"import('${CLIENT_ENTRY_URL_PATH}')"`, `"import('${builtClientEntryPath}')"`);
        rewrittenCode = rewrittenCode.replaceAll(`"import(\\"${CLIENT_ENTRY_URL_PATH}\\")"`, `"import(\\"${builtClientEntryPath}\\")"`);
        rewrittenCode = rewrittenCode.replaceAll(`'import(\\'${CLIENT_ENTRY_URL_PATH}\\')'`, `'import(\\'${builtClientEntryPath}\\')'`);
        output.code = rewrittenCode;
      }
    },
  };

  return [
    lytxPixelBundlePlugin({ templatesRoot: PACKAGE_ROOT }),
    configPlugin,
    clientEntryFallbackPlugin,
    rewriteRenderedClientEntryPlugin,
  ];
}
