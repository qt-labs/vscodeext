/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as path from 'path';

import {
  genericDataLocation,
  legacyQtAccountIniPath,
  qtCompanyIniPath,
  qtIniPath
} from '../../src/paths';

describe('paths', () => {
  it('qtIniPath is <GenericDataLocation>/Qt/Qt.ini', () => {
    const p = qtIniPath();
    assert.equal(p, path.join(genericDataLocation(), 'Qt', 'Qt.ini'));
    assert.ok(p.endsWith(path.join('Qt', 'Qt.ini')));
  });

  it('genericDataLocation follows QStandardPaths per platform', () => {
    const p = genericDataLocation();
    if (process.platform === 'darwin') {
      assert.ok(p.endsWith(path.join('Library', 'Application Support')), p);
    } else if (process.platform === 'win32') {
      assert.ok(/AppData[\\/]Roaming$/.test(p) || !!process.env.APPDATA, p);
    } else {
      assert.ok(
        p === process.env.XDG_DATA_HOME || p.endsWith('.local/share'),
        p
      );
    }
  });

  it('qtCompanyIniPath ends with QtCompany/QtCompany.ini', () => {
    assert.ok(
      qtCompanyIniPath().endsWith(path.join('QtCompany', 'QtCompany.ini'))
    );
  });

  it('legacyQtAccountIniPath ends with Qt/qtaccount.ini', () => {
    assert.ok(
      legacyQtAccountIniPath().endsWith(path.join('Qt', 'qtaccount.ini'))
    );
  });
});
