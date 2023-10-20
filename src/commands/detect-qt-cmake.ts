// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import * as qtpath from '../util/get-qt-paths';
import * as fs from 'fs/promises';
import * as os from 'os';

// Define the command
const detectQtCMakeProjectCommand = 'vscode-qt-tools.detectQtCMakeProject';

const CMakeToolsDir = path.join(qtpath.userLocalDir, 'CMakeTools');
// CMake CMAKE_KITS_FILEPATH var that store json config file path with CMake detected kits enumerated there
//const CMAKE_KITS_FILEPATH = path.join(CMakeToolsDir, 'cmake-tools-kits.json');
const USER_KITS_FILEPATH = path.join(CMakeToolsDir, 'Qt-CMake-toolskits.json');

const savedCMakePrefixPathKeyName = 'savedCMakePrefixPath';

type getSavedCMakePrefixPathFunctionType = () => string | undefined;
let getSavedCMakePrefixPath: getSavedCMakePrefixPathFunctionType;

type setSavedCMakePrefixPathFunctionType = (path: string) => void;
let setSavedCMakePrefixPath: setSavedCMakePrefixPathFunctionType;

function initCMakePrefixPathFunctions(context: vscode.ExtensionContext) {
  getSavedCMakePrefixPath = () =>
    context.workspaceState.get<string>(savedCMakePrefixPathKeyName);
  setSavedCMakePrefixPath = (path: string) =>
    context.workspaceState.update(savedCMakePrefixPathKeyName, path);
}

function mangleQtInstallation(installation: string): string {
  const pathParts = installation.split(/[/\\:]+/).filter((n) => n);
  const qtIdx = Math.max(
    0,
    pathParts.findIndex((s) => s.toLowerCase() == 'qt')
  );
  return pathParts.slice(qtIdx).join('-');
}

async function locateCMakeExecutableDirectoryPath(qtRootDir: string) {
  // TODO: check if cmake exists in PATH already
  return path.join(qtpath.qtToolsDir(qtRootDir), 'CMake_64', 'bin');
}

async function locateNinjaExecutableDirectoryPath(qtRootDir: string) {
  // TODO: check if ninja exists in PATH already
  return path.join(qtpath.qtToolsDir(qtRootDir), 'Ninja');
}

async function locateMingwBinDirPath(qtRootDir: string) {
  // TODO: check if g++ exists in PATH already
  const qtToolsDir = qtpath.qtToolsDir(qtRootDir);
  const items = await fs.readdir(qtToolsDir, { withFileTypes: true });
  const mingws = items.filter((item) =>
    item.name.toLowerCase().startsWith('mingw')
  );
  const promiseMingwsWithBinDirs = mingws.map((item) =>
    qtpath.pathOfDirectoryIfExists(path.join(qtToolsDir, item.name, 'bin'))
  );
  const mingwsWithBins = (await Promise.all(promiseMingwsWithBinDirs)).filter(
    Boolean
  );
  const mingw = (mingwsWithBins as string[]).reduce((a, b) => (a >= b ? a : b));
  return mingw;
}

async function locateCMakeQtToolchainFile(installation: string) {
  const libCMakePath = path.join(installation, 'lib', 'cmake');
  let cmakeQtToolchainFilePath = path.join(
    libCMakePath,
    'Qt6',
    QtToolchainCMakeFileName
  );
  try {
    await fs.access(cmakeQtToolchainFilePath);
  } catch (err) {
    cmakeQtToolchainFilePath = path.join(
      libCMakePath,
      'Qt5',
      QtToolchainCMakeFileName
    );
    try {
      await fs.access(cmakeQtToolchainFilePath);
    } catch (err) {
      cmakeQtToolchainFilePath = path.join(
        libCMakePath,
        'Qt',
        QtToolchainCMakeFileName
      );
    }
  }
  return cmakeQtToolchainFilePath;
}

const QtToolchainCMakeFileName = 'qt.toolchain.cmake';

async function cmakeKitFromInstallationPath(installation: string) {
  const promiseCmakeQtToolchainPath = locateCMakeQtToolchainFile(installation);
  const qtRootDir = path.normalize(path.join(installation, '..', '..'));
  const promiseCMakePath = locateCMakeExecutableDirectoryPath(qtRootDir);
  const promiseNinjaPath = locateNinjaExecutableDirectoryPath(qtRootDir);
  const promiseMingwPath = locateMingwBinDirPath(qtRootDir);
  const toolchain = path.basename(installation);
  const installationBinDir = path.join(installation, 'bin');
  const envSetupScript = path.join(installationBinDir, 'qtenv2.bat');
  const platformExecutableExtension = os.platform() == 'win32' ? '.exe' : '';
  const ninjaFileName = 'ninja' + platformExecutableExtension;
  const ninjaDirPath = await promiseNinjaPath;
  const ninjaExePath = path.join(ninjaDirPath, ninjaFileName);

  let newKit = {
    name: mangleQtInstallation(installation),
    environmentVariables: {
      PATH: [
        installation,
        installationBinDir,
        await promiseCMakePath,
        ninjaDirPath,
        '${env: PATH}'
      ].join(path.delimiter)
    },
    environmentSetupScript: envSetupScript,
    toolchainFile: await promiseCmakeQtToolchainPath,
    isTrusted: true,
    preferredGenerator: {
      name: 'Ninja Multi-Config'
    },
    cmakeSettings: {
      CMAKE_MAKE_PROGRAM: ninjaExePath
    }
  };
  const tokens = toolchain.split('_');
  let platform = tokens[0];
  if (platform != 'android') {
    if (platform.startsWith('msvc')) {
      platform = 'win32';
      newKit.preferredGenerator = {
        ...newKit.preferredGenerator,
        ...{
          name: 'Ninja Multi-Config'
          // toolset: 'host=x64'
        }
      };
      newKit = {
        ...newKit,
        ...{
          visualStudioArchitecture: 'x64'
        }
      };
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
              C: path.join(mingwDirPath, 'gcc' + platformExecutableExtension),
              CXX: path.join(mingwDirPath, 'g++' + platformExecutableExtension)
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

  return newKit;
}

async function updateQtKitsJsonFile() {
  const config = vscode.workspace.getConfiguration('cmake');
  const additionalKits = config.get<string[]>('additionalKits', []) || [];
  if (!additionalKits.includes(USER_KITS_FILEPATH)) {
    additionalKits.push(USER_KITS_FILEPATH);
  }
  await config.update(
    'additionalKits',
    additionalKits,
    vscode.ConfigurationTarget.Global
  );
}

async function qtInstallationsUpdated() {
  const config = vscode.workspace.getConfiguration('vscode-qt-tools');
  const qtInstallations = config.get('qtInstallations') as readonly string[];
  if (qtInstallations) {
    const kitsJsonData = await Promise.all(
      qtInstallations.map(cmakeKitFromInstallationPath)
    );
    // Write the updated kitsJsonData back to the USER_KITS_FILEPATH file
    await fs.writeFile(
      USER_KITS_FILEPATH,
      JSON.stringify(kitsJsonData, null, 2)
    );
    await updateQtKitsJsonFile();
  }
}

// Watch for changes in the 'vscode-qt-tools.selectedQtPath' configuration
async function registerConfigDeps(e: vscode.ConfigurationChangeEvent) {
  if (
    e.affectsConfiguration('vscode-qt-tools.selectedQtPath') ||
    e.affectsConfiguration('cmake.configureSettings.CMAKE_PREFIX_PATH')
  ) {
    // Trigger the 'vscode-qt-tools.detectQtCMakeProject' command to update the 'CMAKE_PREFIX_PATH' configuration
    await vscode.commands.executeCommand(
      'vscode-qt-tools.detectQtCMakeProject'
    );
  }
  if (e.affectsConfiguration('vscode-qt-tools.qtInstallations')) {
    try {
      qtInstallationsUpdated();
    } catch (err) {
      console.error('Error reading file:', err);
    }
  }
}

const registerDetectQtCMakeProject = async () => {
  // Get the current workspace
  const workspace = vscode.workspace.workspaceFolders;
  if (workspace) {
    // Check if 'CMakeLists.txt' exists in the project root
    const cmakeListsPath = path.join(workspace[0].uri.fsPath, 'CMakeLists.txt');
    await fs.access(cmakeListsPath);
    // The project is a Qt project that uses CMake
    vscode.window.showInformationMessage(
      'Detected a Qt project that uses CMake.'
    );

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
            return (item as string) != savedCMakePath;
          });
        }
      }
      if (!prefixPath.includes(selectedQtPath)) {
        prefixPath.push(selectedQtPath);
      }
      cmakeConfig.update(
        'configureSettings.CMAKE_PREFIX_PATH',
        prefixPath,
        vscode.ConfigurationTarget.Workspace
      );
      setSavedCMakePrefixPath(selectedQtPath);
    } else {
      // If no default Qt installation is registered, ask the user to register one
      vscode.window.showInformationMessage(
        'No default Qt installation found. Please register one with the "vscode-qt-tools.registerQt" command.'
      );
    }
  }
};

// Function to register the command
export function registerDetectQtCMakeProjectCommand(
  context: vscode.ExtensionContext
) {
  initCMakePrefixPathFunctions(context);

  // Register the command and return the disposable
  context.subscriptions.push(
    vscode.commands.registerCommand(
      detectQtCMakeProjectCommand,
      registerDetectQtCMakeProject
    ),
    vscode.workspace.onDidChangeConfiguration(registerConfigDeps)
  );
}
