import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { lytxPixelBundlePlugin } from './vite-plugin-pixel-bundle.ts';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ENTRY_URL_PATH = '/src/client.tsx';
const RESOLVED_CLIENT_FALLBACK_ID = '\0virtual:lytx-client-entry-fallback';

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

  return [
    lytxPixelBundlePlugin({ templatesRoot: PACKAGE_ROOT }),
    configPlugin,
    clientEntryFallbackPlugin,
  ];
}
