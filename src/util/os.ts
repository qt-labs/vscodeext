// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as os from 'os';

export const Home = os.homedir();
export const IsWindows = process.platform === 'win32';
export const IsMacOS = process.platform === 'darwin';
export const IsLinux = process.platform === 'linux';
