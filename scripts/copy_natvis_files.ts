// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

const sourceDir = path.resolve('debugging_helpers/natvis');
const destDir = path.resolve('qt-cpp/res/natvis');

function copyNatvisFiles(): boolean {
  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory ${sourceDir} does not exist.`);
    console.log(`Try to run 'git submodule update --init'.`);
    return false;
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const files = fs
    .readdirSync(sourceDir)
    .filter((file) => file.endsWith('.natvis'));

  if (files.length === 0) {
    console.error('Error: No .natvis files found in source directory.');
    console.log('Check the state of the git submodule.');
    return false;
  }

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied: ${file}`);
  }

  return true;
}

try {
  const success = copyNatvisFiles();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error('Unhandled error:', error);
  process.exit(1);
}
