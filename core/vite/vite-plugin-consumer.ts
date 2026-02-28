import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { lytxPixelBundlePlugin } from './vite-plugin-pixel-bundle.ts';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface LytxConsumerVitePluginOptions {
  projectRoot?: string;
  documentPath?: string;
  port?: number;
  fsAllow?: string[];
}

export function lytxConsumerVitePlugin(options: LytxConsumerVitePluginOptions = {}): Plugin[] {
  const projectRoot = options.projectRoot ?? process.cwd();
  const defaultFsAllow = [path.resolve(projectRoot, '..')];

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

  return [
    lytxPixelBundlePlugin({ templatesRoot: PACKAGE_ROOT }),
    configPlugin,
  ];
}
