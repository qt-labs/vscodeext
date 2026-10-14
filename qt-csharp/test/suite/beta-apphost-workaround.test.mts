// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// REMOVE ME together with src/beta-apphost-workaround.mts. The removal
// condition and checklist are documented in that file.
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { QtBridgeProjectSnapshot } from '@/project.mjs';
import type { QtBridgeQmlMetadata } from 'qt-lib';
import { applyBetaAppHostWorkaround } from '@/beta-apphost-workaround.mjs';

describe('Temporary beta apphost workaround (REMOVE ME)', () => {
  let testDirectory: string;
  beforeEach(async () => {
    testDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'beta-apphost-')
    );
  });
  afterEach(async () => {
    await fs.promises.rm(testDirectory, { recursive: true, force: true });
  });

  it('recovers the beta app host in staging without modifying build outputs', async () => {
    const deployedHost = path.join(testDirectory, 'deployed');
    const stagedHost = path.join(testDirectory, 'staged');
    const sdkHost = path.join(testDirectory, 'apphost');
    const template = 'QTBRIDGE_HOST_MANIFEST_V1__UNPATCHED__';
    const patched = 'binary-QTBM-patched-application';
    await fs.promises.writeFile(deployedHost, template);
    await fs.promises.writeFile(sdkHost, patched, { mode: 0o755 });
    for (let launch = 0; launch < 2; ++launch) {
      await fs.promises.copyFile(deployedHost, stagedHost);
      await applyBetaAppHostWorkaround(stagedHost, {} as QtBridgeQmlMetadata, {
        resolveHost: async () => sdkHost
      });
      expect(await fs.promises.readFile(stagedHost, 'utf8')).to.equal(patched);
    }
    expect(await fs.promises.readFile(deployedHost, 'utf8')).to.equal(template);
    expect(await fs.promises.readFile(sdkHost, 'utf8')).to.equal(patched);
  });

  it('uses a newer deployed host without querying MSBuild', async () => {
    const host = path.join(testDirectory, 'Application');
    await fs.promises.writeFile(host, 'binary-QTBM-patched');
    let queried = false;
    await applyBetaAppHostWorkaround(host, {} as QtBridgeQmlMetadata, {
      resolveHost: async () => {
        queried = true;
        throw new Error('Should not evaluate the project');
      }
    });
    expect(queried).to.equal(false);
    expect(await fs.promises.readFile(host, 'utf8')).to.equal(
      'binary-QTBM-patched'
    );
  });

  for (const contents of [
    'QTBRIDGE_HOST_MANIFEST_V1__UNPATCHED__',
    'unrelated binary'
  ]) {
    it(`rejects an invalid SDK host: ${contents}`, async () => {
      const host = path.join(testDirectory, 'Application');
      const sdkHost = path.join(testDirectory, 'apphost');
      await fs.promises.writeFile(
        host,
        'QTBRIDGE_HOST_MANIFEST_V1__UNPATCHED__'
      );
      await fs.promises.writeFile(sdkHost, contents);
      let failure: unknown;
      try {
        await applyBetaAppHostWorkaround(host, {} as QtBridgeQmlMetadata, {
          resolveHost: async () => sdkHost
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).to.be.instanceOf(Error);
      expect((failure as Error).message).to.include('QTBRIDGES-360');
      expect(await fs.promises.readFile(host, 'utf8')).to.equal(
        'QTBRIDGE_HOST_MANIFEST_V1__UNPATCHED__'
      );
    });
  }
  it('rejects an unrecoverable beta application host without launching the native template', async () => {
    const hostContents = 'QTBRIDGE_HOST_MANIFEST_V1__UNPATCHED__';
    const managedOutputDir = path.join(testDirectory, 'bin');
    const nativeHostPath = path.join(testDirectory, 'native-template');
    await fs.promises.mkdir(managedOutputDir);
    await fs.promises.writeFile(nativeHostPath, 'native template');
    await fs.promises.writeFile(
      path.join(managedOutputDir, 'Application'),
      hostContents
    );
    const projectFile = path.join(testDirectory, 'Application.csproj');
    const project = new QtBridgeProjectSnapshot(
      { uri: vscode.Uri.file(testDirectory), name: 'workspace', index: 0 },
      {
        projectFile,
        packageId: undefined,
        packageVersion: undefined,
        qtDir: undefined
      }
    );
    project.updateMetadata(
      {
        application: {
          assemblyName: 'Application',
          executableName: 'Application',
          managedOutputDir,
          nativeHostPath
        }
      } as QtBridgeQmlMetadata,
      true
    );

    let failure: unknown;
    try {
      await project.prepareQmlPreview();
    } catch (error) {
      failure = error;
    }
    expect(failure).to.be.instanceOf(Error);
    expect((failure as Error).message).to.include('QTBRIDGES-360');
    expect(await fs.promises.readFile(nativeHostPath, 'utf8')).to.equal(
      'native template'
    );
  });
});
