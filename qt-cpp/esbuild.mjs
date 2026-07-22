// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { build, context } from 'esbuild';

import { runEsbuild } from '../common/esbuild-config.mjs';

await runEsbuild({
  build,
  context,
  entryPoint: './src/extension.ts',
  testEntryPoints: [
    './test/runTest.mts',
    './test/runTest.build.mts',
    './test/runTest.natvis.mts',
    './test/runTest.presets.mts',
    './test/util/stdioFilter.mts',
    './test/suite/index.mts',
    './test/suite/index-build.mts',
    './test/suite/index-natvis.mts',
    './test/suite/index-presets.mts',
    './test/suite/extension.test.mts',
    './test/suite/commands.test.mts',
    './test/suite/build.test.mts',
    './test/suite/natvis.test.mts',
    './test/suite/presets.test.mts'
  ]
});
