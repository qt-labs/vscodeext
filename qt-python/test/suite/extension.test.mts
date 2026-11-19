// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonExtension } from '@vscode/python-extension';
import {
  isExtensionActive,
  assertAllDependenciesAreActive,
  assertAllCommandsAreRegistered
} from 'qt-lib';
import { checkPythonSyntax } from '@/api.mjs';

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

  it('reports invalid Python syntax with the selected interpreter', async () => {
    const python = await PythonExtension.api();
    const activePath = python.environments.getActiveEnvironmentPath();
    const environment =
      await python.environments.resolveEnvironment(activePath);
    const pythonPath = environment?.executable.uri?.fsPath;
    if (!pythonPath) {
      throw new Error('Python extension has no active interpreter');
    }

    const directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'qt-python-syntax-')
    );
    const validFile = path.join(directory, 'valid.py');
    const invalidFile = path.join(directory, 'invalid.py');
    try {
      await fs.promises.writeFile(validFile, 'value = 1\n', 'utf8');
      await fs.promises.writeFile(invalidFile, 'def broken(\n', 'utf8');

      expect(
        await checkPythonSyntax(pythonPath, directory, validFile)
      ).to.equal(undefined);
      const error = await checkPythonSyntax(pythonPath, directory, invalidFile);
      expect(error).to.include('SyntaxError');
      expect(error).to.include('invalid.py');
    } finally {
      await fs.promises.rm(directory, { recursive: true, force: true });
    }
  });
});
