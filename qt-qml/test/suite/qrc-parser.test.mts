// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { QRCParser } from 'qt-lib';

function qrcXml(entries: string[]) {
  const files = entries.map((e) => `<file>${e}</file>`).join('');
  return `<RCC><qresource prefix="/">${files}</qresource></RCC>`;
}

function trySymlink(target: string, linkPath: string) {
  try {
    fs.symlinkSync(target, linkPath);
    return true;
  } catch {
    return false;
  }
}

suite('QRC parser containment (R7)', () => {
  let qrcDir: string;
  let outside: string;

  setup(() => {
    qrcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrc-dir-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'qrc-outside-'));
  });

  teardown(() => {
    fs.rmSync(qrcDir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  test('keeps a relative entry inside the qrc directory', () => {
    const map = new QRCParser().parseQRC(qrcXml(['Main.qml']), qrcDir);
    expect(map?.get('/Main.qml')).to.equal(path.join(qrcDir, 'Main.qml'));
  });

  test('keeps a not-yet-existing entry inside the qrc directory', () => {
    const map = new QRCParser().parseQRC(qrcXml(['sub/New.qml']), qrcDir);
    expect(map?.get('/sub/New.qml')).to.equal(path.join(qrcDir, 'sub/New.qml'));
  });

  test('drops a .. traversal entry and reports it', () => {
    const dropped: string[] = [];
    const map = new QRCParser().parseQRC(
      qrcXml(['../../escape.qml', 'Ok.qml']),
      qrcDir,
      false,
      { onViolation: (entry) => dropped.push(entry) }
    );
    expect(map?.has('/Ok.qml')).to.equal(true);
    expect([...(map?.keys() ?? [])]).to.have.lengthOf(1);
    expect(dropped).to.deep.equal(['../../escape.qml']);
  });

  test('drops an absolute entry outside every root', () => {
    const target = path.join(outside, 'secret.qml');
    const map = new QRCParser().parseQRC(qrcXml([target]), qrcDir);
    expect(map?.size ?? 0).to.equal(0);
  });

  test('keeps an absolute entry inside an extra root', () => {
    const target = path.join(outside, 'Generated.qml');
    fs.writeFileSync(target, '');
    const map = new QRCParser().parseQRC(qrcXml([target]), qrcDir, false, {
      extraRoots: [outside]
    });
    expect(map?.size).to.equal(1);
    expect([...(map?.values() ?? [])]).to.deep.equal([target]);
  });

  test('drops an in-tree symlink resolving outside every root', function () {
    const secret = path.join(outside, 'secret.qml');
    fs.writeFileSync(secret, '');
    if (!trySymlink(secret, path.join(qrcDir, 'Link.qml'))) {
      this.skip();
    }
    const map = new QRCParser().parseQRC(qrcXml(['Link.qml']), qrcDir);
    expect(map?.size ?? 0).to.equal(0);
  });

  test('accepts entries through a symlinked root', function () {
    // A workspace folder path may itself be a symlink while generated qrc
    // files reference the physical path; roots are realpathed so both
    // spellings must pass.
    const linkRoot = path.join(outside, 'ws-link');
    if (!trySymlink(qrcDir, linkRoot)) {
      this.skip();
    }
    const target = path.join(fs.realpathSync(qrcDir), 'App.qml');
    fs.writeFileSync(target, '');
    const map = new QRCParser().parseQRC(qrcXml([target]), qrcDir, false, {
      extraRoots: [linkRoot]
    });
    expect(map?.size).to.equal(1);
  });

  test('caches per root set in parseQRCFile', () => {
    const parser = new QRCParser();
    const generated = path.join(outside, 'Gen.qml');
    fs.writeFileSync(generated, '');
    const qrcPath = path.join(qrcDir, 'res.qrc');
    fs.writeFileSync(qrcPath, qrcXml([generated]));

    const withoutRoot = parser.parseQRCFile(qrcPath);
    const withRoot = parser.parseQRCFile(qrcPath, false, {
      extraRoots: [outside]
    });
    expect(withoutRoot?.size ?? 0).to.equal(0);
    expect(withRoot?.size).to.equal(1);
  });
});
