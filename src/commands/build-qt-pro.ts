// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as qtpath from '../util/get-qt-paths';

/**
 * This file contains the implementation of the 'vscode-qt-tools.loadAndBuildQtProject' command.
 * The command is registered in the 'src/extension.ts' file and moved here for better modularity.
 */

async function gotSelectedQt(selectedQtPath: string) {
  // Get list of all .pro files in the workspace folders recursively
  qtpath.findFilesInWorkspace('**/*.pro').then((proFiles: string[]) => {
    if (proFiles.length === 0) {
      vscode.window.showWarningMessage(
        'Unable to locate Qt project .pro files. Consider using CMake build instead.'
      );
    } else {
      // Show a quick pick dialog with the .pro files as options
      vscode.window
        .showQuickPick(
          proFiles.map((uri) => {
            return uri.toString();
          }),
          { placeHolder: 'Select a .pro file to load' }
        )
        .then((selectedProFile) => {
          if (selectedProFile) {
            // Set up a configure step with the default Qt version
            const configureCommand = path.join(
              selectedQtPath || '',
              'bin',
              `qmake ${selectedProFile}`
            );

            // Create an output channel for QMake output
            const outputChannel =
              vscode.window.createOutputChannel('QMake/Build');
            outputChannel.show();

            // Execute the configure step for the selected .pro file and show the output in the output window
            const childProcess = child_process.exec(configureCommand, {
              cwd: path.dirname(selectedProFile),
              env: process.env
            });
            childProcess.on('close', (code) => {
              if (code === 0) {
                // The configure step was successful, show the output in the output window
                outputChannel.appendLine('Configure step successful.');

                // Set up a build step that works with that Qt version
                let buildCommand;
                if (process.platform === 'win32') {
                  // Use jom/mingw32-make on Windows
                  buildCommand = 'jom';
                } else {
                  // Use make on Linux/macOS
                  buildCommand = 'make';
                }
                const childProcess = child_process.exec(buildCommand, {
                  cwd: path.dirname(selectedProFile),
                  env: process.env
                });
                childProcess.on('close', (code) => {
                  if (code === 0) {
                    // The configure step was successful, show the output in the output window
                    outputChannel.appendLine('Build step successful.');
                  } else {
                    // The configure step failed, show the output in the output window
                    outputChannel.appendLine('Build step failed.');
                  }
                });
                childProcess.stdout?.on('data', (data) => {
                  outputChannel.appendLine(data);
                });
                childProcess.stderr?.on('data', (data) => {
                  outputChannel.appendLine(data);
                });
              } else {
                // The configure step failed, show the output in the output window
                outputChannel.appendLine('Configure step failed.');
              }
            });
            childProcess.stdout?.on('data', (data) => {
              outputChannel.appendLine(data);
            });
            childProcess.stderr?.on('data', (data) => {
              outputChannel.appendLine(data);
            });
          }
        });
    }
  });
}

/**
 * The 'loadAndBuildQtProject' command loads and builds a Qt project.
 * @param context - The extension context.
 * @returns The disposable for the command.
 */
async function loadAndBuildQtProject() {
  // Get the current configuration
  const config = vscode.workspace.getConfiguration('vscode-qt-tools');
  let defaultQt = config.get('defaultQt') as string;

  if (defaultQt === undefined) {
    // Call 'vscode-qt-tools.pickDefaultQt' command to ensure a default Qt version is set
    vscode.commands.executeCommand('vscode-qt-tools.pickDefaultQt').then(() => {
      // Get the current configuration
      defaultQt = config.get('defaultQt') as string;
      if (defaultQt === undefined) {
        vscode.window.showWarningMessage(
          'Unable to locate Qt. Please, use "Qt: Register Qt Installation" command to locate your Qt installation and try again.'
        );
      } else {
        gotSelectedQt(defaultQt);
      }
    });
  } else {
    gotSelectedQt(defaultQt);
  }
}

// Function to register the command
export function registerLoadAndBuildQtProjectCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.loadAndBuildQtProject',
    loadAndBuildQtProject
  );
}
