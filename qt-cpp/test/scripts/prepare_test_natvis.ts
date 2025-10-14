// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// Minimal prepare script: create a temp dir inside qt-cpp/test

import { promises as fsp } from 'fs';
import path from 'path';

async function main() {
  const testRoot = path.join(__dirname, '..');
  const srcDir = path.join(testRoot, 'projectFolderNatvis');
  const tmpDir = path.join(testRoot, 'tmp-natvis');

  // Clean old tmp dir if exists
  await fsp.rm(tmpDir, { recursive: true, force: true });
  // Copy projectFolder into tmp-natvis
  await fsp.cp(srcDir, tmpDir, { recursive: true });

  console.log('[prepare-test-natvis] Copied', srcDir, 'into ', tmpDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
