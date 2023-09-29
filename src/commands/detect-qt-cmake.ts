// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Define the command
const detectQtCMakeProjectCommand = 'vscode-qt-tools.detectQtCMakeProject';

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

// Watch for changes in the 'vscode-qt-tools.defaultQt' configuration
const registerConfigDeps = async (e: vscode.ConfigurationChangeEvent) => {
  if (e.affectsConfiguration('vscode-qt-tools.defaultQt')) {
    // Trigger the 'vscode-qt-tools.detectQtCMakeProject' command to update the 'CMAKE_PREFIX_PATH' configuration
    vscode.commands.executeCommand('vscode-qt-tools.detectQtCMakeProject');
  }
};

const registerDetectQtCMakeProject = async () => {
  // Get the current workspace
  const workspace = vscode.workspace.workspaceFolders;
  if (workspace) {
    // Check if 'CMakeLists.txt' exists in the project root
    const cmakeListsPath = path.join(workspace[0].uri.fsPath, 'CMakeLists.txt');
    if (fs.existsSync(cmakeListsPath) && fs.statSync(cmakeListsPath).isFile()) {
      // The project is a Qt project that uses CMake
      vscode.window.showInformationMessage(
        'Detected a Qt project that uses CMake.'
      );

      // Get the current configuration
      const config = vscode.workspace.getConfiguration('vscode-qt-tools');
      const qtInstallations = config.get(
        'qtInstallations'
      ) as readonly string[];
      const defaultQt = config.get('defaultQt') as string;

      // Add or modify the 'cmake.configureSettings' property to include 'CMAKE_PREFIX_PATH' with the path to the default Qt version
      if (defaultQt && qtInstallations.includes(defaultQt)) {
        // If the 'vscode-qt-tools.defaultQt' configuration changes, add its value to 'CMAKE_PREFIX_PATH'
        const cmakeConfig = vscode.workspace.getConfiguration('cmake');
        let prefixPath = cmakeConfig.get<string[]>(
          'configureSettings.CMAKE_PREFIX_PATH',
          []
        );
        if (prefixPath.length !== 0) {
          const savedCMakePath = getSavedCMakePrefixPath() as string;
          if (savedCMakePath && prefixPath.includes(savedCMakePath)) {
            prefixPath = prefixPath.filter((item) => {
              return (item as string) != savedCMakePath;
            });
          }
        }
        if (!prefixPath.includes(defaultQt)) {
          prefixPath.push(defaultQt);
        }
        cmakeConfig.update(
          'configureSettings.CMAKE_PREFIX_PATH',
          prefixPath,
          vscode.ConfigurationTarget.Workspace
        );
        setSavedCMakePrefixPath(defaultQt);
      } else {
        // If no default Qt installation is registered, ask the user to register one
        vscode.window.showInformationMessage(
          'No default Qt installation found. Please register one with the "vscode-qt-tools.registerQt" command.'
        );
      }
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
