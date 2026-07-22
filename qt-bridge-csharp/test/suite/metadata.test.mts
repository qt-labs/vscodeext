// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  discoverQtBridgeMetadata,
  getPersistedQtBridgeMetadataSelection,
  getQtBridgeMetadataIdentity,
  persistQtBridgeMetadataSelection
} from '@/metadata.mjs';

function normalizedPath(filePath: string | undefined) {
  return process.platform === 'win32' ? filePath?.toLowerCase() : filePath;
}

class TestMemento implements vscode.Memento {
  private readonly values = new Map<string, unknown>();

  keys(): readonly string[] {
    return [...this.values.keys()];
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.values.has(key)
      ? (this.values.get(key) as T)
      : defaultValue;
  }

  update(key: string, value: unknown): Thenable<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

describe('Qt Bridge build metadata', () => {
  let testDirectory: string;
  let projectFile: string;

  beforeEach(async () => {
    testDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'qt-bridge-csharp-metadata-')
    );
    projectFile = path.join(testDirectory, 'Application.csproj');
    await fs.promises.writeFile(projectFile, '<Project />', 'utf8');
  });

  afterEach(async () => {
    await fs.promises.rm(testDirectory, { recursive: true, force: true });
  });

  async function writeMetadata(
    configuration: string,
    options: {
      projectFile?: string;
      ready?: boolean;
      targetFramework?: string;
    } = {}
  ) {
    const metadataDirectory = path.join(testDirectory, 'obj', configuration);
    const buildDirectory = path.join(
      metadataDirectory,
      'qt',
      'native',
      'build'
    );
    const sourceDirectory = path.join(
      metadataDirectory,
      'qt',
      'native',
      'source'
    );
    const dotQtDirectory = path.join(buildDirectory, '.qt');
    await fs.promises.mkdir(dotQtDirectory, { recursive: true });
    await fs.promises.mkdir(sourceDirectory, { recursive: true });
    const readyFile = path.join(dotQtDirectory, 'qtbridge-build.ready');
    if (options.ready) {
      await fs.promises.writeFile(readyFile, '', 'utf8');
    }
    const metadataFile = path.join(metadataDirectory, 'qtbridge-qml.ide.json');
    await fs.promises.writeFile(
      metadataFile,
      JSON.stringify({
        version: 1,
        projectFile: options.projectFile ?? projectFile,
        configuration,
        targetFramework: options.targetFramework ?? 'net10.0',
        application: {
          assemblyName: 'Application',
          executableName: 'Application',
          managedOutputDir: path.join(testDirectory, 'bin', configuration),
          managedHostPath: path.join(
            testDirectory,
            'bin',
            configuration,
            'Application'
          ),
          nativeHostPath: path.join(buildDirectory, 'Application')
        },
        qml: {
          sourceDir: sourceDirectory,
          projectSourceDir: testDirectory,
          buildDirs: [buildDirectory],
          importPaths: [path.join(sourceDirectory, 'qml')],
          files: [
            {
              sourcePath: path.join(testDirectory, 'Main.qml'),
              uri: 'Application',
              typeName: 'Main',
              modulePath: 'Application/'
            }
          ]
        },
        qmlLanguageServer: {
          disableCMakeCalls: true,
          readyFile,
          buildIni: path.join(dotQtDirectory, '.qmlls.build.ini'),
          projectSourcesQrc: path.join(
            dotQtDirectory,
            'qtbridge_project_sources.qrc'
          )
        }
      }),
      'utf8'
    );
    return metadataFile;
  }

  it('selects the only valid ready candidate', async () => {
    const metadataFile = await writeMetadata('Debug', { ready: true });

    const result = await discoverQtBridgeMetadata(vscode.Uri.file(projectFile));

    expect(normalizedPath(result.metadata?.metadataFile)).to.equal(
      normalizedPath(metadataFile)
    );
    expect(result.metadata?.version).to.equal(1);
    expect(result.metadata?.qmlLanguageServer?.disableCMakeCalls).to.equal(
      true
    );
    expect(result.isReady).to.equal(true);
  });

  it('rejects metadata belonging to another project', async () => {
    await writeMetadata('Debug', {
      projectFile: path.join(testDirectory, 'Other.csproj'),
      ready: true
    });

    const result = await discoverQtBridgeMetadata(vscode.Uri.file(projectFile));

    expect(result.metadata).to.be.undefined;
    expect(result.isReady).to.equal(false);
  });

  it('keeps a previous ready selection when several candidates are ready', async () => {
    const debugMetadata = await writeMetadata('Debug', { ready: true });
    await writeMetadata('Release', { ready: true });

    const ambiguous = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile)
    );
    const selected = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile),
      { previousMetadataFile: debugMetadata }
    );

    expect(ambiguous.metadata).to.be.undefined;
    expect(ambiguous.isAmbiguous).to.equal(true);
    expect(ambiguous.candidates).to.have.length(2);
    expect(normalizedPath(selected.metadata?.metadataFile)).to.equal(
      normalizedPath(debugMetadata)
    );
    expect(selected.isReady).to.equal(true);
  });

  it('uses a persisted configuration and target-framework selection', async () => {
    await writeMetadata('Debug', { ready: true });
    await writeMetadata('Release', {
      ready: true,
      targetFramework: 'net11.0'
    });
    const initial = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile)
    );
    const release = initial.candidates.find(
      (candidate) => candidate.configuration === 'Release'
    );
    expect(release).not.to.be.undefined;
    if (!release) {
      throw new Error('Expected Release metadata');
    }
    const workspaceState = new TestMemento();
    await persistQtBridgeMetadataSelection(
      workspaceState,
      getQtBridgeMetadataIdentity(release)
    );
    const persistedSelection = getPersistedQtBridgeMetadataSelection(
      workspaceState,
      projectFile
    );
    expect(persistedSelection).not.to.be.undefined;
    if (!persistedSelection) {
      throw new Error('Expected persisted metadata selection');
    }

    const result = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile),
      { explicitSelection: persistedSelection }
    );

    expect(result.metadata?.configuration).to.equal('Release');
    expect(result.metadata?.targetFramework).to.equal('net11.0');
  });

  it('ignores a stale persisted selection', async () => {
    const debugMetadata = await writeMetadata('Debug', { ready: true });
    await writeMetadata('Release', { ready: true });

    const result = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile),
      {
        explicitSelection: {
          projectFile,
          configuration: 'Removed',
          targetFramework: 'net9.0',
          metadataFile: path.join(testDirectory, 'removed.json')
        },
        previousMetadataFile: debugMetadata
      }
    );

    expect(normalizedPath(result.metadata?.metadataFile)).to.equal(
      normalizedPath(debugMetadata)
    );
  });

  it('uses configuration and target framework requested by a build', async () => {
    const debugMetadata = await writeMetadata('Debug', { ready: true });
    await writeMetadata('Release', {
      ready: true,
      targetFramework: 'net11.0'
    });

    const result = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile),
      {
        requestedConfiguration: 'Release',
        requestedTargetFramework: 'net11.0',
        previousMetadataFile: debugMetadata
      }
    );

    expect(result.metadata?.configuration).to.equal('Release');
    expect(result.metadata?.targetFramework).to.equal('net11.0');
  });

  it('retains a sole candidate while its ready marker is absent', async () => {
    const metadataFile = await writeMetadata('Debug');

    const result = await discoverQtBridgeMetadata(vscode.Uri.file(projectFile));

    expect(normalizedPath(result.metadata?.metadataFile)).to.equal(
      normalizedPath(metadataFile)
    );
    expect(result.isReady).to.equal(false);
  });

  it('retains previously ready metadata while its marker is absent', async () => {
    const metadataFile = await writeMetadata('Debug', { ready: true });
    const previous = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile)
    );
    expect(previous.metadata).not.to.be.undefined;
    if (!previous.metadata) {
      throw new Error('Expected ready metadata');
    }
    const readyFile = previous.metadata.qmlLanguageServer?.readyFile;
    expect(readyFile).not.to.be.undefined;
    if (!readyFile) {
      throw new Error('Expected ready marker');
    }
    await fs.promises.rm(readyFile);

    const result = await discoverQtBridgeMetadata(
      vscode.Uri.file(projectFile),
      {
        previousMetadataFile: metadataFile,
        previousReadyMetadata: previous.metadata
      }
    );

    expect(result.metadata).to.equal(previous.metadata);
    expect(result.isReady).to.equal(true);
  });

  it('keeps qmlls metadata when preview-only sections are invalid', async () => {
    const metadataFile = await writeMetadata('Debug', { ready: true });
    const json = JSON.parse(
      await fs.promises.readFile(metadataFile, 'utf8')
    ) as Record<string, unknown>;
    json.application = { assemblyName: '' };
    (json.qml as Record<string, unknown>).files = 'invalid';
    await fs.promises.writeFile(metadataFile, JSON.stringify(json), 'utf8');

    const result = await discoverQtBridgeMetadata(vscode.Uri.file(projectFile));

    expect(result.metadata?.qmlLanguageServer).not.to.be.undefined;
    expect(result.metadata?.application).to.be.undefined;
    expect(result.metadata?.qml.files).to.deep.equal([]);
    expect(result.isReady).to.equal(true);
  });
});
