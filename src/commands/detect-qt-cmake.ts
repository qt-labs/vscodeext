// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as fs from 'fs/promises';

import * as vscode from 'vscode';

import * as cmake from '../util/cmake-kit-files';
import * as qtpath from '../util/get-qt-paths';

// Define the command
const DetectQtCMakeProjectCommand = 'vscode-qt-tools.detectQtCMakeProject';
const SavedCMakePrefixPathKeyName = 'savedCMakePrefixPath';

type getSavedCMakePrefixPathFunctionType = () => string | undefined;
let getSavedCMakePrefixPath: getSavedCMakePrefixPathFunctionType;

type setSavedCMakePrefixPathFunctionType = (path: string) => Thenable<void>;
let setSavedCMakePrefixPath: setSavedCMakePrefixPathFunctionType;

function initCMakePrefixPathFunctions(context: vscode.ExtensionContext) {
  getSavedCMakePrefixPath = () =>
    context.workspaceState.get<string>(SavedCMakePrefixPathKeyName);
  setSavedCMakePrefixPath = (path: string) =>
    context.workspaceState.update(SavedCMakePrefixPathKeyName, path);
}

async function* generateCMakeKitsOfQtInstallationPath(installation: string) {
  const promiseCmakeQtToolchainPath =
    qtpath.locateCMakeQtToolchainFile(installation);
  const qtRootDir = path.normalize(path.join(installation, '..', '..'));
  const cmakeDirPath = qtpath.locateCMakeExecutableDirectoryPath(qtRootDir);
  const ninjaDirPath = qtpath.locateNinjaExecutableDirectoryPath(qtRootDir);
  const promiseMingwPath = qtpath.locateMingwBinDirPath(qtRootDir);
  const toolchain = path.basename(installation);
  const installationBinDir = path.join(installation, 'bin');
  const ninjaFileName = 'ninja' + qtpath.PlatformExecutableExtension;
  const ninjaExePath = path.join(ninjaDirPath, ninjaFileName);
  const cmakePrefixPath = path.join(installation, 'lib', 'cmake');

  let newKit: cmake.Kit = {
    name: qtpath.mangleQtInstallation(installation),
    environmentVariables: {
      PATH: [
        installation,
        installationBinDir,
        ninjaDirPath,
        '${env:PATH}',
        cmakeDirPath
      ].join(path.delimiter)
    },
    toolchainFile: await promiseCmakeQtToolchainPath,
    isTrusted: true,
    preferredGenerator: {
      name: cmake.CMakeDefaultGenerator
    },
    cmakeSettings: {
      CMAKE_MAKE_PROGRAM: ninjaExePath,
      CMAKE_MODULE_PATH: cmake.cmakeCompatiblePath(cmakePrefixPath)
    }
  };
  const tokens = toolchain.split('_');
  let platform = tokens[0];
  if (platform != 'android') {
    if (platform.startsWith('msvc')) {
      newKit = {
        ...newKit,
        ...{
          visualStudio: toolchain,
          visualStudioArchitecture: tokens[-1]
        }
      };
      yield* cmake.generateMsvcKits(newKit);
      return;
    } else if (platform.startsWith('mingw')) {
      platform = 'win32';
      const mingwDirPath = await promiseMingwPath;
      if (mingwDirPath) {
        newKit.environmentVariables.PATH = [
          mingwDirPath,
          newKit.environmentVariables.PATH
        ].join(path.delimiter);
        newKit = {
          ...newKit,
          ...{
            compilers: {
              C: path.join(
                mingwDirPath,
                'gcc' + qtpath.PlatformExecutableExtension
              ),
              CXX: path.join(
                mingwDirPath,
                'g++' + qtpath.PlatformExecutableExtension
              )
            }
          }
        };
      }
    } else if (platform.startsWith('linux')) {
      platform = 'linux';
    } else if (platform.startsWith('macos')) {
      platform = 'darwin';
      newKit = {
        ...newKit,
        ...{
          compilers: {
            C: '/usr/bin/clang',
            CXX: '/usr/bin/clang++'
          }
        }
      };
    }
  }
  // newKit.preferredGenerator = {
  //   ...newKit.preferredGenerator,
  //   ...{
  //     platform: platform
  //   }
  // };

  yield newKit;
}

async function cmakeKitsFromQtInstallations(qtInstallations: string[]) {
  const kits = [];
  for (const path of qtInstallations)
    for await (const kit of generateCMakeKitsOfQtInstallationPath(path))
      kits.push(kit);
  return kits;
}

async function qtInstallationsUpdated() {
  const config = vscode.workspace.getConfiguration('vscode-qt-tools');
  const qtInstallations = config.get('qtInstallations') as string[];
  if (qtInstallations) {
    const kitsJsonData = await cmakeKitsFromQtInstallations(qtInstallations);
    // Write the updated kitsJsonData back to the USER_KITS_FILEPATH file
    await fs.writeFile(
      cmake.QT_KITS_FILEPATH,
      JSON.stringify(kitsJsonData, null, 2)
    );
    await cmake.specifyCMakeKitsJsonFileForQt();
  }
}

// Watch for changes in the 'vscode-qt-tools.selectedQtPath' configuration
async function registerConfigDeps(e: vscode.ConfigurationChangeEvent) {
  if (
    e.affectsConfiguration('vscode-qt-tools.selectedQtPath') ||
    e.affectsConfiguration('cmake.configureSettings.CMAKE_PREFIX_PATH')
  ) {
    // Trigger the 'vscode-qt-tools.detectQtCMakeProject' command to update the 'CMAKE_PREFIX_PATH' configuration
    await registerCMakeSupport();
  }
  if (e.affectsConfiguration('vscode-qt-tools.qtInstallations')) {
    try {
      void qtInstallationsUpdated();
    } catch (err) {
      console.error('Error reading file:', err);
    }
  }
}

async function registerCMakeSupport() {
  // Get the current workspace
  const workspace = vscode.workspace.workspaceFolders;
  if (workspace) {
    // Check if 'CMakeLists.txt' exists in the project root
    const cmakeListsPath = path.join(workspace[0].uri.fsPath, 'CMakeLists.txt');
    await fs.access(cmakeListsPath);

    // Get the current configuration
    const config = vscode.workspace.getConfiguration('vscode-qt-tools');
    const qtInstallations = config.get('qtInstallations') as readonly string[];
    const selectedQtPath = config.get('selectedQtPath') as string;

    // Add or modify the 'cmake.configureSettings' property to include 'CMAKE_PREFIX_PATH' with the path to the default Qt version
    if (selectedQtPath && qtInstallations.includes(selectedQtPath)) {
      // If the 'vscode-qt-tools.selectedQtPath' configuration changes, add its value to 'CMAKE_PREFIX_PATH'
      const cmakeConfig = vscode.workspace.getConfiguration('cmake');
      let prefixPath =
        cmakeConfig.get<string[]>('configureSettings.CMAKE_PREFIX_PATH', []) ||
        [];
      if (prefixPath.length !== 0) {
        const savedCMakePath = getSavedCMakePrefixPath() as string;
        if (savedCMakePath && prefixPath.includes(savedCMakePath)) {
          prefixPath = prefixPath.filter((item) => {
            return item != savedCMakePath;
          });
        }
      }
      if (!prefixPath.includes(selectedQtPath)) {
        prefixPath.push(selectedQtPath);
      }
      void cmakeConfig.update(
        'configureSettings.CMAKE_PREFIX_PATH',
        prefixPath,
        vscode.ConfigurationTarget.Workspace
      );
      void setSavedCMakePrefixPath(selectedQtPath);
    } else {
      // If no default Qt installation is registered, ask the user to register one
      void vscode.window.showInformationMessage(
        'No default Qt installation found. Please register one with the "vscode-qt-tools.registerQt" command.'
      );
    }
  }
}

// Function to register the command
export function registerDetectQtCMakeProjectCommand(
  context: vscode.ExtensionContext
) {
  initCMakePrefixPathFunctions(context);

  // Register the command and return the disposable
  context.subscriptions.push(
    vscode.commands.registerCommand(
      DetectQtCMakeProjectCommand,
      registerCMakeSupport
    ),
    vscode.workspace.onDidChangeConfiguration(registerConfigDeps),
    cmake.watchCMakeKitsFileUpdates(() => void qtInstallationsUpdated())
  );
}
