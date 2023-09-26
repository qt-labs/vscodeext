// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';
import * as qtpath from './util/get-qt-paths';
import { registerQtCommand } from './commands/register-qt-path';
import { registerPickDefaultQtCommand } from './commands/pick-default-qt';
import { registerDetectQtCMakeProjectCommand } from './commands/detect-qt-cmake';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vscode-qt-tools" is now active!'
  );

  // Add a new command that provides some functionality when a .pro file is opened
  const proFileDisposable = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      if (document.fileName.endsWith('.pro')) {
        // The code you place here will be executed every time a .pro file is opened
      }
    }
  );

  // Add a new command that provides some functionality when a .qrc file is opened
  const qrcFileDisposable = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      if (document.fileName.toLowerCase().endsWith('.qrc')) {
        // The code you place here will be executed every time a .qrc file is opened
        // TODO : parse the .qrc file and provide IntelliSense for the resources
        console.log('.qrc file', document.fileName);
        vscode.languages.setTextDocumentLanguage(document, 'xml');
      }
    }
  );

  // Register the 'vscode-qt-tools.pickDefaultQt' command using the imported function
  const pickDefaultQtDisposable = registerPickDefaultQtCommand();

  // Register the 'vscode-qt-tools.registerQt' command using the imported function
  const registerQtDisposable = registerQtCommand();

  // Add a new command to detect if the opened project is a Qt project that uses CMake
  const detectQtCMakeProjectDisposable = registerDetectQtCMakeProjectCommand();

  // Add a new command to load and build existing Qt projects that use QMake
  const loadAndBuildQtProjectDisposable = vscode.commands.registerCommand(
    'vscode-qt-tools.loadAndBuildQtProject',
    () => {
      function gotSelectedQt(selectedQtPath: string) {
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

      // Get the current configuration
      const config = vscode.workspace.getConfiguration('vscode-qt-tools');
      let defaultQt = config.get('defaultQt') as string;

      if (defaultQt === undefined) {
        // Call 'vscode-qt-tools.pickDefaultQt' command to ensure a default Qt version is set
        vscode.commands
          .executeCommand('vscode-qt-tools.pickDefaultQt')
          .then(() => {
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
  );

  context.subscriptions.push(
    proFileDisposable,
    qrcFileDisposable,
    pickDefaultQtDisposable,
    registerQtDisposable,
    detectQtCMakeProjectDisposable,
    loadAndBuildQtProjectDisposable
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
