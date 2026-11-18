/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import * as os from 'os';
import * as path from 'path';

import {
  genericDataLocation,
  legacyQtAccountIniPath,
  localSocketPath,
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

  describe('localSocketPath', () => {
    const saved = {
      TMPDIR: process.env.TMPDIR,
      XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR
    };

    function setEnv(name: string, value: string | undefined): void {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }

    afterEach(() => {
      setEnv('TMPDIR', saved.TMPDIR);
      setEnv('XDG_RUNTIME_DIR', saved.XDG_RUNTIME_DIR);
    });

    // sun_path holds 104 bytes on macOS and 108 on Linux, with the NUL byte.
    const MAX = 103;
    const NAME = 'qtclient_socket';
    const longDir = '/' + 'x'.repeat(MAX - NAME.length);
    const uid = String(process.getuid?.() ?? '');

    if (process.platform === 'win32') {
      it('is the named pipe', () => {
        assert.equal(localSocketPath(), '\\\\.\\pipe\\qtclient_socket');
      });
      return;
    }

    it('is <tmpdir>/qtclient_socket when that fits', () => {
      setEnv('TMPDIR', '/tmp');
      assert.equal(localSocketPath(), path.join(os.tmpdir(), NAME));
      assert.equal(localSocketPath(), '/tmp/qtclient_socket');
    });

    it('keeps a path of exactly 103 bytes in the temp directory', () => {
      const dir = '/' + 'y'.repeat(MAX - 1 - NAME.length - 1);
      setEnv('TMPDIR', dir);
      const expected = `${dir}/${NAME}`;
      assert.equal(Buffer.byteLength(expected), MAX);
      assert.equal(localSocketPath(), expected);
    });

    it('moves to XDG_RUNTIME_DIR when the temp path is too long', () => {
      setEnv('TMPDIR', longDir);
      setEnv('XDG_RUNTIME_DIR', '/run/user/1000');
      assert.ok(Buffer.byteLength(`${longDir}/${NAME}`) > MAX);
      assert.equal(localSocketPath(), '/run/user/1000/qtclient_socket');
    });

    it('falls back to /tmp with the user id when XDG_RUNTIME_DIR is not set', () => {
      setEnv('TMPDIR', longDir);
      setEnv('XDG_RUNTIME_DIR', undefined);
      assert.equal(localSocketPath(), `/tmp/qtclient_socket-${uid}`);
    });

    it('falls back to /tmp with the user id when XDG_RUNTIME_DIR is too long', () => {
      setEnv('TMPDIR', longDir);
      setEnv('XDG_RUNTIME_DIR', longDir);
      assert.equal(localSocketPath(), `/tmp/qtclient_socket-${uid}`);
    });

    it('measures the path in bytes, not characters', () => {
      // 34 three-byte characters: 34 characters, 102 bytes, plus "/" and
      // the name is far over the limit although it is short in characters.
      const dir = '/' + '\u20ac'.repeat(34);
      setEnv('TMPDIR', dir);
      setEnv('XDG_RUNTIME_DIR', '/run/user/1000');
      assert.equal(localSocketPath(), '/run/user/1000/qtclient_socket');
    });

    it('names another socket the same way', () => {
      setEnv('TMPDIR', '/tmp');
      assert.equal(
        localSocketPath('qtclient_offline_42'),
        '/tmp/qtclient_offline_42'
      );
    });
  });
});
