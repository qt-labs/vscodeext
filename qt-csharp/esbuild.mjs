// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { build, context } from 'esbuild';
import { runEsbuild } from '../common/esbuild-config.mjs';

await runEsbuild({
  build,
  context,
  entryPoint: './src/extension.mts',
  testEntryPoints: [
    './test/runTest.mts',
    './test/suite/index.mts',
    './test/suite/extension.test.mts',
    './test/suite/metadata.test.mts',
    './test/suite/project.test.mts'
  ]
});
