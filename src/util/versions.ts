// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export function compareVersions(version1: string, version2: string) {
  if (version1 == version2) {
    return 0;
  }
  const v1parts = version1.split('.');
  const v2parts = version2.split('.');

  for (let i = 0; i < v1parts.length; ++i) {
    if (v2parts.length === i) {
      return 1;
    }
    const v1Part = v1parts[i];
    const v2Part = v2parts[i];
    if (v1Part === undefined) {
      throw new Error('v1Part is undefined');
    }
    if (v2Part === undefined) {
      throw new Error('v2Part is undefined');
    }
    if (v1Part === v2Part) {
      continue;
    }
    if (v1Part > v2Part) {
      return 1;
    }
    return -1;
  }

  if (v1parts.length !== v2parts.length) {
    return -1;
  }

  return 0;
}
