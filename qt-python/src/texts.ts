// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export const task = {
  execDone: (name: string) => `Task done: ${name}`,
  execDoneWithCode: (code: string) => `Task ended with exit code: ${code}`
};
