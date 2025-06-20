// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, './.env') });
const devPort = parseInt(process.env.VITE_DEV_PORT ?? '5173');

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index[extname]',
        chunkFileNames: 'chunk.js'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../src/webview/shared')
    }
  },
  server: {
    cors: {
      origin: /^vscode-webview:\/\//,
    },
    strictPort: true,
    port: devPort,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  }
});
