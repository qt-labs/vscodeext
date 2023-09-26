// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vscode-qt-tools" is now active!'
  );

  function matchesVersionPattern(path: string): boolean {
    // Check if the first character of the path is a digit (0-9)
    return /^([0-9]+\.)+/.test(path);
  }

  // Function to recursively search a directory for Qt installations
  function findQtInstallations(dir: string): string[] {
    const qtInstallations: string[] = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (matchesVersionPattern(item)) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory() && matchesVersionPattern(item)) {
          for (const subdir of fs.readdirSync(fullPath)) {
            const subdirFullPath = path.join(fullPath, subdir);
            const binPath = path.join(subdirFullPath, 'bin');
            const qtConfPath = path.join(binPath, 'qt.conf');
            if (fs.existsSync(qtConfPath) && fs.statSync(qtConfPath).isFile()) {
              qtInstallations.push(subdirFullPath);
            }
          }
        }
      }
    }
    return qtInstallations;
  }

  function findFilesInDir(
    startPath: string,
    filterExtension: string
  ): string[] {
    if (!fs.existsSync(startPath)) {
      console.log('No directory:', startPath);
      return [];
    }

    const results: string[] = [];

    function walkDir(currentPath: string): void {
      const files = fs.readdirSync(currentPath);
      for (let i = 0; i < files.length; i++) {
        const curFile = path.join(currentPath, files[i]);
        if (fs.statSync(curFile).isDirectory()) {
          walkDir(curFile);
        } else if (path.extname(curFile) === filterExtension) {
          results.push(curFile);
        }
      }
    }

    walkDir(startPath);
    return results;
  }

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

  // Add a new command to pick a default Qt installation
  const pickDefaultQtDisposable = vscode.commands.registerCommand(
    'vscode-qt-tools.pickDefaultQt',
    () => {
      // Get the current configuration
      const config = vscode.workspace.getConfiguration('vscode-qt-tools');
      const qtInstallations = config.get(
        'qtInstallations'
      ) as readonly string[];

      // Show a quick pick dialog with the Qt installations as options
      vscode.window
        .showQuickPick(qtInstallations, {
          placeHolder: 'Select a default Qt installation'
        })
        .then((selectedQt) => {
          if (selectedQt) {
            // Update the 'vscode-qt-tools.defaultQt' configuration with the selected option
            config.update(
              'defaultQt',
              selectedQt,
              vscode.ConfigurationTarget.Workspace
            );
            vscode.commands.executeCommand(
              'vscode-qt-tools.detectQtCMakeProject'
            );
          }
        });
    }
  );

  // Add a new command to register a Qt installation
  const registerQtDisposable = vscode.commands.registerCommand(
    'vscode-qt-tools.registerQt',
    () => {
      // Get the current configuration
      const config = vscode.workspace.getConfiguration('vscode-qt-tools');
      const defaultQt = config.get('defaultQt');

      // If a default Qt installation is already registered, use it
      if (defaultQt) {
        vscode.window.showInformationMessage(
          `Using default Qt installation at ${defaultQt}`
        );
      } else {
        // If no default Qt installation is registered, ask the user to register one
        vscode.window
          .showInputBox({
            prompt:
              'No default Qt installation found. Please specify the path to the Qt installation'
          })
          .then((folder: string | undefined) => {
            if (typeof folder === 'undefined') {
              return;
            }
            // Check if the OS is Unix-like
            if (process.platform === 'linux' || process.platform === 'darwin') {
              // Check if the folder path starts with '~/'
              if (folder.startsWith('~/')) {
                // Replace '~/' with the user's home directory
                folder = folder.replace('~', process.env.HOME as string);
              }
            }
            if (folder) {
              // Search the directory for Qt installations
              const qtInstallations = findQtInstallations(folder);
              vscode.window.showInformationMessage(
                `Found ${qtInstallations.length} Qt installation(s).`
              );

              // Store qtInstallations folders in the global configuration
              config.update(
                'qtInstallations',
                qtInstallations,
                vscode.ConfigurationTarget.Global
              );

              if (qtInstallations.length > 0) {
                // Call vscode-qt-tools.defaultQt to pick default Qt installation
                vscode.commands.executeCommand('vscode-qt-tools.pickDefaultQt');
              }
            }
          });
      }
    }
  );

  // Add a new command to detect if the opened project is a Qt project that uses CMake
  const detectQtCMakeProjectDisposable = vscode.commands.registerCommand(
    'vscode-qt-tools.detectQtCMakeProject',
    () => {
      // Get the current workspace
      const workspace = vscode.workspace.workspaceFolders;
      if (workspace) {
        // Check if 'CMakeLists.txt' exists in the project root
        const cmakeListsPath = path.join(
          workspace[0].uri.fsPath,
          'CMakeLists.txt'
        );
        if (
          fs.existsSync(cmakeListsPath) &&
          fs.statSync(cmakeListsPath).isFile()
        ) {
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
            const cmakeSettings = config.get('cmake.configureSettings') as {
              [key: string]: string;
            };
            cmakeSettings['CMAKE_PREFIX_PATH'] = defaultQt;
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
    }
  );

  // Add a new command to load and build existing Qt projects that use QMake
  const loadAndBuildQtProjectDisposable = vscode.commands.registerCommand(
    'vscode-qt-tools.loadAndBuildQtProject',
    () => {
      function gotSelectedQt(selectedQtPath: string) {
        // Get list of all .pro files in the workspace folders recursively
        let proFiles: string[] = [];
        for (const workspaceFolder of vscode.workspace.workspaceFolders || []) {
          proFiles = proFiles.concat(
            findFilesInDir(workspaceFolder.uri.fsPath, '.pro')
          );
        }

        // Show a quick pick dialog with the .pro files as options
        vscode.window
          .showQuickPick(proFiles, {
            placeHolder: 'Select a .pro file to load'
          })
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

      // Get the current configuration
      const config = vscode.workspace.getConfiguration('vscode-qt-tools');
      const defaultQt = config.get<string>('defaultQt');

      if (defaultQt) {
        gotSelectedQt(defaultQt);
      } else {
        // Call 'vscode-qt-tools.pickDefaultQt' command to ensure a default Qt version is set
        vscode.commands
          .executeCommand('vscode-qt-tools.pickDefaultQt')
          .then(() => {
            // Get the current configuration
            const defaultQt = config.get('defaultQt') as string;
            // Get list of all .pro files in the workspace folders recursively
            gotSelectedQt(defaultQt);
          });
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
