// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as qtpath from '../util/get-qt-paths';
import * as qtregister from './register-qt-path';

/**
 * This file contains the implementation of the 'vscode-qt-tools.loadAndBuildQtProject' command.
 * The command is registered in the 'src/extension.ts' file and moved here for better modularity.
 */

async function selectProFileToBuild() {
  // Get list of all .pro files in the workspace folders recursively
  const proFiles = await qtpath.findFilesInWorkspace('**/*.pro');
  if (proFiles.length === 0) {
    void vscode.window.showWarningMessage(
      'Unable to locate Qt project .pro files. Consider using CMake build instead.'
    );
    return;
  }
  // Show a quick pick dialog with the .pro files as options
  const selectedProFile = await vscode.window.showQuickPick(
    proFiles.map((uri) => {
      return uri.toString();
    }),
    { placeHolder: 'Select a .pro file to load' }
  );
  return selectedProFile;
}

async function configureQMakeBuild(selectedQtPath: string) {
  const promiseProFileToBuild = selectProFileToBuild();
  // Create an output channel for QMake output
  const outputChannel = vscode.window.createOutputChannel('QMake/Build');
  try {
    outputChannel.show();
    // Show a quick pick dialog with the .pro files as options
    const selectedProFile = await promiseProFileToBuild;
    if (!selectedProFile) {
      outputChannel.appendLine(
        'Unable to locate Qt project .pro files. Consider using CMake build instead.'
      );
      return;
    }

    // Set up a configure step with the default Qt version
    const configureCommand = path.join(
      selectedQtPath || '',
      'bin',
      `qmake ${selectedProFile}`
    );

    // Execute the configure step for the selected .pro file and show the output in the output window
    const childProcess = child_process.exec(configureCommand, {
      cwd: path.dirname(selectedProFile),
      env: process.env
    });
    childProcess.on('close', (code: number) => {
      if (code === 0) {
        // The configure step was successful, show the output in the output window
        outputChannel.appendLine('Configure step successful.');

        // Set up a build step that works with that Qt version
        let buildCommand;
        if (process.platform === 'win32') {
          buildCommand = 'jom';
        } else {
          buildCommand = 'make';
        }
        const buildProcess = child_process.exec(buildCommand, {
          cwd: path.dirname(selectedProFile),
          env: process.env
        });
        buildProcess.on('close', (code: number) => {
          if (code === 0) {
            // The build step was successful, show the output in the output window
            outputChannel.appendLine('Build step successful.');
          } else {
            // The build step failed, show the output in the output window
            outputChannel.appendLine('Build step failed.');
          }
        });
        buildProcess.stdout?.on('data', (data: string) => {
          outputChannel.appendLine(data);
        });
        buildProcess.stderr?.on('data', (data: string) => {
          outputChannel.appendLine(data);
        });
      } else {
        // The configure step failed, show the output in the output window
        outputChannel.appendLine('Configure step failed.');
      }
    });
    childProcess.stdout?.on('data', (data: string) => {
      outputChannel.appendLine(data);
    });
    childProcess.stderr?.on('data', (data: string) => {
      outputChannel.appendLine(data);
    });
  } catch (error) {
    outputChannel.appendLine(error?.toString() ?? 'An error occurred.');
  }
}

/**
 * The 'loadAndBuildQtProject' command loads and builds a Qt project.
 * @param context - The extension context.
 * @returns The disposable for the command.
 */
async function loadAndBuildQtProject() {
  // Get the current configuration
  const config = vscode.workspace.getConfiguration('vscode-qt-tools');
  let selectedQtPath = config.get('selectedQtPath') as string;
  if (selectedQtPath === undefined) {
    // Call 'vscode-qt-tools.selectQtPath' command to ensure a default Qt version is set
    await vscode.commands.executeCommand('vscode-qt-tools.selectQtPath');
    // Get the current configuration
    selectedQtPath = config.get('selectedQtPath') as string;
    if (selectedQtPath === undefined) {
      void vscode.window.showWarningMessage(
        'Unable to locate Qt. Please, use "' +
          qtregister.getRegisterQtCommandTitle() +
          '" command to locate your Qt installation and try again.'
      );
    }
  }
  if (selectedQtPath) {
    await configureQMakeBuild(selectedQtPath);
  }
}

// Function to register the command
export function registerLoadAndBuildQtProjectCommand() {
  return vscode.commands.registerCommand(
    'vscode-qt-tools.loadAndBuildQtProject',
    loadAndBuildQtProject
  );
}
