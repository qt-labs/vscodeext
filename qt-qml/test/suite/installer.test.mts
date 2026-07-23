// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import * as vscode from 'vscode';

import * as installer from '@/installer.mjs';

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

// release.json lives one directory above the qmlls executable
// (<globalStorage>/qmlls/release.json vs <globalStorage>/qmlls/files/qmlls).
function releaseJsonPath(): string {
  return path.resolve(
    path.dirname(installer.getExpectedQmllsPath()),
    '..',
    'release.json'
  );
}

function writeInstalledReleaseJson(record: object): void {
  fs.mkdirSync(path.dirname(releaseJsonPath()), { recursive: true });
  fs.writeFileSync(releaseJsonPath(), JSON.stringify(record, null, 2));
}

// Places a file at the expected qmlls path so the "is installed" checks pass.
// The file is not a runnable executable; only tests that must reach the
// health check need provideRunnableQmllsExecutable() instead.
function provideDummyQmllsFile(): void {
  const exePath = installer.getExpectedQmllsPath();
  fs.mkdirSync(path.dirname(exePath), { recursive: true });
  fs.writeFileSync(exePath, 'not a real executable');
}

// Places a file at the expected qmlls path that exits 0 for `qmlls --help`,
// so checkStatusAgainst can reach the UpToDate verdict. Returns false when no
// suitable executable can be provided on this machine (caller should skip).
function provideRunnableQmllsExecutable(): boolean {
  const exePath = installer.getExpectedQmllsPath();
  fs.mkdirSync(path.dirname(exePath), { recursive: true });
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
    fs.copyFileSync(nodePath, exePath);
  } else {
    fs.writeFileSync(exePath, '#!/bin/sh\nexit 0\n');
  }
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
    provideDummyQmllsFile();
    writeInstalledReleaseJson({
      tag_name: '0.6',
      created_at: BASE_ASSET.created_at
    });

    const result = installer.checkStatusAgainst(makeAsset({ tag_name: '0.7' }));

    expect(result.status).to.equal(installer.AssetStatus.Outdated);
  });

  it('reports Outdated when an asset is re-uploaded under the same tag (revert)', () => {
    provideDummyQmllsFile();
    writeInstalledReleaseJson({
      tag_name: BASE_ASSET.tag_name,
      created_at: '2026-03-16T16:19:16Z'
    });

    const result = installer.checkStatusAgainst(
      makeAsset({ created_at: '2026-03-23T04:33:35Z' })
    );

    expect(result.status).to.equal(installer.AssetStatus.Outdated);
  });

  it('reports Outdated when the installed release.json predates upload tracking', () => {
    provideDummyQmllsFile();
    // Older extension versions stored only the tag.
    writeInstalledReleaseJson({ tag_name: BASE_ASSET.tag_name });

    const result = installer.checkStatusAgainst(makeAsset());

    expect(result.status).to.equal(installer.AssetStatus.Outdated);
  });

  it('recognizes an asset recorded by writeReleaseInfo as up to date', function () {
    if (!provideRunnableQmllsExecutable()) {
      this.skip();
    }
    installer.writeReleaseInfo(makeAsset());

    const result = installer.checkStatusAgainst(makeAsset());

    expect(result.status).to.equal(installer.AssetStatus.UpToDate);
  });
});
