// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  defaultQtRid,
  findDotNetPathEntry,
  inspectQtBridgeProject,
  QtBridgeProjectSnapshot
} from '@/project.mjs';
import { QtBridgeProjectManager } from '@/project-manager.mjs';
import type { QtBridgeQmlMetadata } from 'qt-lib';

function normalizedPath(filePath: string | undefined) {
  return process.platform === 'win32' ? filePath?.toLowerCase() : filePath;
}

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

  it('preserves PATH when dotnet is already available', async () => {
    const pathDirectory = path.join(testDirectory, 'path');
    await fs.promises.mkdir(pathDirectory);
    await fs.promises.writeFile(
      path.join(pathDirectory, 'dotnet.exe'),
      '',
      'utf8'
    );

    expect(
      findDotNetPathEntry(
        {
          PATH: pathDirectory,
          DOTNET_ROOT_X64: path.join(testDirectory, 'fallback')
        },
        'win32',
        'x64'
      )
    ).to.be.undefined;
  });

  it('uses DOTNET_HOST_PATH when PATH does not contain dotnet', async () => {
    const dotNetDirectory = path.join(testDirectory, 'host');
    const dotNetHostPath = path.join(dotNetDirectory, 'dotnet');
    await fs.promises.mkdir(dotNetDirectory);
    await fs.promises.writeFile(dotNetHostPath, '', 'utf8');

    expect(
      findDotNetPathEntry(
        {
          PATH: '',
          DOTNET_HOST_PATH: dotNetHostPath
        },
        'darwin',
        'arm64'
      )
    ).to.equal(path.resolve(dotNetDirectory));
  });

  for (const scenario of [
    {
      name: 'Windows x64',
      platform: 'win32' as NodeJS.Platform,
      architecture: 'x64',
      variable: 'DOTNET_ROOT_X64',
      executable: 'dotnet.exe'
    },
    {
      name: 'Linux x64',
      platform: 'linux' as NodeJS.Platform,
      architecture: 'x64',
      variable: 'DOTNET_ROOT_X64',
      executable: 'dotnet'
    },
    {
      name: 'macOS ARM64',
      platform: 'darwin' as NodeJS.Platform,
      architecture: 'arm64',
      variable: 'DOTNET_ROOT_ARM64',
      executable: 'dotnet'
    }
  ] as const) {
    it(`resolves ${scenario.name} architecture-specific DOTNET_ROOT`, async () => {
      const dotNetRoot = path.join(
        testDirectory,
        scenario.platform,
        scenario.architecture
      );
      await fs.promises.mkdir(dotNetRoot, { recursive: true });
      await fs.promises.writeFile(
        path.join(dotNetRoot, scenario.executable),
        '',
        'utf8'
      );

      expect(
        findDotNetPathEntry(
          {
            PATH: '',
            [scenario.variable]: dotNetRoot,
            DOTNET_ROOT: path.join(testDirectory, 'generic')
          },
          scenario.platform,
          scenario.architecture
        )
      ).to.equal(path.resolve(dotNetRoot));
    });
  }

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

  it('prepares and disposes a staged QML Preview launch', async () => {
    const projectFile = path.join(testDirectory, 'Application.csproj');
    const managedOutputDir = path.join(testDirectory, 'bin', 'Debug');
    const nativeOutputDir = path.join(testDirectory, 'obj', 'native');
    const nativeHostPath = path.join(nativeOutputDir, 'Application.exe');
    const qtDir = path.join(testDirectory, 'Qt');
    await Promise.all([
      fs.promises.mkdir(managedOutputDir, { recursive: true }),
      fs.promises.mkdir(nativeOutputDir, { recursive: true }),
      fs.promises.mkdir(path.join(qtDir, 'qml'), { recursive: true })
    ]);
    await Promise.all([
      fs.promises.writeFile(projectFile, '<Project />', 'utf8'),
      fs.promises.writeFile(
        path.join(managedOutputDir, 'Application.dll'),
        'managed',
        'utf8'
      ),
      fs.promises.writeFile(nativeHostPath, 'native', 'utf8')
    ]);

    const folder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(testDirectory),
      name: 'workspace',
      index: 0
    };
    const project = new QtBridgeProjectSnapshot(
      folder,
      {
        projectFile,
        packageId: 'QtGroup.Qt.Bridge.CSharp.win-x64',
        packageVersion: '1.0.0',
        qtDir,
        qtInstallRoot: undefined
      },
      async () => {}
    );
    const metadata: QtBridgeQmlMetadata = {
      metadataFile: path.join(testDirectory, 'obj', 'qtbridge-qml.ide.json'),
      version: 1,
      projectFile,
      configuration: 'Debug',
      targetFramework: 'net10.0',
      application: {
        assemblyName: 'Application',
        executableName: 'Application.exe',
        managedOutputDir,
        managedHostPath: path.join(managedOutputDir, 'Application.exe'),
        nativeHostPath
      },
      qml: {
        sourceDir: path.join(testDirectory, 'obj', 'native', 'source'),
        projectSourceDir: testDirectory,
        buildDirs: [path.join(testDirectory, 'obj', 'native', 'build')],
        importPaths: [path.join(testDirectory, 'imports')],
        files: []
      },
      qmlLanguageServer: undefined
    };
    project.updateMetadata(metadata, true);

    const launch = await project.prepareQmlPreview();
    expect(launch).not.to.be.undefined;
    if (!launch) {
      throw new Error('Expected a QML Preview launch');
    }

    expect(await fs.promises.readFile(launch.executable, 'utf8')).to.equal(
      'native'
    );
    expect(normalizedPath(launch.cwd)).to.equal(normalizedPath(testDirectory));
    expect(normalizedPath(launch.pathEntries[0])).to.equal(
      normalizedPath(path.join(qtDir, 'bin'))
    );
    expect(launch.environment.QML_IMPORT_PATH).to.include(launch.qmlImportRoot);
    expect(launch.environment.QML_IMPORT_PATH).to.include(
      path.join(testDirectory, 'imports')
    );

    const stagingDirectory = path.dirname(launch.executable);
    launch.dispose();
    for (let attempt = 0; attempt < 20 && fs.existsSync(stagingDirectory); ++attempt) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(fs.existsSync(stagingDirectory)).to.equal(false);
  });
});
