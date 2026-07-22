// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { program } from 'commander';
import { execSync } from 'child_process';

function main() {
  program.option('--extension <string>', 'Extension to test');
  program.option('--qt-root <string>', 'Path to Qt installation directory');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtension = options.extension as string;
  const qtRoot = options.qtRoot as string;

  if (!targetExtension) {
    console.error('Error: --extension parameter is required');
    console.log('Usage: ts-node test.ts --extension=<extension-name>');
    console.log(
      'Available extensions: qt-core, qt-cpp, qt-qml, qt-python, qt-bridge-csharp, all'
    );
    process.exit(1);
  }

  const extensions = ['qt-core', 'qt-cpp', 'qt-qml', 'qt-python', 'qt-bridge-csharp'];

  if (targetExtension === 'all') {
    for (const ext of extensions) {
      runTest({ extension: ext, qtRoot: qtRoot });
    }
  } else if (extensions.includes(targetExtension)) {
    runTest({ extension: targetExtension, qtRoot: qtRoot });
  } else {
    console.error(`Error: Unknown extension "${targetExtension}"`);
    console.log('Available extensions:', extensions.join(', '), 'all');
    process.exit(1);
  }
}

interface TestOptions {
  extension: string;
  qtRoot?: string;
}

function runTest(options: TestOptions) {
  const { extension, qtRoot: qtRoot } = options;
  const extensionRoot = path.resolve(__dirname, '../');
  console.log(`\n=== Testing ${extension} ===\n`);
  const targetExtensionRoot = path.join(extensionRoot, extension);

  // Build the test command with optional qt-root config
  const testCommandBase = 'npm run test';
  let args = '';
  if (qtRoot) {
    // Pass qt-root to extensions that need it (currently qt-cpp)
    args += ` --qt-root="${qtRoot}"`;
  }

  const testCommand = testCommandBase + (args ? ' -- ' + args : '');

  try {
    execSync(testCommand, {
      cwd: targetExtensionRoot,
      stdio: 'inherit'
    });
    console.log(`\n✓ ${extension} tests passed\n`);
  } catch (error) {
    console.error(`\n✗ ${extension} tests failed\n`);
    throw error;
  }
}

main();
