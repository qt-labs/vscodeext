// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { build, context } from 'esbuild';

import { runEsbuild } from '../common/esbuild-config.mjs';

await runEsbuild({
  build,
  context,
  entryPoint: './src/extension.ts',
  testEntryPoints: [
    './test/runTest.ts',
    './test/suite/index.ts',
    './test/helper.mts',
    './test/suite/extension.test.mts',
    './test/suite/commands.test.mts'
  ]
});
