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
const extensionId = 'theqtcompany.qt-bridge-csharp';

describe('extension', () => {
  before('activate', async function () {
    this.timeout(30000);
    const extension = vscode.extensions.getExtension(extensionId);
    if (!extension) throw new Error('qt-bridge-csharp extension not found');
    await extension.activate();
  });

  it('activates the qt-bridge-csharp extension', () => {
    expect(isExtensionActive(extensionId)).to.be.true;
  });

  it('activates all declared extension dependencies', () => {
    assertAllDependenciesAreActive(packageJson);
  });

  it('registers all contributed commands', async () => {
    await assertAllCommandsAreRegistered(packageJson);
  });
});
