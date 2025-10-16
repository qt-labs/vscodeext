// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

import {
  IsMacOS,
  IsWindows,
  OSExeSuffix,
  exists,
  searchForExeInQtInfo,
  findQtPathsInKitDir
} from 'qt-lib';
import { coreAPI } from '@/extension';

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function locateDesignerFromKit(
  selectedKitPath: string,
  qtPathsFallback = true
) {
  let exe = getDesignerExePathFromBin(path.join(selectedKitPath, 'bin'));
  if (await exists(exe)) {
    return exe;
  }

  if (qtPathsFallback) {
    const qtPaths = findQtPathsInKitDir(selectedKitPath);
    const exeFromQtPaths =
      qtPaths && (await locateDesignerFromQtPaths(qtPaths));
    if (exeFromQtPaths) {
      return exeFromQtPaths;
    }
  }

  if (!IsWindows) {
    exe = '/usr/bin/designer';
    if (await exists(exe)) {
      return exe;
    }
  }

  return undefined;
}

export async function locateDesignerFromQtPaths(qtPaths: string) {
  const info = coreAPI?.getQtInfoFromPath(qtPaths);
  if (!info) {
    return undefined;
  }

  return searchForExeInQtInfo(info, getDesignerExePathFromBin);
}

export async function locateDesignerFromVenvBinPaths(venvBinPath: string) {
  const candidate = path.join(venvBinPath, 'pyside6-designer' + OSExeSuffix);
  return (await exists(candidate)) ? candidate : undefined;
}

function getDesignerExePathFromBin(selectedQtBinPath: string) {
  return path.join(
    selectedQtBinPath,
    IsMacOS ? 'Designer.app/Contents/MacOS/Designer' : 'designer' + OSExeSuffix
  );
}
