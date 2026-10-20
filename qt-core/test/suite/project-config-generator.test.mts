// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { expect } from 'chai';

import { generateProjectConfigs } from '../../src/project-config-generator.ts';

describe('generateProjectConfigs', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'qt-core-project-config-')
    );
  });

  afterEach(async () => {
    await fs.promises.rm(projectDir, { recursive: true, force: true });
  });

  it('writes settings and launch configurations for CMake projects', async () => {
    await fs.promises.writeFile(
      path.join(projectDir, 'CMakeLists.txt'),
      '',
      'utf8'
    );

    generateProjectConfigs(projectDir);

    expect(fs.existsSync(path.join(projectDir, '.vscode', 'settings.json'))).to
      .be.true;
    expect(fs.existsSync(path.join(projectDir, '.vscode', 'launch.json'))).to.be
      .true;
  });

  it('does not write configurations for projects without CMake', async () => {
    await fs.promises.writeFile(
      path.join(projectDir, 'Application.csproj'),
      '<Project Sdk="Microsoft.NET.Sdk" />',
      'utf8'
    );
    await fs.promises.writeFile(
      path.join(projectDir, 'Main.qml'),
      'import QtQuick\n',
      'utf8'
    );

    generateProjectConfigs(projectDir);

    expect(fs.existsSync(path.join(projectDir, '.vscode'))).to.be.false;
  });
});
