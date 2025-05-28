// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as vscode from 'vscode';

const packageJson = require('../../../package.json');

describe('extension', () => {
  before('activate', async function () {
    this.timeout(30000);
    const ext = vscode.extensions.getExtension('theqtcompany.qt-cpp');
    if (!ext) throw new Error('qt-cpp extension not found');
    await ext.activate();
  });

  it('activates the qt-cpp extension', () => {
    const isActive = vscode.extensions.getExtension(
      'theqtcompany.qt-cpp'
    )?.isActive;
    expect(isActive).to.be.true;
  });

  it('activates all declared extension dependencies', () => {
    const dependencies = packageJson.extensionDependencies ?? [];
    for (const extensionId of dependencies) {
      const isActive = vscode.extensions.getExtension(extensionId)?.isActive;
      expect(isActive, `Dependency not active: ${extensionId}`).to.be.true;
    }
  });
  it('registers all contributed commands', async () => {
    const vscodeCommands = await vscode.commands.getCommands(true);
    const contributed = packageJson.contributes?.commands ?? [];

    for (const { command } of contributed) {
      expect(vscodeCommands, `Missing command: ${command}`).to.include(command);
    }
  });
});
