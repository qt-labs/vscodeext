// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as qtpath from '../util/get-qt-paths';
import * as qtregister from './register-qt-path';

const QMakeOutputChannel = vscode.window.createOutputChannel('QMake/Build');

function appendBuildConsole(data: string) {
  QMakeOutputChannel.appendLine(data);
}

async function selectProFileToBuild() {
  // Get list of all .pro files in the workspace folders recursively
  const proFiles = await qtpath.findFilesInWorkspace('**/*.pro');
  if (proFiles.length === 0) {
    void vscode.window.showWarningMessage(
      'Unable to locate Qt project .pro files. Consider using CMake build instead.'
    );
    return;
  }

  if (proFiles.length === 1) {
    return qtpath.IsWindows ? proFiles[0].slice(1) : proFiles[0].toString();
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
  const promisePathEnv = qtpath.envPathForQtInstallation(selectedQtPath);

  try {
    const qtRootDir = qtpath.qtRootByQtInstallation(selectedQtPath);
    const promiseJomExecutable = qtpath.locateJomExecutable(qtRootDir);

    QMakeOutputChannel.clear();
    QMakeOutputChannel.show();

    // Show a quick pick dialog with the .pro files as options
    const selectedProFile = await promiseProFileToBuild;
    if (!selectedProFile) {
      appendBuildConsole(
        'Unable to locate Qt project .pro files. Consider using CMake build instead.'
      );
      return;
    }

    // Execute the configure step for the selected .pro file and show the output in the output window
    const selectedQtBin = path.join(selectedQtPath || '', 'bin');
    const qmakeExePath =
      path.join(selectedQtBin, 'qmake') + qtpath.PlatformExecutableExtension;
    const configureCommand = qmakeExePath;

    const env = process.env;
    env.PATH = await promisePathEnv;
    const options: child_process.ExecOptions = {
      cwd: path.dirname(selectedProFile),
      env: env
    };
    const childProcess = child_process.exec(configureCommand, options);
    childProcess.stdout?.on('data', appendBuildConsole);
    childProcess.stderr?.on('data', appendBuildConsole);

    const jomExePath = await promiseJomExecutable;
    childProcess.on('close', (code: number) => {
      if (code === 0) {
        // The configure step was successful, show the output in the output window
        appendBuildConsole('Configure step successful.');

        // Set up a build step that works with that Qt version
        const buildCommand = qtpath.IsWindows ? jomExePath : 'make';
        const buildProcess = child_process.exec(buildCommand, options);
        buildProcess.on('close', (code: number) => {
          if (code === 0) {
            // The build step was successful, show the output in the output window
            appendBuildConsole('Build step successful.');
          } else {
            // The build step failed, show the output in the output window
            appendBuildConsole('Build step failed.');
          }
        });
        buildProcess.stdout?.on('data', appendBuildConsole);
        buildProcess.stderr?.on('data', appendBuildConsole);
      } else {
        // The configure step failed, show the output in the output window
        appendBuildConsole('Configure step failed.');
      }
    });
  } catch (error) {
    appendBuildConsole(error?.toString() ?? 'An error occurred.');
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
  if (!selectedQtPath) {
    // Call 'vscode-qt-tools.selectQtPath' command to ensure a default Qt version is set
    await vscode.commands.executeCommand('vscode-qt-tools.selectQtPath');
    // Get the current configuration
    selectedQtPath = config.get('selectedQtPath') as string;
    if (!selectedQtPath) {
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
