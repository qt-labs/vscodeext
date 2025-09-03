// Copyright (C) 2025 The Qt Company Ltd.
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
    const ext = vscode.extensions.getExtension('theqtcompany.qt-cpp');
    if (!ext) throw new Error('qt-cpp extension not found');
    await ext.activate();
  });

  it('activates the qt-cpp extension', () => {
    expect(isExtensionActive('theqtcompany.qt-cpp')).to.be.true;
  });

  it('activates all declared extension dependencies', () => {
    assertAllDependenciesAreActive(packageJson);
  });

  it('registers all contributed commands', async () => {
    await assertAllCommandsAreRegistered(packageJson);
  });
});
