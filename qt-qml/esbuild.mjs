// Copyright (C) 2024 The Qt Company Ltd.
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
    './test/suite/command.test.mts',
    './test/suite/installer.test.mts',
    './test/runTest.qml-debug.mts',
    './test/runTestHelper.mts',
    './test/suite/index-qml-debug.mts',
    './test/suite/qml-debug.test.mts',
    './test/suite/versioned-installations.test.mts',
    './test/debug-helper.mts'
  ]
});
