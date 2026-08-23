// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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
// not runnable, which no longer matters: a committed version directory is
// complete by construction, so checkStatusAgainst does not execute it.
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

describe('installer: qmlls runnable probe', () => {
  const nodeExe = process.execPath;

  it('accepts an executable that exits zero', async () => {
    expect(
      await installer.isRunnable(nodeExe, ['-e', 'process.exit(0)'])
    ).to.equal(true);
  });

  it('rejects an executable that exits non-zero', async () => {
    expect(
      await installer.isRunnable(nodeExe, ['-e', 'process.exit(3)'])
    ).to.equal(false);
  });

  it('rejects an executable that cannot be started', async () => {
    const missing = path.join(
      os.tmpdir(),
      `qmlls-does-not-exist-${String(process.pid)}${OSExeSuffix}`
    );

    expect(await installer.isRunnable(missing)).to.equal(false);
  });

  it('accepts an executable still running when the probe expires', async () => {
    const startedAt = Date.now();

    const runnable = await installer.isRunnable(
      nodeExe,
      ['-e', 'setTimeout(() => undefined, 60000)'],
      200
    );

    expect(runnable).to.equal(true);
    expect(Date.now() - startedAt).to.be.lessThan(2000);
  });

  it('does not stall on an executable that outwrites the pipe buffer', async () => {
    const startedAt = Date.now();

    const runnable = await installer.isRunnable(
      nodeExe,
      ['-e', 'process.stdout.write("x".repeat(200000))'],
      2000
    );

    // Nothing drains the child's output, so with piped stdio the child blocks
    // once the buffer fills and only the timeout ends the probe. Finishing
    // well before it is what proves the output is discarded instead.
    expect(runnable).to.equal(true);
    expect(Date.now() - startedAt).to.be.lessThan(1500);
  });
});

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

  it('recognizes the published build as up to date when tag and upload time match', () => {
    installFakeBuild({
      tag: BASE_ASSET.tag_name,
      createdAt: BASE_ASSET.created_at
    });

    const result = installer.checkStatusAgainst(makeAsset());

    expect(result.status).to.equal(installer.AssetStatus.UpToDate);
  });
});
