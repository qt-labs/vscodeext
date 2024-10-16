// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

import {
  CoreAPI,
  createLogger,
  QtWorkspaceConfig,
  QtWorkspaceConfigMessage,
  QtInfo,
  QtAdditionalPath
} from 'qt-lib';

const logger = createLogger('api');

interface MSVCVersion {
  major: number;
  minor: number;
  patch: number;
}
export class CoreAPIImpl implements CoreAPI {
  private readonly _configs = new Map<
    vscode.WorkspaceFolder | string,
    QtWorkspaceConfig
  >();
  private readonly _onValueChanged =
    new vscode.EventEmitter<QtWorkspaceConfigMessage>();
  private readonly _qtInfoCache = new Map<QtAdditionalPath, QtInfo>();

  public get onValueChanged() {
    return this._onValueChanged.event;
  }

  private processMessage(message: QtWorkspaceConfigMessage) {
    let changed = false;
    for (const [key, value] of message.config) {
      if (value !== this._configs.get(message.workspaceFolder)?.get(key)) {
        logger.info('Config changed:', key);
        const config = this._configs.get(message.workspaceFolder);
        if (config) {
          config.set(key, value);
        } else {
          logger.info('New config: ' + JSON.stringify(value));
          const newConfig: QtWorkspaceConfig = new Map();
          newConfig.set(key, value);
          this._configs.set(message.workspaceFolder, newConfig);
        }
        changed = true;
      }
    }
    if (changed) {
      this._onValueChanged.fire(message);
    }
  }

  private static obtainArch(content: string) {
    const keysToCheck = ['QT_ARCHS', 'QT_TARGET_ARCH', 'QT_ARCH'];
    for (const k of keysToCheck) {
      const match = content.match(new RegExp(`${k}\\s*\\=\\s*(.*)`));
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  private static getQConfigPriContent(qtInfo: QtInfo) {
    const keysToCheckForQConfigPri = [
      'QT_HOST_PATH',
      'QT_INSTALL_PREFIX',
      'QT_INSTALL_ARCHDATA',
      'QT_HOST_PREFIX',
      'QT_HOST_DATA',
      'QT_INSTALL_DATA'
    ];
    for (const key of keysToCheckForQConfigPri) {
      const p = qtInfo.get(key);
      if (!p) {
        continue;
      }
      const qconfigPriPath = path.join(p, 'mkspecs', 'qconfig.pri');
      if (fs.existsSync(qconfigPriPath)) {
        return fs.readFileSync(qconfigPriPath, 'utf8');
      }
    }

    return undefined;
  }
  private static obtainMSVCVersions(content: string): MSVCVersion {
    const ret: MSVCVersion = { major: 0, minor: 0, patch: 0 };
    const keysToCheck = [
      'QT_MSVC_MAJOR_VERSION',
      'QT_MSVC_MINOR_VERSION',
      'QT_MSVC_PATCH_VERSION'
    ];
    for (const k of keysToCheck) {
      const match = content.match(new RegExp(`${k}\\s*\\=\\s*(.*)`));
      if (match) {
        if (k === 'QT_MSVC_MAJOR_VERSION') {
          ret.major = parseInt(match[1] ?? '-1');
        } else if (k === 'QT_MSVC_MINOR_VERSION') {
          ret.minor = parseInt(match[1] ?? '-1');
        } else if (k === 'QT_MSVC_PATCH_VERSION') {
          ret.patch = parseInt(match[1] ?? '-1');
        }
      }
    }
    return ret;
  }

  update(message: QtWorkspaceConfigMessage) {
    this.processMessage(message);
  }

  getValue<T>(
    folder: vscode.WorkspaceFolder | string,
    key: string
  ): T | undefined {
    return this._configs.get(folder)?.get(key) as T;
  }

  reset() {
    this._qtInfoCache.clear();
  }

  getQtInfo(qtAdditionalPath: QtAdditionalPath): QtInfo | undefined {
    let result = this._qtInfoCache.get(qtAdditionalPath);
    if (result) {
      return result;
    }

    result = new QtInfo(qtAdditionalPath.path, qtAdditionalPath.name);
    let output: string;
    const retFristTry = spawnSync(qtAdditionalPath.path, ['-query'], {
      encoding: 'utf8',
      timeout: 1000
    });
    if (retFristTry.status === 1) {
      const retOldQtPaths = spawnSync(
        qtAdditionalPath.path,
        ['--binaries-dir'],
        {
          encoding: 'utf8',
          timeout: 1000
        }
      );
      if (retOldQtPaths.error ?? retOldQtPaths.status !== 0) {
        return undefined;
      }
      const outputOldQtPaths = retOldQtPaths.stdout;
      const qmakePath = path.join(outputOldQtPaths.trim(), 'qmake');
      const retQmake = spawnSync(qmakePath, ['-query'], {
        encoding: 'utf8',
        timeout: 1000
      });
      if (retQmake.error ?? retQmake.status !== 0) {
        return undefined;
      }
      output = retQmake.stdout;
    } else if (retFristTry.error ?? retFristTry.status !== 0) {
      return undefined;
    } else {
      output = retFristTry.stdout;
    }

    const lines = output.split('\n');
    for (const line of lines) {
      // split the line by the first `:`
      const [key, ...tempValue] = line.split(':');
      const value = tempValue.join(':');
      if (key) {
        result.set(key.trim(), value.trim());
      }
    }
    const qconfigPriContent = CoreAPIImpl.getQConfigPriContent(result);
    if (qconfigPriContent) {
      const arch = CoreAPIImpl.obtainArch(qconfigPriContent);
      if (arch) {
        result.set('ARCH', arch);
      } else {
        logger.warn(
          `Could not determine architecture for ${qtAdditionalPath.path}`
        );
      }
      const msvcVersion = CoreAPIImpl.obtainMSVCVersions(qconfigPriContent);
      result.set('MSVC_MAJOR_VERSION', msvcVersion.major.toString());
      result.set('MSVC_MINOR_VERSION', msvcVersion.minor.toString());
      result.set('MSVC_PATCH_VERSION', msvcVersion.patch.toString());
    }
    this._qtInfoCache.set(qtAdditionalPath, result);
    return result;
  }
}
