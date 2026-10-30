// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import initSqlJs, { SqlJsStatic } from 'sql.js';

let sqlPromise: Promise<SqlJsStatic> | undefined;

export async function fetchSql(distPath: string) {
  // note,
  // the distPath needs to have 'sql-wasm.wasm'
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => {
        return path.join(distPath, file);
      }
    });
  }

  return sqlPromise;
}
