// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as vscode from 'vscode';

const packageJson = require('../../../package.json');

describe('extension', () => {
  before('activate', () =>
    vscode.extensions.getExtension('theqtcompany.qt-core')?.activate()
  );

  it('activated', async () => {
    expect(
      vscode.extensions.getExtension('theqtcompany.qt-core')?.isActive
    ).to.be.eq(true);
  });

  it('activated the dependencies', async () => {
    if (packageJson.extensionDependencies) {
      for (const extensionId of packageJson.extensionDependencies) {
        expect(vscode.extensions.getExtension(extensionId)?.isActive).to.be.eq(
          true
        );
      }
    }
  });

  it('has visible commands', async () => {
    const vscodeCommands = vscode.commands.getCommands(true);
    if (packageJson.contributes.commands) {
      // Listing qt-core commands
      for (const command of packageJson.contributes.commands) {
        let string_com: string = command.command;
        console.log(string_com);
        expect((await vscodeCommands).includes(string_com)).to.be.eq(true);
      }
    }
  });
});
