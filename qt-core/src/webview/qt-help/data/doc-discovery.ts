// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';

import { QtAdditionalPath, CoreAPI, compareVersions } from 'qt-lib';
import { fsDir } from '@/fs-utils';
import { DocRootInfo } from '@/webview/shared/qt-help';

export interface DocRootFindContext {
  purpose: 'doc-browser';
  coreApi?: CoreAPI;
  insRoot?: string;
  additionalQtpathsList?: QtAdditionalPath[];
}

export function findDocRoots(c: DocRootFindContext): DocRootInfo[] {
  const all: DocRootInfo[] = [];
  const seen = new Set<string>();

  const addUnique = (items: DocRootInfo[]) => {
    for (const item of items) {
      if (!seen.has(item.fsPath)) {
        seen.add(item.fsPath);
        all.push(item);
      }
    }
  };

  if (c.insRoot) {
    addUnique(findByInsRoot(c.insRoot));
  }

  if (c.coreApi && c.additionalQtpathsList) {
    const found = c.additionalQtpathsList
      .map((p: QtAdditionalPath) => findByQtpathsExe(p.path, c.coreApi))
      .filter((e) => e !== undefined);

    addUnique(found);
  }

  return sortFilter(all, c);
}

function sortFilter(all: DocRootInfo[], c?: DocRootFindContext) {
  if (c?.purpose === 'doc-browser') {
    return all
      .filter((e) => e.version.startsWith('6.'))
      .sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === 'insRoot' ? -1 : 1;
        }

        return -1 * compareVersions(a.version, b.version);
      });
  }

  return all;
}

function findByInsRoot(insRoot: string) {
  const docs = 'Docs';
  const names = fsDir(insRoot, docs).subDirNames();
  const prefixLength = 'Qt-'.length;

  return names.map(
    (name) =>
      ({
        source: 'insRoot',
        version: name.substring(prefixLength),
        fsPath: path.join(insRoot, docs, name)
      }) as DocRootInfo
  );
}

function findByQtpathsExe(exePath: string, coreApi?: CoreAPI) {
  const info = coreApi?.getQtInfoFromPath(exePath).info;
  if (!info) {
    return undefined;
  }

  return {
    source: 'qtpaths',
    version: info.get('QT_VERSION') ?? '',
    fsPath: info.get('QT_INSTALL_DOCS')
  } as DocRootInfo;
}
