// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { execSync } from 'child_process';

function main() {
  const extensionRoot = path.resolve(__dirname, '../');
  const paths = [
    'qt-core',
    path.join('qt-core', 'webview-ui'),
    'qt-cpp',
    'qt-qml',
    'qt-ui'
  ];
  const roots = paths.map((ext) => {
    return path.join(extensionRoot, ext);
  });
  roots.push(extensionRoot); // Add the root directory as well
  console.log('Updating dependencies for:', roots.join(', '));
  roots.forEach((root) => {
    execSync(`npm update --save`, {
      cwd: root,
      stdio: 'inherit'
    });
  });
  execSync(`npm run generateLicenses:all`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
}

main();
