// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { exec } from 'child_process';

/** @type BuildOptions */
const baseConfig = {
  bundle: true,
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production'
};

// Shared base for code that runs in a Node-based context (extension + tests).
/** @type BuildOptions */
const nodeBaseConfig = {
  ...baseConfig,
  platform: 'node',
  mainFields: ['module', 'main'],
  tsconfig: './tsconfig.json',
  format: 'cjs'
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

async function typeCheck(incremental) {
  const command = incremental
    ? 'npx tsc --incremental --noEmit'
    : 'npx tsc --noEmit';
  await execCmd(command).then(
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
}

/**
 * Runs the type-check + esbuild build/watch/test pipeline shared by every Qt
 * VS Code extension.
 *
 * `build` and `context` are injected by the caller: each extension bundles its
 * own copy of esbuild in its local node_modules, and this module lives in the
 * monorepo root where 'esbuild' cannot be resolved.
 *
 * @param {object} options
 * @param {Function} options.build             esbuild's `build`
 * @param {Function} options.context           esbuild's `context`
 * @param {string[]} options.testEntryPoints   entry points for the test build
 * @param {string} [options.entryPoint]        extension entry point
 *                                             (default './src/extension.ts')
 * @param {BuildOptions[]} [options.extraConfigs] extra configs built and watched
 *                                             alongside the extension (e.g. webviews)
 * @param {boolean} [options.incremental]      pass --incremental to the type-check
 *                                             (default true)
 */
export async function runEsbuild({
  build,
  context,
  testEntryPoints,
  entryPoint = './src/extension.ts',
  extraConfigs = [],
  incremental = true
}) {
  // Config for extension source code (to be run in a Node-based context)
  /** @type BuildOptions */
  const extensionConfig = {
    ...nodeBaseConfig,
    entryPoints: [entryPoint],
    outfile: './out/extension.js',
    external: ['vscode']
  };

  // Config for extension test source code (to be run in a Node-based context)
  /** @type BuildOptions */
  const extensionTestConfig = {
    ...nodeBaseConfig,
    entryPoints: testEntryPoints,
    outdir: './out/test/',
    external: ['vscode', './reporters/parallel-buffered', './worker.js']
  };

  await typeCheck(incremental);

  const args = process.argv.slice(2);
  try {
    if (args.includes('--watch')) {
      for (const config of [extensionConfig, ...extraConfigs]) {
        const ctx = await context({ ...config });
        await ctx.watch();
        await ctx.dispose();
      }
      console.log('[watch] build finished');
    } else if (args.includes('--test')) {
      await build(extensionTestConfig);
      console.log('[tests] build complete');
    } else {
      // Build extension and any extra (e.g. webview) code
      for (const config of [extensionConfig, ...extraConfigs]) {
        await build(config);
      }
      console.log('build complete');
    }
  } catch (err) {
    process.stderr.write(
      /** @type any */ (err)?.stderr ??
        (err instanceof Error ? err.message : String(err))
    );
    process.exit(1);
  }
}
