// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import * as vscode from 'vscode';

import { OSExeSuffix } from 'qt-lib';
import * as installer from '@/installer.mjs';
import { VersionedInstallations } from '@/versioned-installations.mjs';

const QmllsExeName = 'qmlls' + OSExeSuffix;

const BASE_ASSET: installer.AssetWithTag = {
  id: '101',
  name: 'qmllanguageserver-test-1.0.zip',
  size: 1234,
  browser_download_url: 'https://example.invalid/qmlls.zip',
  created_at: '2026-03-23T04:33:35Z',
  tag_name: '0.7'
};

function makeAsset(
  overrides: Partial<installer.AssetWithTag> = {}
): installer.AssetWithTag {
  return { ...BASE_ASSET, ...overrides };
}

// Installs a fake build into the versioned store the installer operates on
// and publishes it as current, like a finished install() would. The exe is
// not runnable; only tests that must reach the health check need
// installRunnableBuild() instead.
function installFakeBuild(
  version: installer.InstallVersion,
  content: string | Buffer = 'not a real executable'
): string {
  const installations = new VersionedInstallations(
    installer.getInstallRoot(),
    QmllsExeName
  );
  const stagingDir = installations.createStagingDir();
  fs.writeFileSync(path.join(stagingDir, QmllsExeName), content);
  const versionDir = installations.commitStagedInstall(stagingDir, version);
  installations.publishCurrent(version);
  return path.join(versionDir, QmllsExeName);
}

// Installs a fake build whose exe exits 0 for `qmlls --help`, so
// checkStatusAgainst can reach the UpToDate verdict. Returns false when no
// suitable executable can be provided on this machine (caller should skip).
function installRunnableBuild(version: installer.InstallVersion): boolean {
  let content: string | Buffer;
  if (process.platform === 'win32') {
    // A .exe must be a real binary; reuse the node.exe that runs the tests.
    const where = spawnSync('where', ['node'], { encoding: 'utf8' });
    const nodePath = where.stdout
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (where.status !== 0 || !nodePath) {
      return false;
    }
    content = fs.readFileSync(nodePath);
  } else {
    content = '#!/bin/sh\nexit 0\n';
  }
  const exePath = installFakeBuild(version, content);
  fs.chmodSync(exePath, 0o755);
  return true;
}

describe('installer: qmlls update detection', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qt-qml-installer-test-'));
    installer.initialize(vscode.Uri.file(tmpDir));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports NotInstalled when no qmlls has been installed yet', () => {
    const result = installer.checkStatusAgainst(makeAsset());

    expect(result.status).to.equal(installer.AssetStatus.NotInstalled);
  });

  it('reports Outdated when the remote tag differs from the installed one', () => {
    installFakeBuild({ tag: '0.6', createdAt: BASE_ASSET.created_at });

    const result = installer.checkStatusAgainst(makeAsset({ tag_name: '0.7' }));

    expect(result.status).to.equal(installer.AssetStatus.Outdated);
  });

  it('reports Outdated when an asset is re-uploaded under the same tag (revert)', () => {
    installFakeBuild({
      tag: BASE_ASSET.tag_name,
      createdAt: '2026-03-16T16:19:16Z'
    });

    const result = installer.checkStatusAgainst(
      makeAsset({ created_at: '2026-03-23T04:33:35Z' })
    );

    expect(result.status).to.equal(installer.AssetStatus.Outdated);
  });

  it('reports Outdated when the install predates upload-time tracking', () => {
    // Migrated legacy installs may have no recorded upload time.
    installFakeBuild({ tag: BASE_ASSET.tag_name, createdAt: '' });

    const result = installer.checkStatusAgainst(makeAsset());

    expect(result.status).to.equal(installer.AssetStatus.Outdated);
  });

  it('recognizes the published build as up to date when tag and upload time match', function () {
    if (
      !installRunnableBuild({
        tag: BASE_ASSET.tag_name,
        createdAt: BASE_ASSET.created_at
      })
    ) {
      this.skip();
    }

    const result = installer.checkStatusAgainst(makeAsset());

    expect(result.status).to.equal(installer.AssetStatus.UpToDate);
  });
});
