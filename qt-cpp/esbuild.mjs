// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { exec } from 'child_process';
import { build, context } from 'esbuild';

/** @type BuildOptions */
const baseConfig = {
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production'
};

// Config for extension source code (to be run in a Node-based context)
/** @type BuildOptions */
const extensionConfig = {
  ...baseConfig,
  platform: 'node',
  mainFields: ['module', 'main'],
  tsconfig: './tsconfig.json',
  format: 'cjs',
  entryPoints: ['./src/extension.ts'],
  outfile: './out/extension.js',
  external: ['vscode']
};

async function execCmd(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject([error, stdout, stderr]);
        return;
      }
      resolve(stdout);
    });
  });
}

await execCmd('npx tsc --noEmit').then(
  (stdout) => {
    if (stdout.length > 0) {
      console.log(stdout);
    }
  },
  ([error, stdout, stderr]) => {
    console.error(error.message);
    if (stderr.length > 0) {
      console.error(stderr);
    }

    if (stdout.length > 0) {
      console.error(stdout);
    }

    process.exit(1);
  }
);

// Build script
(async () => {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--watch')) {
      const extCtx = await context({
        ...extensionConfig
      });
      await extCtx.watch();
      await extCtx.dispose();
      console.log('[watch] build finished');
    } else {
      await build(extensionConfig);
      console.log('build complete');
    }
  } catch (err) {
    process.stderr.write(err.stderr);
    process.exit(1);
  }
})();
