// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig } from '../common/eslint-config.mjs';

export default createConfig({
  tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url))
});
