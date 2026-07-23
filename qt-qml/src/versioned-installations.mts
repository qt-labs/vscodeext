// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

import { createLogger } from 'qt-lib';

/**
 * Side-by-side versioned installation store for a downloaded executable.
 *
 * Multiple VS Code instances share the same install directory and must not
 * disturb each other. The invariants that make this safe without any
 * cross-process locks:
 *  - A version's identity is its release tag plus the asset upload time: a
 *    tag can be re-published with new assets, and such a build gets its own
 *    version directory instead of mutating the previous one.
 *  - A version directory is immutable once committed; installs are staged in
 *    a unique temp directory and atomically renamed into place. A failed
 *    rename means another instance won the race, which is not an error.
 *  - The manifest file is the single source of truth for the current version
 *    and is only ever replaced via atomic rename, so readers see either the
 *    old or the new state, never a partial write.
 *  - Garbage collection is best-effort: a version directory that cannot be
 *    removed (e.g. a running exe on Windows) is skipped and retried on a
 *    later run.
 */

const logger = createLogger('versioned-installations');

export const ManifestFileName = 'current.json';

const ManifestSchemaVersion = 1;
const StagingPrefix = '.staging-';
const ManifestTmpPrefix = `${ManifestFileName}.tmp-`;
const DefaultStagingMaxAgeMs = 24 * 60 * 60 * 1000;

export interface InstallVersion {
  tag: string;
  /**
   * Upload time of the release asset (its created_at value). Part of the
   * version identity because a tag can be re-published with new assets.
   * Empty for installs that predate upload-time tracking; they count as
   * outdated and are re-downloaded once.
   */
  createdAt: string;
}

export interface InstallManifest extends InstallVersion {
  schemaVersion: number;
  dir: string;
  installedAt: string;
}

export interface GcResult {
  removed: string[];
  skipped: string[];
}

function uniqueSuffix(): string {
  return (
    `${process.pid.toString(36)}-${Date.now().toString(36)}-` +
    Math.random().toString(36).slice(2, 10)
  );
}

function versionDirName(version: InstallVersion): string {
  // The upload time is part of the identity, so a build re-published under
  // the same tag lands in its own directory.
  const name = version.createdAt
    ? `${version.tag}-${version.createdAt}`
    : version.tag;
  const sanitized = name.replace(/[^A-Za-z0-9._-]/g, '_');
  // A leading dot would collide with the hidden staging dirs.
  return sanitized === '' || sanitized.startsWith('.')
    ? `_${sanitized}`
    : sanitized;
}

export class VersionedInstallations {
  constructor(
    readonly baseDir: string,
    readonly exeName: string
  ) {}

  get manifestPath(): string {
    return path.join(this.baseDir, ManifestFileName);
  }

  readManifest(): InstallManifest | undefined {
    let raw: string;
    try {
      raw = fs.readFileSync(this.manifestPath, 'utf8');
    } catch {
      // A missing manifest is the normal "nothing published" state.
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<InstallManifest>;
      if (
        typeof parsed.tag === 'string' &&
        parsed.tag !== '' &&
        typeof parsed.dir === 'string' &&
        parsed.dir !== ''
      ) {
        return {
          schemaVersion: parsed.schemaVersion ?? ManifestSchemaVersion,
          tag: parsed.tag,
          createdAt: parsed.createdAt ?? '',
          dir: parsed.dir,
          installedAt: parsed.installedAt ?? ''
        };
      }
      logger.warn(
        `${ManifestFileName} is missing required fields, treating as not installed: ${this.manifestPath}`
      );
    } catch {
      logger.warn(
        `${ManifestFileName} is corrupt, treating as not installed: ${this.manifestPath}`
      );
    }
    return undefined;
  }

  /**
   * Atomically publish `version` as the current one. This is the commit
   * point: until the rename lands, other instances keep seeing the previous
   * version.
   */
  publishCurrent(version: InstallVersion): void {
    const manifest: InstallManifest = {
      schemaVersion: ManifestSchemaVersion,
      tag: version.tag,
      createdAt: version.createdAt,
      dir: versionDirName(version),
      installedAt: new Date().toISOString()
    };
    fs.mkdirSync(this.baseDir, { recursive: true });
    const tmpPath = path.join(this.baseDir, ManifestTmpPrefix + uniqueSuffix());
    fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2));
    fs.renameSync(tmpPath, this.manifestPath);
    logger.info(
      `Published ${manifest.tag} as the current version (dir: ${manifest.dir})`
    );
  }

  versionDirPath(version: InstallVersion): string {
    return path.join(this.baseDir, versionDirName(version));
  }

  /**
   * Resolve the exe of the currently published version. Callers must not
   * cache the result: after another instance publishes and garbage-collects,
   * only a fresh resolution is guaranteed to point at an existing file.
   */
  resolveCurrentExePath(): string | undefined {
    const manifest = this.readManifest();
    if (!manifest) {
      return undefined;
    }
    const exePath = path.join(this.baseDir, manifest.dir, this.exeName);
    return fs.existsSync(exePath) ? exePath : undefined;
  }

  hasVersion(version: InstallVersion): boolean {
    return fs.existsSync(path.join(this.versionDirPath(version), this.exeName));
  }

  createStagingDir(): string {
    fs.mkdirSync(this.baseDir, { recursive: true });
    const stagingDir = path.join(this.baseDir, StagingPrefix + uniqueSuffix());
    fs.mkdirSync(stagingDir);
    logger.info(`Created staging dir: ${stagingDir}`);
    return stagingDir;
  }

  /**
   * Move a fully staged install into its version directory. The atomic
   * rename doubles as the cross-process lock: if it fails because another
   * instance already committed the same version, the staging dir is dropped
   * and the existing directory is used.
   */
  commitStagedInstall(stagingDir: string, version: InstallVersion): string {
    const targetDir = this.versionDirPath(version);
    try {
      fs.renameSync(stagingDir, targetDir);
      logger.info(`Committed "${stagingDir}" as "${targetDir}"`);
      return targetDir;
    } catch (renameError) {
      if (fs.existsSync(path.join(targetDir, this.exeName))) {
        logger.info(
          `${targetDir} already exists (another instance installed it), dropping staging dir`
        );
        fs.rmSync(stagingDir, { recursive: true, force: true });
        return targetDir;
      }
      // The target exists but is incomplete (a version dir is committed
      // atomically, so this means corruption): replace it.
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
        fs.renameSync(stagingDir, targetDir);
        logger.warn(`Replaced incomplete version dir: ${targetDir}`);
        return targetDir;
      } catch {
        if (fs.existsSync(path.join(targetDir, this.exeName))) {
          logger.info(
            `${targetDir} already exists (another instance installed it), dropping staging dir`
          );
          fs.rmSync(stagingDir, { recursive: true, force: true });
          return targetDir;
        }
        throw renameError;
      }
    }
  }

  /**
   * Best-effort cleanup: remove every version dir except the current one,
   * plus stale staging dirs and manifest temp files from crashed installs.
   * Removal failures (e.g. an exe still running on Windows) are skipped and
   * picked up by a later run.
   */
  collectGarbage(options?: { stagingMaxAgeMs?: number }): GcResult {
    const stagingMaxAgeMs = options?.stagingMaxAgeMs ?? DefaultStagingMaxAgeMs;
    const result: GcResult = { removed: [], skipped: [] };

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    } catch {
      return result;
    }

    const currentDirName = this.readManifest()?.dir;
    const isStale = (fullPath: string) => {
      try {
        return Date.now() - fs.statSync(fullPath).mtimeMs > stagingMaxAgeMs;
      } catch {
        return false;
      }
    };

    for (const entry of entries) {
      const fullPath = path.join(this.baseDir, entry.name);

      let shouldRemove = false;
      if (entry.isDirectory()) {
        shouldRemove = entry.name.startsWith(StagingPrefix)
          ? isStale(fullPath)
          : entry.name !== currentDirName;
      } else if (entry.name.startsWith(ManifestTmpPrefix)) {
        shouldRemove = isStale(fullPath);
      }
      if (!shouldRemove) {
        continue;
      }

      try {
        fs.rmSync(fullPath, { recursive: true });
        result.removed.push(entry.name);
      } catch {
        result.skipped.push(entry.name);
      }
    }

    return result;
  }

  /**
   * One-time migration from the pre-versioning layout (a single `files` dir
   * plus `release.json`). Renames the existing install into a version dir so
   * the user does not have to re-download. Returns true if a migration was
   * performed.
   */
  migrateLegacyLayout(
    legacyFilesDir: string,
    legacyReleaseJsonPath: string
  ): boolean {
    if (this.readManifest()) {
      return false;
    }

    let version: InstallVersion;
    try {
      const parsed = JSON.parse(
        fs.readFileSync(legacyReleaseJsonPath, 'utf8')
      ) as { tag_name?: string; created_at?: string };
      if (typeof parsed.tag_name !== 'string' || parsed.tag_name === '') {
        logger.warn(
          `Legacy ${legacyReleaseJsonPath} has no usable tag, skipping migration`
        );
        return false;
      }
      // A legacy release.json without created_at predates upload-time
      // tracking; the empty value makes the next update check re-download.
      version = { tag: parsed.tag_name, createdAt: parsed.created_at ?? '' };
    } catch {
      // A missing release.json is the normal "no legacy install" state.
      return false;
    }

    if (!fs.existsSync(path.join(legacyFilesDir, this.exeName))) {
      logger.info(`Legacy install has no ${this.exeName}, skipping migration`);
      return false;
    }

    logger.info(
      `Migrating legacy install ${legacyFilesDir} (tag ${version.tag})`
    );
    try {
      fs.renameSync(legacyFilesDir, this.versionDirPath(version));
    } catch {
      // An older extension version may be running the legacy exe (rename
      // fails on Windows then); leave the layout alone and retry later.
      if (!this.hasVersion(version)) {
        logger.warn(
          `Could not move legacy install ${legacyFilesDir}, will retry on a later activation`
        );
        return false;
      }
    }

    this.publishCurrent(version);
    try {
      fs.rmSync(legacyReleaseJsonPath, { force: true });
    } catch {
      // Best-effort; a leftover release.json is harmless.
    }
    return true;
  }
}
