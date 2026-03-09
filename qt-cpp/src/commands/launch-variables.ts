// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

import {
  inVCPKGRoot,
  createLogger,
  telemetry,
  findQtPathsInInstallationPath
} from 'qt-lib';
import { getFilenameWithoutExtension } from '@util/util';
import { EXTENSION_ID } from '@/constants';
import { getQtInsRoot, getSelectedKit } from '@cmd/register-qt-path';
import { coreAPI } from '@/extension';
import { Kit } from '@/kit-manager';
import { CppProjectType, getActiveProject } from '@/project';

const logger = createLogger('launch-variables');

function getDebugPathVariant(basePath: string) {
  return path.join(basePath, 'debug');
}

function replacePathWithDebugVariant(
  pathString: string,
  basePath: string,
  debugPath: string
) {
  return pathString.replace(path.normalize(basePath), debugPath);
}

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
function getQtPathsFromKit(kit: Kit) {
  let pathsExe = kit.environmentVariables?.VSCODE_QT_QTPATHS_EXE;
  // Fallback to findQtPathsInInstallationPath if VSCODE_QT_QTPATHS_EXE is not set
  if (pathsExe) {
    return pathsExe;
  }
  const insRoot = getQtInsRoot(kit);
  if (!insRoot) {
    logger.warn(
      'Cannot find VSCODE_QT_INSTALLATION or VSCODE_QT_QTPATHS_EXE in the kit'
    );
    return undefined;
  }
  pathsExe = findQtPathsInInstallationPath(insRoot);
  if (pathsExe) {
    return pathsExe;
  }
  logger.warn('Cannot find Qt Paths executable in the kit');
  return undefined;
}
function getQtDirFromQtPaths(pathsExe: string, toolchainFile?: string) {
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
    const isInVCPKG = toolchainFile?.endsWith('vcpkg.cmake');
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
              const installPrefixDebug = getDebugPathVariant(installPrefix);
              const newValue = value.replace(installPrefix, installPrefixDebug);
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
export function qtDirCommand() {
  return vscode.commands.registerCommand(`${EXTENSION_ID}.qtDir`, async () => {
    telemetry.sendAction('qtDir');
    const project = await getActiveProject();
    if (!project) {
      logger.error('Cannot find a project for the active folder');
      return undefined;
    }
    const type = project.type;
    if (type === undefined) {
      logger.error('Cannot determine the project type');
      return undefined;
    }
    const convertToBinPath = (p: string) => {
      return path.join(p, 'bin');
    };
    if (type === CppProjectType.Presets) {
      const installationPath = await project.getInstallationPathFromPreset();
      if (installationPath) {
        return convertToBinPath(installationPath);
      }
      const toolchainFile = await project.getToolchainFile();
      const qtpathsExe = await project.getQtPaths();
      if (qtpathsExe) {
        const qtDir = getQtDirFromQtPaths(qtpathsExe, toolchainFile);
        if (qtDir) {
          return qtDir;
        }
      }
    } else {
      // CppProjectType.Kit
      const kit = await getSelectedKit();
      if (!kit) {
        return undefined;
      }
      const qtpathsExe = getQtPathsFromKit(kit);
      if (!qtpathsExe) {
        return undefined;
      }
      const qtDir = getQtDirFromQtPaths(qtpathsExe, kit.toolchainFile);
      if (qtDir) {
        return qtDir;
      }
    }

    logger.error('Cannot find the binary directory of the Qt installation');
    return undefined;
  });
}

// Keep this function due to the backward compatibility
export function registerKitDirectoryCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.kitDirectory`,
    async () => {
      telemetry.sendAction('kitDirectory');
      const project = await getActiveProject();
      if (!project) {
        return undefined;
      }
      const type = project.type;
      if (type === undefined) {
        logger.error('Cannot determine the project type');
        return undefined;
      }
      if (type === CppProjectType.Presets) {
        return undefined;
      }
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

async function findQtPluginPath(qtpaths: string) {
  const info = coreAPI?.getQtInfoFromPath(qtpaths);
  if (info) {
    const buildType = await vscode.commands.executeCommand('cmake.buildType');
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
        const installPrefixDebug = getDebugPathVariant(installPrefix);
        if (pluginPath) {
          const pluginPathDebug = replacePathWithDebugVariant(
            pluginPath,
            installPrefix,
            installPrefixDebug
          );
          return pluginPathDebug;
        }
      }
    }
  }
  return undefined;
}

export function qpaPlatformPluginPathCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.QT_QPA_PLATFORM_PLUGIN_PATH`,
    async () => {
      telemetry.sendAction('QT_QPA_PLATFORM_PLUGIN_PATH');
      const project = await getActiveProject();
      if (!project) {
        logger.error('Cannot find a project for the active folder');
        return undefined;
      }
      const type = project.type;
      if (type === undefined) {
        logger.error('Cannot determine the project type');
        return undefined;
      }
      if (type === CppProjectType.Presets) {
        const qtpathsExe = await project.getQtPaths();
        if (qtpathsExe) {
          const pluginPath = await findQtPluginPath(qtpathsExe);
          if (pluginPath) {
            return pluginPath;
          }
        }
      } else {
        // CppProjectType.Kit
        const kit = await getSelectedKit();
        if (kit?.environmentVariables?.VSCODE_QT_QTPATHS_EXE) {
          if (kit.toolchainFile && inVCPKGRoot(kit.toolchainFile)) {
            const pluginPath = await findQtPluginPath(
              kit.environmentVariables.VSCODE_QT_QTPATHS_EXE
            );
            if (pluginPath) {
              return pluginPath;
            }
          }
        }
      }
      return process.env.QT_QPA_PLATFORM_PLUGIN_PATH ?? '';
    }
  );
}

function isVCPKGToolchainFile(toolchainFile: string) {
  return toolchainFile.endsWith('vcpkg.cmake');
}

async function getQmlImportPathFromQtPaths(qtpaths: string) {
  const info = coreAPI?.getQtInfoFromPath(qtpaths);
  if (!info) {
    return undefined;
  }
  const buildType = await vscode.commands.executeCommand('cmake.buildType');
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
      const installPrefixDebug = getDebugPathVariant(installPrefix);
      if (importPath) {
        const importPathDebug = replacePathWithDebugVariant(
          importPath,
          installPrefix,
          installPrefixDebug
        );
        return importPathDebug;
      }
    }
  }
  return undefined;
}
export function qmlImportPathCommand() {
  return vscode.commands.registerCommand(
    `${EXTENSION_ID}.QML_IMPORT_PATH`,
    async () => {
      telemetry.sendAction('QML_IMPORT_PATH');
      const project = await getActiveProject();
      if (!project) {
        logger.error('Cannot find a project for the active folder');
        return undefined;
      }
      const type = project.type;
      if (type === undefined) {
        logger.error('Cannot determine the project type');
        return undefined;
      }
      if (type === CppProjectType.Presets) {
        const qtpathsExe = await project.getQtPaths();
        const toolchainFile = await project.getToolchainFile();
        if (
          qtpathsExe &&
          toolchainFile &&
          isVCPKGToolchainFile(toolchainFile)
        ) {
          const importPath = await getQmlImportPathFromQtPaths(qtpathsExe);
          if (importPath) {
            return importPath;
          }
        }
      } else {
        // CppProjectType.Kit
        const qtpathsExe = await project.getQtPaths();
        const kit = await getSelectedKit();
        if (
          qtpathsExe &&
          kit?.toolchainFile &&
          isVCPKGToolchainFile(kit.toolchainFile)
        ) {
          const importPath = await getQmlImportPathFromQtPaths(qtpathsExe);
          if (importPath) {
            return importPath;
          }
        }
      }
      return process.env.QML_IMPORT_PATH ?? '';
    }
  );
}
