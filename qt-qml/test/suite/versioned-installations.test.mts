// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { activateQtQml } from '../helper.mts';
import {
  VersionedInstallations,
  ManifestFileName
} from '../../src/versioned-installations.mts';

const exeName = 'fake-exe';
const defaultCreatedAt = '2026-03-23T04:33:35Z';

describe('VersionedInstallations', () => {
  let baseDir: string;
  let installations: VersionedInstallations;

  before('activate', async () => {
    await activateQtQml();
  });

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmlls-vinst-test-'));
    installations = new VersionedInstallations(baseDir, exeName);
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  // Simulates a finished download: a staging dir containing the exe.
  function stageFakeInstall(content = 'binary-content'): string {
    const staging = installations.createStagingDir();
    fs.writeFileSync(path.join(staging, exeName), content);
    return staging;
  }

  // Installs a complete version: stage, commit, publish.
  function installVersion(
    tag: string,
    createdAt = defaultCreatedAt,
    content = 'binary-content'
  ): string {
    const version = { tag, createdAt };
    const staging = stageFakeInstall(content);
    const versionDir = installations.commitStagedInstall(staging, version);
    installations.publishCurrent(version);
    return versionDir;
  }

  describe('on a fresh machine (nothing installed)', () => {
    it('has no manifest', () => {
      expect(installations.readManifest()).to.be.undefined;
    });

    it('resolves no exe path', () => {
      expect(installations.resolveCurrentExePath()).to.be.undefined;
    });

    it('reports no installed version', () => {
      expect(
        installations.hasVersion({
          tag: 'v6.9.2',
          createdAt: defaultCreatedAt
        })
      ).to.be.false;
    });
  });

  describe('installing one version', () => {
    it('publishes the tag and upload time in the manifest', () => {
      installVersion('v6.9.2');
      const manifest = installations.readManifest();
      expect(manifest?.tag).to.equal('v6.9.2');
      expect(manifest?.createdAt).to.equal(defaultCreatedAt);
    });

    it('resolves the exe path of the installed version', () => {
      const versionDir = installVersion('v6.9.2');
      expect(installations.resolveCurrentExePath()).to.equal(
        path.join(versionDir, exeName)
      );
    });

    it('moves the staged files into the version dir', () => {
      const staging = stageFakeInstall('the-binary');
      const versionDir = installations.commitStagedInstall(staging, {
        tag: 'v6.9.2',
        createdAt: defaultCreatedAt
      });

      expect(fs.readFileSync(path.join(versionDir, exeName), 'utf8')).to.equal(
        'the-binary'
      );
      expect(fs.existsSync(staging)).to.be.false;
    });

    it('reports the version as installed', () => {
      installVersion('v6.9.2');
      expect(
        installations.hasVersion({
          tag: 'v6.9.2',
          createdAt: defaultCreatedAt
        })
      ).to.be.true;
    });
  });

  describe('updating to a newer version', () => {
    it('the manifest points to the new version', () => {
      installVersion('v6.9.1');
      installVersion('v6.9.2');
      expect(installations.readManifest()?.tag).to.equal('v6.9.2');
    });

    it('collectGarbage removes the old version and keeps the new one', () => {
      const oldDir = installVersion('v6.9.1');
      const newDir = installVersion('v6.9.2');

      const result = installations.collectGarbage();

      expect(fs.existsSync(oldDir)).to.be.false;
      expect(fs.existsSync(newDir)).to.be.true;
      expect(installations.readManifest()?.tag).to.equal('v6.9.2');
      expect(result.removed).to.include(path.basename(oldDir));
    });
  });

  describe('a build re-published under the same tag', () => {
    it('gets its own version dir and becomes current', () => {
      const oldDir = installVersion('v6.9.2', '2026-03-16T16:19:16Z');
      const newDir = installVersion('v6.9.2', '2026-03-23T04:33:35Z');

      expect(newDir).to.not.equal(oldDir);
      const manifest = installations.readManifest();
      expect(manifest?.tag).to.equal('v6.9.2');
      expect(manifest?.createdAt).to.equal('2026-03-23T04:33:35Z');
      expect(installations.resolveCurrentExePath()).to.equal(
        path.join(newDir, exeName)
      );
    });

    it('collectGarbage removes the replaced build', () => {
      const oldDir = installVersion('v6.9.2', '2026-03-16T16:19:16Z');
      const newDir = installVersion('v6.9.2', '2026-03-23T04:33:35Z');

      const result = installations.collectGarbage();

      expect(fs.existsSync(oldDir)).to.be.false;
      expect(fs.existsSync(newDir)).to.be.true;
      expect(result.removed).to.include(path.basename(oldDir));
    });
  });

  describe('two VS Code instances installing the same version', () => {
    it('the loser adopts the winner files and its staging dir is removed', () => {
      const version = { tag: 'v6.9.2', createdAt: defaultCreatedAt };
      const winnerStaging = stageFakeInstall('winner');
      const winnerDir = installations.commitStagedInstall(
        winnerStaging,
        version
      );

      const loserStaging = stageFakeInstall('loser');
      const loserDir = installations.commitStagedInstall(loserStaging, version);

      expect(loserDir).to.equal(winnerDir);
      expect(fs.readFileSync(path.join(winnerDir, exeName), 'utf8')).to.equal(
        'winner'
      );
      expect(fs.existsSync(loserStaging)).to.be.false;
    });
  });

  describe('broken states', () => {
    it('a corrupt manifest counts as not installed', () => {
      fs.writeFileSync(path.join(baseDir, ManifestFileName), '{ not json');
      expect(installations.readManifest()).to.be.undefined;
    });

    it('a manifest pointing to a deleted version resolves no exe path', () => {
      const versionDir = installVersion('v6.9.2');
      fs.rmSync(versionDir, { recursive: true, force: true });
      expect(installations.resolveCurrentExePath()).to.be.undefined;
    });

    it('a version dir without the exe does not count as installed', () => {
      const version = { tag: 'v6.9.2', createdAt: defaultCreatedAt };
      fs.mkdirSync(installations.versionDirPath(version), {
        recursive: true
      });
      expect(installations.hasVersion(version)).to.be.false;
    });
  });

  describe('migration from the old files/ + release.json layout', () => {
    function createLegacyLayout(tag: string, createdAt?: string) {
      const legacyFilesDir = path.join(baseDir, 'files');
      fs.mkdirSync(legacyFilesDir, { recursive: true });
      fs.writeFileSync(path.join(legacyFilesDir, exeName), 'legacy-binary');
      const legacyReleaseJsonPath = path.join(baseDir, 'release.json');
      fs.writeFileSync(
        legacyReleaseJsonPath,
        JSON.stringify(
          createdAt
            ? { tag_name: tag, created_at: createdAt }
            : { tag_name: tag }
        )
      );
      return { legacyFilesDir, legacyReleaseJsonPath };
    }

    it('turns the legacy install into a published version', () => {
      const { legacyFilesDir, legacyReleaseJsonPath } =
        createLegacyLayout('v6.9.1');

      const migrated = installations.migrateLegacyLayout(
        legacyFilesDir,
        legacyReleaseJsonPath
      );

      expect(migrated).to.be.true;
      expect(fs.existsSync(legacyFilesDir)).to.be.false;
      expect(fs.existsSync(legacyReleaseJsonPath)).to.be.false;
      const manifest = installations.readManifest();
      expect(manifest?.tag).to.equal('v6.9.1');
      // No recorded upload time: the next update check re-downloads once.
      expect(manifest?.createdAt).to.equal('');
      const exePath = installations.resolveCurrentExePath();
      expect(exePath).to.not.be.undefined;
      expect(fs.readFileSync(exePath ?? '', 'utf8')).to.equal('legacy-binary');
    });

    it('carries the recorded upload time into the manifest', () => {
      const { legacyFilesDir, legacyReleaseJsonPath } = createLegacyLayout(
        'v6.9.1',
        defaultCreatedAt
      );

      const migrated = installations.migrateLegacyLayout(
        legacyFilesDir,
        legacyReleaseJsonPath
      );

      expect(migrated).to.be.true;
      const manifest = installations.readManifest();
      expect(manifest?.tag).to.equal('v6.9.1');
      expect(manifest?.createdAt).to.equal(defaultCreatedAt);
    });

    it('does not migrate when a version is already installed', () => {
      installVersion('v6.9.2');
      const { legacyFilesDir, legacyReleaseJsonPath } =
        createLegacyLayout('v6.9.1');

      const migrated = installations.migrateLegacyLayout(
        legacyFilesDir,
        legacyReleaseJsonPath
      );

      expect(migrated).to.be.false;
      expect(installations.readManifest()?.tag).to.equal('v6.9.2');
      expect(fs.existsSync(legacyFilesDir)).to.be.true;
    });

    it('does nothing when there is no legacy install', () => {
      const migrated = installations.migrateLegacyLayout(
        path.join(baseDir, 'files'),
        path.join(baseDir, 'release.json')
      );
      expect(migrated).to.be.false;
      expect(installations.readManifest()).to.be.undefined;
    });
  });

  describe('other behavior', () => {
    it('tags with unsafe characters get safe dir names', () => {
      const versionDir = installVersion('feature/v6.9.2:beta');
      expect(path.dirname(versionDir)).to.equal(baseDir);
      expect(installations.readManifest()?.tag).to.equal('feature/v6.9.2:beta');
      expect(
        installations.hasVersion({
          tag: 'feature/v6.9.2:beta',
          createdAt: defaultCreatedAt
        })
      ).to.be.true;
    });

    it('publishing leaves no temporary files behind', () => {
      installVersion('v6.9.2');
      const leftovers = fs
        .readdirSync(baseDir)
        .filter(
          (name) => name.includes(ManifestFileName) && name !== ManifestFileName
        );
      expect(leftovers).to.deep.equal([]);
    });

    it('collectGarbage does nothing when the base dir does not exist', () => {
      const missing = new VersionedInstallations(
        path.join(baseDir, 'does-not-exist'),
        exeName
      );
      const result = missing.collectGarbage();
      expect(result.removed).to.deep.equal([]);
      expect(result.skipped).to.deep.equal([]);
    });
  });
});
