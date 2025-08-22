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
    const ext = vscode.extensions.getExtension('theqtcompany.qt-core');
    if (!ext) {
      throw new Error('qt-core extension not found');
    }
    await ext.activate();
  });

  it('activates the qt-core extension', () => {
    expect(isExtensionActive('theqtcompany.qt-core')).to.be.true;
  });
  it('activates all declared extension dependencies', () => {
    assertAllDependenciesAreActive(packageJson);
  });
  it('registers all contributed commands', async () => {
    await assertAllCommandsAreRegistered(packageJson);
  });
});
