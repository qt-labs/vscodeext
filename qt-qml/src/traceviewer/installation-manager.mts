// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { spawn } from 'child_process';

import { IsMacOS, IsLinux, IsWindows, OSExeSuffix } from 'qt-lib';
import { fsDir } from './helpers/fs-utils.ts';
import { createWrappedLogger } from './helpers/logger-wrapper.ts';
import * as consts from './constants.mts';

interface InstallationInfo {
  recentId: string;
}

const logger = createWrappedLogger('traceviewer-installation-manager');
type Context = vscode.ExtensionContext;

export class InstallationManager {
  private _active: InstallationInfo | undefined;

  constructor(private readonly _context: Context) {
    this._load();
    this._logInfo();
  }

  get baseDir() {
    return resolveInstallBaseDir(this._context);
  }

  get activePackageId() {
    return this._active?.recentId;
  }

  get activePackageInfo() {
    return this._active
      ? new InstalledRelease(this.baseDir, this._active.recentId)
      : undefined;
  }

  public save(info: InstallationInfo) {
    logger.text('Saving install information').data('id', info.recentId).info();

    this._active = info;
    saveInstallInfo(this._context, info);
  }

  public purge() {
    if (this._active) {
      purgeOutdatedInstalls(this._context, this._active.recentId);
    }
  }

  private _load() {
    this._active = readInstallInfo(this._context);
  }

  private _logInfo() {
    const release = this.activePackageInfo;
    if (!release) {
      logger.text('No installation found').info();
      return;
    }

    logger
      .text('Current installation')
      .data('id', release.id)
      .data('base-dir', release.baseDir)
      .data('exec-file', path.relative(release.baseDir, release.execPath))
      .info({ multipleLine: true });
  }
}

export class InstalledRelease {
  constructor(
    private readonly _installBaseDir: string,
    private readonly _id: string
  ) {}

  get id() {
    return this._id;
  }

  get baseDir() {
    return path.join(this._installBaseDir, this._id);
  }

  get filesDir() {
    return path.join(this._installBaseDir, this._id, 'files');
  }

  get infoFilePath() {
    return path.join(this.baseDir, consts.RELEASE_INFO_FILE);
  }

  get execPath() {
    const subdir = findExeDir();
    if (subdir === '') {
      throw new Error('Cannot determine binary path for the current platform');
    }

    return path.join(this.filesDir, subdir, consts.EXE_NAME + OSExeSuffix);
  }

  public async save(downloadSrc: string) {
    const info = {
      id: this._id,
      version: await this._fetchVersion(),
      timestamp: new Date().toISOString(),
      downloadSrc
    };

    fs.writeFileSync(this.infoFilePath, JSON.stringify(info, null, 2));
  }

  private async _fetchVersion() {
    const execPath = this.execPath;
    const stdout = await spawnAsync(
      execPath,
      ['--version'],
      path.dirname(execPath)
    );

    // expected output: "QmlTraceViewer 19.0.82"
    const output = stdout.trim().split(' ');
    return output[1] ?? '';
  }
}

// helpers
function readInstallInfo(context: Context) {
  try {
    const basedir = resolveInstallBaseDir(context);
    const infoFile = resolveInstallInfoFilePath(context);
    const info = JSON.parse(
      fs.readFileSync(infoFile, 'utf-8')
    ) as InstallationInfo;

    if (info.recentId.length !== 0) {
      const ids = fsDir(basedir).subDirNames();
      if (ids.includes(info.recentId)) {
        const base = resolveInstallBaseDir(context);
        const release = new InstalledRelease(base, info.recentId);
        if (fs.existsSync(release.execPath)) {
          return info;
        }
      }
    }
  } catch (e) {
    void e;
  }

  return undefined;
}

function saveInstallInfo(context: Context, info: InstallationInfo) {
  fs.writeFileSync(
    resolveInstallInfoFilePath(context),
    JSON.stringify(info, null, 2)
  );
}

function purgeOutdatedInstalls(context: Context, recentId: string) {
  const baseDir = resolveInstallBaseDir(context);
  const allId = fsDir(baseDir).subDirNames();

  allId.forEach((id) => {
    if (id !== recentId) {
      logger.text('Removing outdated install').data('id', id).info();

      fsDir(baseDir, id).rm();
    }
  });
}

function resolveInstallBaseDir(context: Context) {
  return path.join(context.globalStorageUri.fsPath, consts.INSTALL_DIR_NAME);
}

function resolveInstallInfoFilePath(context: Context) {
  return path.join(resolveInstallBaseDir(context), consts.INSTALL_INFO_FILE);
}

function findExeDir() {
  if (IsMacOS) {
    return 'qmltraceviewer.app/Contents/MacOS';
  }

  if (IsLinux) {
    return 'libexec/qtcreator';
  }

  return IsWindows ? 'bin' : '';
}

async function spawnAsync(
  command: string,
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logger
          .text('Command failed')
          .data('command', `${command} ${args.join(' ')}`)
          .data('error', stderr)
          .warn({ multipleLine: true });

        reject(new Error(`Exit code: ${String(code)}`));
        return;
      }

      resolve(stdout);
    });
  });
}
