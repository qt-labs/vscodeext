// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { defaultQtRid, inspectQtBridgeProject } from '@/project.mjs';
import { QtBridgeProjectManager } from '@/project-manager.mjs';

describe('Qt Bridge project discovery', () => {
  let testDirectory: string;

  beforeEach(async () => {
    testDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'qt-bridge-csharp-project-')
    );
  });

  afterEach(async () => {
    await fs.promises.rm(testDirectory, { recursive: true, force: true });
  });

  async function inspect(projectXml: string) {
    const projectFile = path.join(testDirectory, 'Application.csproj');
    await fs.promises.writeFile(projectFile, projectXml, 'utf8');
    return inspectQtBridgeProject(vscode.Uri.file(projectFile));
  }

  it('maps macOS architectures to Qt Bridge package RIDs', () => {
    expect(defaultQtRid('darwin', 'arm64')).to.equal('osx-arm64');
    expect(defaultQtRid('darwin', 'x64')).to.equal('osx-x64');
  });

  it('detects a literal package reference and explicit QtDir', async () => {
    const qtDir = path.join(testDirectory, 'Qt');
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup><QtDir>${qtDir}</QtDir></PropertyGroup>
        <ItemGroup>
          <PackageReference Include="QtGroup.Qt.Bridge.CSharp.win-x64"
            Version="1.2.3" />
        </ItemGroup>
      </Project>`);

    expect(project?.packageId).to.equal('QtGroup.Qt.Bridge.CSharp.win-x64');
    expect(project?.packageVersion).to.equal('1.2.3');
    expect(project?.qtDir).to.equal(qtDir);
  });

  it('accepts single-quoted package attributes in any order', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <ItemGroup>
          <PackageReference Version='1.2.3'
            Include='QtGroup.Qt.Bridge.CSharp.win-x64' />
        </ItemGroup>
      </Project>`);

    expect(project?.packageId).to.equal('QtGroup.Qt.Bridge.CSharp.win-x64');
    expect(project?.packageVersion).to.equal('1.2.3');
  });

  it('accepts case-insensitive package IDs and nested versions', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <ItemGroup>
          <PackageReference Include="qtgroup.qt.bridge.csharp.linux-x64">
            <Version>2.3.4</Version>
          </PackageReference>
        </ItemGroup>
      </Project>`);

    expect(project?.packageId).to.equal('qtgroup.qt.bridge.csharp.linux-x64');
    expect(project?.packageVersion).to.equal('2.3.4');
  });

  it('ignores commented Qt Bridge package references', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <ItemGroup>
          <!-- <PackageReference
            Include="QtGroup.Qt.Bridge.CSharp.win-x64" Version="1.2.3" /> -->
        </ItemGroup>
      </Project>`);

    expect(project).to.be.undefined;
  });

  it('does not treat QtDir alone as proof of a Qt Bridge project', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup>
          <QtDir>/opt/Qt</QtDir>
        </PropertyGroup>
      </Project>`);

    expect(project).to.be.undefined;
  });

  it('does not treat QtInstallRoot alone as proof of a Qt Bridge project', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup>
          <QtInstallRoot>/opt/Qt</QtInstallRoot>
        </PropertyGroup>
      </Project>`);

    expect(project).to.be.undefined;
  });

  it('resolves a templated package reference', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup>
          <QtBridgePackageId>QtGroup.Qt.Bridge.CSharp.linux-x64</QtBridgePackageId>
          <QtBridgeTemplateRid>linux-x64</QtBridgeTemplateRid>
          <BridgeVersion>2.0.0</BridgeVersion>
        </PropertyGroup>
        <ItemGroup>
          <PackageReference Include="$(QtBridgePackageId)"
            Version="$(BridgeVersion)" />
        </ItemGroup>
      </Project>`);

    expect(project?.packageId).to.equal('QtGroup.Qt.Bridge.CSharp.linux-x64');
    expect(project?.packageVersion).to.equal('2.0.0');
  });

  it('does not infer a package RID from conditional properties', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup>
          <QtBridgeTemplateArch Condition="'$(Platform)' == 'x64'">x64</QtBridgeTemplateArch>
          <QtBridgeTemplateArch Condition="'$(Platform)' == 'arm64'">arm64</QtBridgeTemplateArch>
          <QtBridgeTemplateRid Condition="$([MSBuild]::IsOSPlatform('Windows'))">win-x64</QtBridgeTemplateRid>
          <QtBridgeTemplateRid Condition="$([MSBuild]::IsOSPlatform('Linux'))">linux-$(QtBridgeTemplateArch)</QtBridgeTemplateRid>
          <QtBridgePackageId>QtGroup.Qt.Bridge.CSharp.$(QtBridgeTemplateRid)</QtBridgePackageId>
        </PropertyGroup>
        <ItemGroup>
          <PackageReference Include="$(QtBridgePackageId)" />
        </ItemGroup>
      </Project>`);

    expect(project?.packageId).to.equal(
      `QtGroup.Qt.Bridge.CSharp.${defaultQtRid()}`
    );
  });

  it('detects imported Qt Bridge targets', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <Import Project="build/Qt.Bridge.targets" />
      </Project>`);

    expect(project).not.to.be.undefined;
    expect(project?.packageId).to.be.undefined;
  });

  it('ignores unrelated C# projects', async () => {
    const project = await inspect(`
      <Project Sdk="Microsoft.NET.Sdk">
        <PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup>
      </Project>`);

    expect(project).to.be.undefined;
  });

  it('keeps multiple projects and resolves the closest containing project', async () => {
    const firstDirectory = path.join(testDirectory, 'First');
    const secondDirectory = path.join(testDirectory, 'Second');
    await fs.promises.mkdir(firstDirectory);
    await fs.promises.mkdir(secondDirectory);
    await Promise.all(
      [firstDirectory, secondDirectory].map((directory) =>
        fs.promises.writeFile(
          path.join(directory, `${path.basename(directory)}.csproj`),
          '<Project><Import Project="Qt.Bridge.targets" /></Project>',
          'utf8'
        )
      )
    );
    const folder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(testDirectory),
      name: 'workspace',
      index: 0
    };
    const manager = new QtBridgeProjectManager();

    try {
      await manager.refreshFolder(folder, false);

      expect(manager.getProjects()).to.have.length(2);
      expect(manager.getProject(folder)).to.be.undefined;
      const resolvedProject = manager.getProjectForUri(
        vscode.Uri.file(path.join(firstDirectory, 'Main.qml'))
      );
      const expectedProject = path.join(firstDirectory, 'First.csproj');
      expect(
        process.platform === 'win32'
          ? resolvedProject?.projectFile.fsPath.toLowerCase()
          : resolvedProject?.projectFile.fsPath
      ).to.equal(
        process.platform === 'win32'
          ? expectedProject.toLowerCase()
          : expectedProject
      );
    } finally {
      manager.dispose();
    }
  });
});
