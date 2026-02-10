import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import alchemy from "alchemy/cloudflare/redwood";
import react from "@vitejs/plugin-react";
import path from 'path';
import { lytxPixelBundlePlugin } from './vite/vite-plugin-pixel-bundle';

function sqlPlugin() {
  return {
    name: "vite-plugin-sql",
    transform(content: string, id: string) {
      if (id.endsWith(".sql")) {
        return {
          code: `export default ${JSON.stringify(content)};`,
          map: null,
        };
      }
    },
  };
}

export default defineConfig({
  plugins: [
    lytxPixelBundlePlugin(),
    sqlPlugin(),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    alchemy(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cli': path.resolve(__dirname, './cli'),
      '@app': path.resolve(__dirname, './src/app'),
      '@utilities': path.resolve(__dirname, './src/utilities'),
      '@components': path.resolve(__dirname, './src/app/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@api': path.resolve(__dirname, './src/api'),
      '@lib': path.resolve(__dirname, './lib'),
      '@db': path.resolve(__dirname, './db'),
      '@generated': path.resolve(__dirname, './generated'),
    }
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 6123
  }
});
