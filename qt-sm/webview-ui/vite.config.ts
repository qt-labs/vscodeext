// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index[extname]',
        chunkFileNames: 'chunk.js'
      }
    }
  }
});
