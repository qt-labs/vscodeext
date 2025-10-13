// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// Minimal clean script: remove the temp dir inside qt-cpp/test

import { promises as fsp } from 'fs';
import path from 'path';

async function main() {
  const tmpDir = path.join(__dirname, '..', 'tmp-build');
  await fsp.rm(tmpDir, { recursive: true, force: true });
  console.log('[clean-test-build] Removed', tmpDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
