// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  isError,
  CoreKey,
  createLogger,
  QtInsRootConfigName,
  compareVersions
} from 'qt-lib';
import { PySideEnv } from './env';
import { PySideProject } from './project';
import { PySideCommandRunner } from './runner';
import { coreApi, projectManager } from './extension';
import { normalizeDriveLetter } from './utils';
import * as texts from './texts';
import * as consts from './constants';

const logger = createLogger('installer');

interface TargetProjectItem extends vscode.QuickPickItem {
  project: PySideProject;
}

interface InstallSourceItem extends vscode.QuickPickItem {
  source?: 'oss' | 'local' | 'download';
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
    `version = ${result.pysideVersion}`
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
  if (!env || !env.isVenv()) {
    return { status: 'noVenv', folder };
  }

  const pysideVersion = await fetchPySide6Version(env);
  if (!pysideVersion) {
    return { status: 'noPySide', folder, env };
  }

  return { status: 'alreadyInstalled', folder, env, pysideVersion };
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
    const btnSelect = texts.install.popup.buttonSelectEnv;

    void vscode.window
      .showWarningMessage(msg, btnCreate, btnSelect)
      .then((value) => {
        const exec = vscode.commands.executeCommand;
        if (value === btnCreate) {
          void exec(consts.COMMAND_PYTHON_CREATE_ENV);
        } else if (value === btnSelect) {
          void exec(consts.COMMAND_PYTHON_SELECT_PYTHON);
        }
      });

    return;
  }

  if (!result.env) {
    logger.error('Environment is invalid');
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

  const options = {
    title: texts.install.popup.installing,
    location: vscode.ProgressLocation.Notification,
    cancellable: false
  };

  await vscode.window.withProgress(options, async () => {
    const runner = new PySideCommandRunner(env);
    runner.onStdout(logIndented);
    runner.onStderr(logIndented);

    if (source.source === 'oss') {
      await runner.run('pip install PySide6', { useVenv: true });
    } else if (source.source === 'local' && source.localPath) {
      await runner.run('pip install -r requirements.txt', {
        useVenv: true,
        cwd: source.localPath
      });
    } else {
      return;
    }

    const pyside6Version = await fetchPySide6Version(env);
    if (pyside6Version) {
      void vscode.window.showInformationMessage(
        texts.install.popup.installed(
          folder.name,
          pyside6Version,
          env.venvName ?? ''
        )
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

  items.push({
    kind: vscode.QuickPickItemKind.Separator,
    label: ''
  });

  items.push({
    source: 'download',
    label: texts.install.sourcePicker.labelDownload + ' $(globe)'
  });

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

async function fetchPySide6Version(env: PySideEnv) {
  const logIndented = (line: string) => {
    logger.info(' ', line);
  };

  try {
    // expected output from 'pip show <package>'
    //
    // Name: PySide6_Essentials
    // Version: 6.7.0+commercial
    // Summary: Python bindings for the Qt cross-platform ...

    const runner = new PySideCommandRunner(env);
    runner.onStdout(logIndented);
    runner.onStderr(logIndented);

    const output = await runner.run(`pip show PySide6`, { useVenv: true });

    for (const line of output) {
      const [key, value] = line.split(':');
      if (key?.toLowerCase() === 'version' && value) {
        return value.trim();
      }
    }
  } catch (e) {
    logger.error(isError(e) ? e.message : String(e));
  }

  return undefined;
}
