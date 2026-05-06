// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { getQtQmlApi } from 'qt-lib';

export class QmlTraceDoc implements vscode.CustomDocument {
  constructor(private readonly _uri: vscode.Uri) {}

  // eslint-disable-next-line
  public dispose() {}

  get uri() {
    return this._uri;
  }

  public async getAdditionalDirs() {
    const qmlApi = await getQtQmlApi();
    return qmlApi ? qmlApi.traceFile.getAdditionalDirs(this._uri) : [];
  }

  public async setAdditionalDirs(dirs: string[]) {
    const qmlApi = await getQtQmlApi();
    if (qmlApi) {
      const value = dirs.map((d) => d.trim()).filter((d) => d.length > 0);
      qmlApi.traceFile.setAdditionalDirs(this._uri, value);
    }
  }
}
