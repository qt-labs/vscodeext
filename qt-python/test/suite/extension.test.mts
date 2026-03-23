// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as vscode from 'vscode';
import {
  isExtensionActive,
  assertAllDependenciesAreActive,
  assertAllCommandsAreRegistered
} from 'qt-lib';

const packageJson = require('../../package.json');

describe('extension', () => {
  before('activate', async function () {
    this.timeout(30000);
    const ext = vscode.extensions.getExtension('theqtcompany.qt-python');
    if (!ext) throw new Error('qt-python extension not found');
    await ext.activate();
  });

  it('activates the qt-python extension', () => {
    expect(isExtensionActive('theqtcompany.qt-python')).to.be.true;
  });

  it('activates all declared extension dependencies', () => {
    assertAllDependenciesAreActive(packageJson);
  });

  it('registers all contributed commands', async () => {
    await assertAllCommandsAreRegistered(packageJson);
  });
});
