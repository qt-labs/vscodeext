// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import { inVCPKGRoot, createLogger, telemetry } from 'qt-lib';
import { getFilenameWithoutExtension } from '@util/util';
import { EXTENSION_ID } from '@/constants';
import { getQtInsRoot, getSelectedKit } from '@cmd/register-qt-path';
import { coreAPI } from '@/extension';

const logger = createLogger('launch-variables');

export function registerlaunchTargetFilenameWithoutExtension() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.launchTargetFilenameWithoutExtension`,
    async () => {
      telemetry.sendAction('launchTargetFilenameWithoutExtension');
      const launchTargetFilename = await vscode.commands.executeCommand<string>(
        'cmake.launchTargetFilename'
      );
      if (!launchTargetFilename) {
        return '';
      }
      return getFilenameWithoutExtension(launchTargetFilename);
    }
  );
}

export function registerbuildDirectoryName() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.buildDirectoryName`,
    async () => {
      telemetry.sendAction('buildDirectoryName');
      const activeFolder = await vscode.commands.executeCommand<string>(
        'cmake.activeFolderPath'
      );
      const buildDirectory = await vscode.commands.executeCommand<string>(
        'cmake.buildDirectory',
        activeFolder
      );
      return path.basename(buildDirectory);
    }
  );
}

export function qtDirCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.qtDir`, async () => {
    telemetry.sendAction('qtDir');
    const kit = await getSelectedKit();
    if (!kit) {
      return undefined;
    }
    const insRoot = getQtInsRoot(kit);
    if (insRoot) {
      return path.join(insRoot, 'bin');
    }
    const pathsExe = kit.environmentVariables?.VSCODE_QT_QTPATHS_EXE;
    if (pathsExe) {
      const isValidKey = (key: string) => {
        const keysShouldStartWith = ['QT_INSTALL', 'QT_HOST'];
        for (const k of keysShouldStartWith) {
          if (key.startsWith(k)) {
            return true;
          }
        }
        return false;
      };
      const info = coreAPI?.getQtInfoFromPath(pathsExe);
      const paths: string[] = [];
      if (info) {
        const keys = info.data;
        const isInVCPKG = kit.toolchainFile && inVCPKGRoot(kit.toolchainFile);
        for (const [key, value] of keys) {
          if (!isValidKey(key)) {
            continue;
          }
          if (value) {
            paths.push(value);
            // vcpkg spacial case
            if (isInVCPKG) {
              if (value.endsWith('bin')) {
                const installPrefix = info.get('QT_INSTALL_PREFIX');
                if (installPrefix) {
                  const installPrefixDebug = path.join(installPrefix, 'debug');
                  const newValue = value.replace(
                    installPrefix,
                    installPrefixDebug
                  );
                  paths.push(newValue);
                }
              }
            }
          }
        }
      }
      const ret = paths.join(path.delimiter);
      return ret;
    }
    logger.error('Cannot find the selected Qt installation path');
    return undefined;
  });
}

// Keep this function due to the backward compatibility
export function registerKitDirectoryCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.kitDirectory`,
    async () => {
      telemetry.sendAction('kitDirectory');
      const kit = await getSelectedKit();
      if (!kit) {
        return undefined;
      }
      const insRoot = getQtInsRoot(kit);
      if (insRoot) {
        return insRoot;
      }
      const message = `Cannot find VSCODE_QT_FOLDER in the selected kit: ${kit.name}`;
      void vscode.window.showErrorMessage(message);
      return undefined;
    }
  );
}

export function qpaPlatformPluginPathCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.QT_QPA_PLATFORM_PLUGIN_PATH`,
    async () => {
      telemetry.sendAction('QT_QPA_PLATFORM_PLUGIN_PATH');
      const kit = await getSelectedKit();
      if (kit?.environmentVariables?.VSCODE_QT_QTPATHS_EXE) {
        if (kit.toolchainFile && inVCPKGRoot(kit.toolchainFile)) {
          const info = coreAPI?.getQtInfoFromPath(
            kit.environmentVariables.VSCODE_QT_QTPATHS_EXE
          );
          if (info) {
            const buildType =
              await vscode.commands.executeCommand('cmake.buildType');
            let pluginPath = info.get('QT_INSTALL_PLUGINS');
            if (pluginPath) {
              pluginPath = path.join(pluginPath, 'platforms');
              if (buildType !== 'Debug') {
                return pluginPath;
              }
              // If code reaches here, it means that the build type is Debug and
              // we need to return the debug version of the plugin path
              const installPrefix = info.get('QT_INSTALL_PREFIX');
              if (installPrefix) {
                const installPrefixDebug = path.join(installPrefix, 'debug');
                if (pluginPath) {
                  const pluginPathDebug = pluginPath.replace(
                    path.normalize(installPrefix),
                    installPrefixDebug
                  );
                  return pluginPathDebug;
                }
              }
            }
          }
        }
      }
      return process.env.QT_QPA_PLATFORM_PLUGIN_PATH ?? '';
    }
  );
}

export function qmlImportPathCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.QML_IMPORT_PATH`,
    async () => {
      telemetry.sendAction('QML_IMPORT_PATH');
      const kit = await getSelectedKit();
      if (kit?.environmentVariables?.VSCODE_QT_QTPATHS_EXE) {
        if (kit.toolchainFile && inVCPKGRoot(kit.toolchainFile)) {
          const info = coreAPI?.getQtInfoFromPath(
            kit.environmentVariables.VSCODE_QT_QTPATHS_EXE
          );
          if (info) {
            const buildType =
              await vscode.commands.executeCommand('cmake.buildType');
            let importPath = info.get('QT_INSTALL_QML');
            if (importPath) {
              importPath = path.normalize(importPath);
              if (buildType !== 'Debug') {
                return importPath;
              }
              // If code reaches here, it means that the build type is Debug and
              // we need to return the debug version of the import path
              const installPrefix = info.get('QT_INSTALL_PREFIX');
              if (installPrefix) {
                const installPrefixDebug = path.join(installPrefix, 'debug');
                if (importPath) {
                  const importPathDebug = importPath.replace(
                    path.normalize(installPrefix),
                    installPrefixDebug
                  );
                  return importPathDebug;
                }
              }
            }
          }
        }
      }
      return process.env.QML_IMPORT_PATH ?? '';
    }
  );
}
