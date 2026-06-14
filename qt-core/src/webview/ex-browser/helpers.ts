// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as commandExists from 'command-exists';

import {
  createLogger,
  findQtKits,
  findQtPathsInInstallationPath,
  generateDefaultQtPathsName,
  getMsvcInfo,
  IsWindows,
  QtInfo
} from 'qt-lib';
import { coreAPI } from '@/extension';
import { GlobalStateManager } from '@/state';
import { getNewProjectBaseDir, setDefaultProjectDir } from '@/qtcli/commands';
import {
  getCurrentGlobalAdditionalQtPaths,
  getCurrentGlobalQtInstallationRoot
} from '@/installation-root';
import {
  ExNewProjectArgs,
  ExPackagePoolDir,
  ExBrowserViewConfig
} from '@/webview/shared/ex-browser';
import { fsDir } from '@/fs-utils';
import { generateProjectConfigs } from '@/project-config-generator';

type Context = vscode.ExtensionContext;

const logger = createLogger('ex-browser-helpers');

export function createViewConfig(context: Context): ExBrowserViewConfig {
  return {
    newProject: {
      name: 'untitled',
      workingDir: getNewProjectBaseDir(),
      saveProjectDir: false,
      openIn: new GlobalStateManager(context).getNewProjectOpenIn()
    }
  };
}

export function findAllPackagePools(): ExPackagePoolDir[] {
  const found: ExPackagePoolDir[] = [
    {
      sourceType: 'insRoot',
      fsPath: getCurrentGlobalQtInstallationRoot()
    }
  ];

  getCurrentGlobalAdditionalQtPaths().forEach((p) => {
    const info = coreAPI?.getQtInfoFromPath(p.path);
    if (info?.info) {
      const docs = info.info.get('QT_INSTALL_DOCS'); // .../Qt/Docs/Qt-x.y.z
      const examples = info.info.get('QT_INSTALL_EXAMPLES');
      const version = info.info.get('QT_VERSION');
      const parent = docs ? path.dirname(path.dirname(docs)) : '';

      found.push({
        sourceType: 'qtpaths',
        fsPath: parent,
        ...(docs ? { docsPath: docs } : {}),
        ...(examples ? { examplesPath: examples } : {}),
        ...(version ? { qtVersion: version } : {}),
        qtPathsExe: p.path
      });
    }
  });

  return found;
}

export function createNewProject(
  args: ExNewProjectArgs,
  projectAbsDir: string,
  projectName: string,
  qtInstallation: QtInstallationInfo | undefined
) {
  const name = args.name || projectName;
  const sourceDir = fsDir(projectAbsDir);
  const targetDir = fsDir(args.workingDir, name);

  sourceDir.copyAll(targetDir.toString());
  generateProjectConfigs(targetDir.toString());

  generateCMakePresets(targetDir.toString(), qtInstallation);

  void targetDir.openAsWorkspace({
    newWindow: args.openIn === 'newWindow'
  });
}

export async function saveNewProjectArgs(args: ExNewProjectArgs, c: Context) {
  if (args.saveProjectDir) {
    await setDefaultProjectDir(args.workingDir);
  }

  await saveOpenInArg(args.openIn, c);
}

export async function saveOpenInArg(
  value: 'addToWorkspace' | 'newWindow',
  c: Context
) {
  const globalState = new GlobalStateManager(c);
  await globalState.setNewProjectOpenIn(value);
}

export function fallbackImageDir(c: Context) {
  return vscode.Uri.joinPath(c.extensionUri, 'res', 'icons');
}

export interface QtInstallationInfo {
  name: string;
  prefixPath: string;
  toolchainFile: string | undefined;
  binDir: string;
  vendor: Record<string, string>;
}

function extractVersionFromSubDir(subDir: string): string {
  // subDir is like "Qt-6.8.0", extract "6.8.0"
  const prefix = 'Qt-';
  if (subDir.startsWith(prefix)) {
    return subDir.substring(prefix.length);
  }
  return subDir;
}

function getToolchainFile(prefixPath: string): string | undefined {
  const toolchainPath = path.join(
    prefixPath,
    'lib',
    'cmake',
    'Qt6',
    'qt.toolchain.cmake'
  );
  return fs.existsSync(toolchainPath) ? toolchainPath : undefined;
}

function resolveHostInstallation(
  qtInfo: QtInfo
): QtInstallationInfo | undefined {
  const prefixPath = qtInfo.get('QT_INSTALL_PREFIX');
  const hostPrefix = qtInfo.get('QT_HOST_PREFIX');

  // If QT_HOST_PREFIX differs from QT_INSTALL_PREFIX, this is a cross-compilation
  // target. Follow QT_HOST_PREFIX once to get the host installation.
  if (hostPrefix && prefixPath && hostPrefix !== prefixPath) {
    const hostQtPaths = findQtPathsInInstallationPath(hostPrefix);
    if (hostQtPaths) {
      const hostInfo = coreAPI?.getQtInfoFromPath(hostQtPaths).info;
      if (hostInfo) {
        const hostBinDir =
          hostInfo.get('QT_INSTALL_BINS') ?? path.join(hostPrefix, 'bin');
        return {
          name: generateDefaultQtPathsName(hostInfo),
          prefixPath: hostPrefix,
          toolchainFile: getToolchainFile(hostPrefix),
          binDir: hostBinDir,
          vendor: { VSCODE_QT_INSTALLATION: hostPrefix }
        };
      }
    }
  }

  return undefined;
}

export async function resolveQtInstallation(
  poolDir: ExPackagePoolDir,
  packageSubDir: string
): Promise<QtInstallationInfo | undefined> {
  if (poolDir.sourceType === 'qtpaths' && poolDir.qtPathsExe) {
    const info = coreAPI?.getQtInfoFromPath(poolDir.qtPathsExe);
    if (!info?.info) {
      return undefined;
    }

    const hostInstallation = resolveHostInstallation(info.info);
    if (hostInstallation) {
      return hostInstallation;
    }

    const prefixPath = info.info.get('QT_INSTALL_PREFIX');
    if (!prefixPath) {
      return undefined;
    }
    const binDir =
      info.info.get('QT_INSTALL_BINS') ?? path.join(prefixPath, 'bin');
    return {
      name: generateDefaultQtPathsName(info.info),
      prefixPath,
      toolchainFile: getToolchainFile(prefixPath),
      binDir,
      vendor: { VSCODE_QT_QTPATHS_EXE: info.info.qtPathsBin }
    };
  }

  if (poolDir.sourceType === 'insRoot' && poolDir.fsPath) {
    const targetVersion =
      poolDir.qtVersion ?? extractVersionFromSubDir(packageSubDir);
    const installations = await findQtKits(poolDir.fsPath);
    const matchingInstallations = installations.filter((installation) => {
      const relPath = path.relative(poolDir.fsPath, installation);
      const versionPart = relPath.split(path.sep)[0];
      return versionPart === targetVersion;
    });

    // On Windows, prefer MSVC installations over MinGW
    if (IsWindows) {
      matchingInstallations.sort((a, b) => {
        const aIsMsvc = path.basename(a).startsWith('msvc');
        const bIsMsvc = path.basename(b).startsWith('msvc');
        if (aIsMsvc && !bIsMsvc) {
          return -1;
        }
        if (!aIsMsvc && bIsMsvc) {
          return 1;
        }
        return 0;
      });
    }

    for (const installation of matchingInstallations) {
      const qtPaths = findQtPathsInInstallationPath(installation);
      const qtInfo = qtPaths
        ? coreAPI?.getQtInfoFromPath(qtPaths).info
        : undefined;

      if (qtInfo) {
        const hostInstallation = resolveHostInstallation(qtInfo);
        if (hostInstallation) {
          return hostInstallation;
        }
      }

      const name = qtInfo
        ? generateDefaultQtPathsName(qtInfo)
        : path.basename(installation);
      return {
        name,
        prefixPath: installation,
        toolchainFile: getToolchainFile(installation),
        binDir: path.join(installation, 'bin'),
        vendor: { VSCODE_QT_INSTALLATION: installation }
      };
    }
  }

  return undefined;
}

function generateCMakePresets(
  projectDir: string,
  qtInfo: QtInstallationInfo | undefined
) {
  if (!qtInfo) {
    logger.warn(
      'No Qt installation info, skipping CMakePresets.json generation'
    );
    return;
  }

  const presetsPath = path.join(projectDir, 'CMakePresets.json');
  if (fs.existsSync(presetsPath)) {
    logger.info('CMakePresets.json already exists, skipping generation');
    return;
  }

  const commonCacheVariables: Record<string, string> = {
    CMAKE_EXPORT_COMPILE_COMMANDS: 'ON',
    QT_QML_GENERATE_QMLLS_INI: 'ON',
    CMAKE_CXX_FLAGS_DEBUG_INIT: '-DQT_QML_DEBUG -DQT_DECLARATIVE_DEBUG',
    CMAKE_CXX_FLAGS_RELWITHDEBINFO_INIT: '-DQT_QML_DEBUG -DQT_DECLARATIVE_DEBUG'
  };

  if (qtInfo.toolchainFile) {
    commonCacheVariables.CMAKE_TOOLCHAIN_FILE = qtInfo.toolchainFile;
  } else {
    commonCacheVariables.CMAKE_PREFIX_PATH = qtInfo.prefixPath;
  }

  const commonFields: Record<string, unknown> = {
    environment: {
      PATH: `${qtInfo.binDir};$penv{PATH}`
    },
    vendor: {
      'qt-cpp': qtInfo.vendor
    }
  };

  const msvcInfo = IsWindows ? getMsvcInfo(qtInfo.prefixPath) : undefined;

  const insName = qtInfo.name;

  if (msvcInfo) {
    commonFields.generator = msvcInfo.vsGenerator;
    commonFields.architecture = {
      value: msvcInfo.arch,
      strategy: 'set'
    };

    // VS generator is multi-config: one configure preset, build presets
    // select the configuration
    const presets = {
      version: 3,
      configurePresets: [
        {
          name: insName,
          displayName: insName,
          binaryDir: `\${sourceDir}/builds/${insName}`,
          cacheVariables: {
            ...commonCacheVariables
          },
          ...commonFields
        }
      ],
      buildPresets: [
        {
          name: `${insName}-debug`,
          displayName: `${insName} Debug`,
          configurePreset: insName,
          configuration: 'Debug'
        },
        {
          name: `${insName}-relwithdebinfo`,
          displayName: `${insName} RelWithDebInfo`,
          configurePreset: insName,
          configuration: 'RelWithDebInfo'
        },
        {
          name: `${insName}-release`,
          displayName: `${insName} Release`,
          configurePreset: insName,
          configuration: 'Release'
        }
      ]
    };

    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2), 'utf-8');
  } else {
    if (commandExists.sync('ninja')) {
      commonFields.generator = 'Ninja';
    }

    // Single-config generators: separate configure presets per build type
    const configureTypes = [
      {
        name: `${insName}-debug`,
        displayName: `${insName} Debug`,
        buildType: 'Debug'
      },
      {
        name: `${insName}-relwithdebinfo`,
        displayName: `${insName} RelWithDebInfo`,
        buildType: 'RelWithDebInfo'
      },
      {
        name: `${insName}-release`,
        displayName: `${insName} Release`,
        buildType: 'Release'
      }
    ];

    const presets = {
      version: 3,
      configurePresets: configureTypes.map((ct) => ({
        name: ct.name,
        displayName: ct.displayName,
        binaryDir: `\${sourceDir}/builds/${insName}/${ct.buildType.toLowerCase()}`,
        cacheVariables: {
          CMAKE_BUILD_TYPE: ct.buildType,
          ...commonCacheVariables
        },
        ...commonFields
      }))
    };

    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2), 'utf-8');
  }
  logger.info(
    `Generated CMakePresets.json with toolchain: ${qtInfo.toolchainFile ?? 'none'}, prefix: ${qtInfo.prefixPath}`
  );
}
