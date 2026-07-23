// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import * as commandExists from 'command-exists';
import * as vscode from 'vscode';

import {
  CoreKey,
  createLogger,
  OSExeSuffix,
  QtInsRootConfigName,
  compareVersions
} from 'qt-lib';
import { PySideEnv } from './env.mjs';
import { PySideProject } from './project.mjs';
import {
  PySideCommandRunner,
  PySideCommandRunOptions as RunOptions
} from './runner.mjs';
import { coreApi, projectManager, pyApi } from './extension.mjs';
import { normalizeDriveLetter } from './utils.js';
import * as texts from './texts.js';
import * as consts from './constants.js';

const logger = createLogger('installer');

interface TargetProjectItem extends vscode.QuickPickItem {
  project: PySideProject;
}

interface InstallSourceItem extends vscode.QuickPickItem {
  source?: 'oss' | 'commercial' | 'local' | 'download';
  env?: PySideEnv;
  localPath?: string;
}

interface CheckResult {
  status: 'noVenv' | 'noPySide' | 'alreadyInstalled';
  folder: vscode.WorkspaceFolder;
  env?: PySideEnv;
  pysideVersion?: string;
}

export async function onInstallPySide6Command() {
  const selected = await selectTargetProject();
  if (!selected) {
    return;
  }

  info(selected.folder, 'Check installation status');
  const result = await checkInstallation(selected);

  info(
    selected.folder,
    'Check installation status: ',
    `result = ${result.status}, `,
    `version = ${result.pysideVersion ?? ''}`
  );

  void showMessageOrInstall(result);
}

async function selectTargetProject() {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length <= 1) {
    return folders[0] && projectManager.getProject(folders[0]);
  }

  const items = folders
    .map((folder) => {
      const project = projectManager.getProject(folder);
      if (!project) {
        return undefined;
      }

      return {
        label: folder.name,
        description: folder.uri.fsPath,
        project
      } as TargetProjectItem;
    })
    .filter((item) => item !== undefined);

  const placeHolder = texts.install.placeHolder.selectFolder;
  const selected = await vscode.window.showQuickPick(items, { placeHolder });
  return selected?.project;
}

async function checkInstallation(project: PySideProject): Promise<CheckResult> {
  const env = project.env;
  const folder = project.folder;
  if (!env.isVenv()) {
    return { status: 'noVenv', folder };
  }

  const pyside = await env.readPySide6PackageInfo();
  if (!pyside) {
    return { status: 'noPySide', folder, env };
  }

  return {
    status: 'alreadyInstalled',
    folder,
    env,
    pysideVersion: pyside.version
  };
}

async function showMessageOrInstall(result: CheckResult) {
  if (result.status === 'alreadyInstalled') {
    void vscode.window.showInformationMessage(
      texts.install.popup.alreadyInstalled(
        result.folder.name,
        result.pysideVersion ?? '',
        result.env?.venvName ?? ''
      )
    );
    return;
  }

  if (result.status === 'noVenv') {
    const msg = texts.install.popup.noVenv(result.folder.name);
    const btnCreate = texts.install.popup.buttonCreateEnv;
    const btnCreateUv = texts.install.popup.buttonCreateUvEnv;
    const btnSelect = texts.install.popup.buttonSelectEnv;

    const preferUv = vscode.workspace
      .getConfiguration(consts.COMMAND_PREFIX)
      .get<boolean>(consts.CONFIG_PREFER_UV, false);

    const uvAvailable = isUvAvailable();
    const buttons = uvAvailable
      ? preferUv
        ? [btnCreateUv, btnCreate, btnSelect]
        : [btnCreate, btnCreateUv, btnSelect]
      : [btnCreate, btnSelect];

    void vscode.window.showWarningMessage(msg, ...buttons).then((value) => {
      const exec = vscode.commands.executeCommand;
      if (value === btnCreate) {
        void exec(consts.COMMAND_PYTHON_CREATE_ENV);
      } else if (value === btnCreateUv) {
        void createUvVenv(result.folder);
      } else if (value === btnSelect) {
        void exec(consts.COMMAND_PYTHON_SELECT_PYTHON);
      }
    });

    return;
  }

  if (!result.env) {
    logger.error(
      'The environment is invalid. ',
      'Check the Python development setup or report the error'
    );
    return;
  }

  await tryInstallPySide(result.folder, result.env);
}

async function tryInstallPySide(
  folder: vscode.WorkspaceFolder,
  env: PySideEnv
) {
  const source = await selectInstallSource(env);
  if (!source) {
    return;
  }

  if (source.source === 'download') {
    const url = vscode.Uri.parse('https://account.qt.io');
    void vscode.env.openExternal(url);
    return;
  }

  const logIndented = (line: string) => {
    info(folder, ' ', line);
  };
  const runner = new PySideCommandRunner(env);
  runner.onStdout(logIndented);
  runner.onStderr(logIndented);

  const linkText = texts.install.popup.linkShowLog;
  const linkCommand = `${consts.COMMAND_PREFIX}.${consts.COMMAND_SHOW_LOG}`;
  const linkShowLogs = `[${linkText}](command:${linkCommand})`;

  const popups = texts.install.popup;
  const options = {
    location: vscode.ProgressLocation.Notification,
    cancellable: false
  };

  await vscode.window.withProgress(options, async (progress) => {
    async function run(command: string, message: string, opts?: RunOptions) {
      progress.report({ message: `${message} (${linkShowLogs})` });
      await runner.run(command, {
        useVenv: true,
        ...opts
      });
    }

    try {
      switch (source.source) {
        case 'oss':
          await run('pip install PySide6', popups.installing);
          break;

        case 'commercial': {
          const qtpip = await env.readPackageInfo('qtpip');
          if (!qtpip) {
            await run('pip install qtpip', popups.installingQtPip);
          }

          await run('qtpip install PySide6', popups.installingCommercial);
          break;
        }

        case 'local':
          if (source.localPath) {
            await run('pip install -r requirements.txt', popups.installing, {
              cwd: source.localPath
            });
            break;
          }
          return;

        default:
          return;
      }

      const pyside = await env.readPySide6PackageInfo();
      if (!pyside) {
        throw new Error('Cannot read PySide6 package information');
      }

      await projectManager.refreshProjectEnv(folder);

      void vscode.window.showInformationMessage(
        texts.install.popup.installed(
          folder.name,
          pyside.version,
          env.venvName ?? ''
        )
      );
    } catch (e) {
      void vscode.window.showWarningMessage(
        texts.install.popup.installFailed(folder.name) + ` (${linkShowLogs})`
      );
    }
  });
}

async function selectInstallSource(env: PySideEnv) {
  const items: InstallSourceItem[] = [
    {
      source: 'oss',
      label: texts.install.sourcePicker.labelOss,
      env
    }
  ];

  if (coreApi) {
    const insRootKey = QtInsRootConfigName;
    const insRoot =
      coreApi.getValue<string>(CoreKey.GLOBAL_WORKSPACE, insRootKey) ?? '';

    const localPackages = await getLocalPackageInfo(insRoot, env);
    if (localPackages.length !== 0) {
      items.push({
        kind: vscode.QuickPickItemKind.Separator,
        label: texts.install.sourcePicker.annotationForLocal
      });
      items.push(...localPackages);
    }
  }

  items.push(
    {
      kind: vscode.QuickPickItemKind.Separator,
      label: ''
    },
    {
      source: 'commercial',
      label: texts.install.sourcePicker.labelCommercial,
      env
    },
    {
      source: 'download',
      label: texts.install.sourcePicker.labelDownload + ' $(globe)'
    }
  );

  const placeHolder = texts.install.placeHolder.selectVersion;
  return vscode.window.showQuickPick(items, { placeHolder });
}

async function getLocalPackageInfo(insRoot: string, env: PySideEnv) {
  const packagesRoot = path.join(insRoot, consts.MAINT_WHEEL_DIR_NAME);

  try {
    const entries = await fs.promises.readdir(packagesRoot, {
      withFileTypes: true
    });

    const pickerItems = entries
      .filter((entry) => {
        if (entry.isDirectory()) {
          const r = path.join(packagesRoot, entry.name, 'requirements.txt');
          return fs.existsSync(r);
        }

        return false;
      })
      .sort((a: fs.Dirent, b: fs.Dirent) => {
        return -1 * compareVersions(a.name, b.name);
      })
      .map((e) => {
        const dir = normalizeDriveLetter(path.join(e.parentPath, e.name));
        return {
          label: e.name,
          description: dir,
          env,
          source: 'local',
          localPath: dir
        } as InstallSourceItem;
      });

    return pickerItems;
  } catch (err) {
    return [];
  }
}

// helpers
const info = (folder: vscode.WorkspaceFolder, ...message: string[]) => {
  logger.info(`(${folder.name}) `, ...message);
};

function isUvAvailable(): boolean {
  return commandExists.sync('uv');
}

async function createUvVenv(folder: vscode.WorkspaceFolder) {
  if (!isUvAvailable()) {
    void vscode.window.showWarningMessage(texts.install.popup.uvNotFound);
    return;
  }

  const venvDir = consts.UV_DEFAULT_VENV_DIR;
  const cwd = folder.uri.fsPath;

  const venvPath = path.join(cwd, venvDir);
  if (fs.existsSync(venvPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      texts.install.popup.uvVenvExists(folder.name, venvDir),
      texts.install.popup.buttonOverwrite,
      texts.install.popup.buttonCancel
    );
    if (overwrite !== texts.install.popup.buttonOverwrite) {
      return;
    }
  }

  const linkText = texts.install.popup.linkShowLog;
  const linkCommand = `${consts.COMMAND_PREFIX}.${consts.COMMAND_SHOW_LOG}`;
  const linkShowLogs = `[${linkText}](command:${linkCommand})`;

  const options = {
    location: vscode.ProgressLocation.Notification,
    cancellable: false
  };

  await vscode.window.withProgress(options, async (progress) => {
    try {
      progress.report({
        message: `${texts.install.popup.creatingUvVenv} (${linkShowLogs})`
      });

      info(folder, `Creating uv venv in ${venvDir}`);
      await runSimpleCommand(`uv venv --seed ${venvDir}`, cwd);
      info(folder, 'uv venv created');

      if (pyApi) {
        const pythonPath = path.join(
          cwd,
          venvDir,
          consts.VENV_BIN_DIR,
          'python' + OSExeSuffix
        );
        await pyApi.environments.updateActiveEnvironmentPath(
          pythonPath,
          folder
        );
        info(folder, `Active environment set to ${pythonPath}`);
        await projectManager.refreshProjectEnv(folder);
      }

      void vscode.window.showInformationMessage(
        texts.install.popup.uvVenvCreated(folder.name, venvDir)
      );
    } catch (e) {
      logger.error(`Failed to create uv venv: ${String(e)}`);
      void vscode.window.showWarningMessage(
        texts.install.popup.uvVenvFailed(folder.name) + ` (${linkShowLogs})`
      );
    }
  });
}

export async function onCreateUvEnvCommand() {
  const selected = await selectTargetProject();
  if (!selected) {
    return;
  }

  await createUvVenv(selected.folder);
}

// run a command and get the output as a promise. basically a wrapper around child_process.exec
async function runSimpleCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Command failed: ${command}\n${stderr}`);
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}
