// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Define the command
const detectQtCMakeProjectCommand = 'vscode-qt-tools.detectQtCMakeProject';

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
        let cmakeSettings = config.get('cmake.configureSettings') as {
          [key: string]: string | number | boolean;
        };
        if (!cmakeSettings) {
          cmakeSettings = { CMAKE_PREFIX_PATH: defaultQt };
        } else {
          cmakeSettings['CMAKE_PREFIX_PATH'] = defaultQt;
        }
        config.update(
          'cmake.configureSettings',
          cmakeSettings,
          vscode.ConfigurationTarget.Workspace
        );
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
export function registerDetectQtCMakeProjectCommand() {
  // Register the command and return the disposable
  return vscode.commands.registerCommand(
    detectQtCMakeProjectCommand,
    registerDetectQtCMakeProject
  );
}
