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
  QtInfoResult,
  QtAdditionalPath,
  ConfigType
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
  private readonly _qtInfoCache = new Map<string, QtInfo>();

  public get onValueChanged() {
    return this._onValueChanged.event;
  }

  private static obtainArchs(content: string) {
    const keysToCheck = ['QT_ARCHS', 'QT_TARGET_ARCH', 'QT_ARCH'];
    for (const k of keysToCheck) {
      const match = content.match(
        new RegExp(`${k}\\s*\\=\\s*(?!.*\\$\\$)(.*)`)
      );
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  private static obtainKeyFromConfigPri(content: string, key: string) {
    const match = content.match(
      new RegExp(`${key}\\s*\\=\\s*(?!.*\\$\\$)(.*)`)
    );
    if (match) {
      return match[1];
    }
    return undefined;
  }

  private static obtainArch(content: string) {
    return CoreAPIImpl.obtainKeyFromConfigPri(content, 'QT_ARCH');
  }

  private static obtainTargetArch(content: string) {
    return CoreAPIImpl.obtainKeyFromConfigPri(content, 'QT_TARGET_ARCH');
  }

  private static obtainTargetArchs(content: string) {
    return CoreAPIImpl.obtainKeyFromConfigPri(content, 'QT_ARCHS');
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

  notify(message: QtWorkspaceConfigMessage) {
    if (message.config.size === 0) {
      throw new Error('Empty config');
    }
    this._onValueChanged.fire(message);
  }

  setValue(
    folder: vscode.WorkspaceFolder | string,
    key: string,
    value: ConfigType
  ) {
    const workspaceConfig = this._configs.get(folder);
    if (workspaceConfig) {
      workspaceConfig.set(key, value);
    } else {
      const newConfig: QtWorkspaceConfig = new Map();
      newConfig.set(key, value);
      this._configs.set(folder, newConfig);
    }
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
  // The below function is used to obtain QtInfo from the path of the qtPaths
  // executable because we don't store the full `QtAdditionalPath` object in the
  // kit configuration. So, we should be able to obtain the QtInfo from the path
  // directly. `getQtInfoFromPath` might lose some information like the name of
  // the kit, and whether it is a VCPKG kit or not.
  getQtInfoFromPath(qtPathsExe: string): QtInfoResult {
    return this.getQtInfo({ path: qtPathsExe });
  }
  getQtInfo(qtAdditionalPath: QtAdditionalPath): QtInfoResult {
    let result = this._qtInfoCache.get(qtAdditionalPath.path);
    if (result) {
      result.name = qtAdditionalPath.name;
      result.isVCPKG = qtAdditionalPath.isVCPKG;
      return { info: result };
    }

    result = new QtInfo(
      qtAdditionalPath.path,
      qtAdditionalPath.name,
      qtAdditionalPath.isVCPKG
    );
    // Querying qtpaths/qmake spawns a process that dynamically links Qt; on a
    // cold or loaded machine (e.g. CI) the first invocation can take several
    // seconds. A 1s budget was too tight and intermittently failed kit
    // registration, so allow a generous timeout.
    const queryTimeoutMs = 30000;
    let output: string;
    const retFristTry = spawnSync(qtAdditionalPath.path, ['-query'], {
      encoding: 'utf8',
      timeout: queryTimeoutMs
    });
    if (retFristTry.status === 1) {
      const retOldQtPaths = spawnSync(
        qtAdditionalPath.path,
        ['--binaries-dir'],
        {
          encoding: 'utf8',
          timeout: queryTimeoutMs
        }
      );
      if (retOldQtPaths.error) {
        return { err: retOldQtPaths.error };
      }
      if (retOldQtPaths.status !== 0) {
        return {
          err: new Error(
            `"${qtAdditionalPath.path} --binaries-dir" exited with code ${String(retOldQtPaths.status)}`
          )
        };
      }
      const outputOldQtPaths = retOldQtPaths.stdout;
      const qmakePath = path.join(outputOldQtPaths.trim(), 'qmake');
      const retQmake = spawnSync(qmakePath, ['-query'], {
        encoding: 'utf8',
        timeout: queryTimeoutMs
      });
      if (retQmake.error) {
        return { err: retQmake.error };
      }
      if (retQmake.status !== 0) {
        return {
          err: new Error(
            `"${qmakePath} -query" exited with code ${String(retQmake.status)}`
          )
        };
      }
      output = retQmake.stdout;
    } else if (retFristTry.error) {
      return { err: retFristTry.error };
    } else if (retFristTry.status !== 0) {
      return {
        err: new Error(
          `"${qtAdditionalPath.path} -query" exited with code ${String(retFristTry.status)}`
        )
      };
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
      // Architecture configurations using map to avoid code duplication
      const archConfigs = [
        {
          obtainFn: (content: string) => CoreAPIImpl.obtainArchs(content),
          resultKey: 'ARCH',
          warningMsg: `Cannot determine architecture for ${qtAdditionalPath.path}`
        },
        {
          obtainFn: (content: string) => CoreAPIImpl.obtainTargetArch(content),
          resultKey: 'QT_TARGET_ARCH',
          warningMsg: `Cannot determine target architecture for ${qtAdditionalPath.path}`
        },
        {
          obtainFn: (content: string) => CoreAPIImpl.obtainTargetArchs(content),
          resultKey: 'QT_ARCHS',
          warningMsg: `Cannot determine target architectures for ${qtAdditionalPath.path}`
        },
        {
          obtainFn: (content: string) => CoreAPIImpl.obtainArch(content),
          resultKey: 'QT_ARCH',
          warningMsg: `Cannot determine target architectures for ${qtAdditionalPath.path}`
        }
      ];

      for (const config of archConfigs) {
        const value = config.obtainFn(qconfigPriContent);
        if (value) {
          result.set(config.resultKey, value);
        } else {
          logger.warn(config.warningMsg);
        }
      }
      const msvcVersion = CoreAPIImpl.obtainMSVCVersions(qconfigPriContent);
      result.set('MSVC_MAJOR_VERSION', msvcVersion.major.toString());
      result.set('MSVC_MINOR_VERSION', msvcVersion.minor.toString());
      result.set('MSVC_PATCH_VERSION', msvcVersion.patch.toString());
    }
    this._qtInfoCache.set(qtAdditionalPath.path, result);
    return { info: result };
  }
}
