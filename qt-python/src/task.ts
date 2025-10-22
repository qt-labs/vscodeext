// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { TaskId, type ProjectToolAction } from './types';
import { PySideProject } from './project';
import { projectManager } from './extension';
import { PySideCommandBuilder } from './builder';
import * as consts from './constants';

const logger = createLogger('task');

export class PySideTaskProvider implements vscode.TaskProvider {
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  provideTasks(): vscode.ProviderResult<vscode.Task[]> {
    const tasks: (vscode.Task | undefined)[] = [];

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const project = projectManager.getProject(folder);
      if (!project?.isValid()) {
        logger.info(
          [
            `Skipping: folder = "${folder.uri.fsPath}"`,
            'not a valid PySide6 project'
          ].join(', ')
        );
        continue;
      }

      tasks.push(
        createTask(project, TaskId.Run),
        createTask(project, TaskId.Build),
        createTask(project, TaskId.Clean),
        createTask(project, TaskId.Deploy)
      );
    }

    return tasks.filter((t) => t !== undefined);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  resolveTask(
    task: vscode.Task
  ): vscode.ProviderResult<vscode.Task | undefined> {
    const action = _.get(task.definition, 'action', '') as string;
    const taskId = findTaskIdFromAction(action);
    const folder = findFolderForTask(task);
    const project = folder ? projectManager.getProject(folder) : undefined;

    if (!taskId || !folder || !project) {
      logger.info(`Cannot resolve task: name = ${task.name}, id = ${taskId}`);
      return undefined;
    }

    return createTask(project, taskId);
  }
}

export function findTaskFullName(id: TaskId): string {
  return `${consts.TASK_SOURCE}: ${findTaskName(id)}`;
}

// helpers
function createTask(project: PySideProject, taskId: TaskId) {
  const env = project.env;
  const folder = project.folder;
  const action = findProjectToolAction(taskId);
  const taskName = findTaskName(taskId);
  if (!env || !action || !taskName) {
    logger.info(`Cannot create: task = ${taskName}, folder = ${folder.name}`);
    return undefined;
  }

  const builder = new PySideCommandBuilder(env, { useVenv: true });
  const commandLine = builder.build(createProjectToolCommand(taskId));
  const shellOptions = {
    cwd: folder.uri.fsPath,
    executable: builder.shellPath,
    shellArgs: builder.shellArgs
  };

  const def = {
    type: consts.TASK_TYPE,
    action // contributes > taskDefinitions
  };

  const task = new vscode.Task(def, folder, taskName, consts.TASK_SOURCE);
  task.detail = `${consts.PYSIDE_PROJECT_TOOL} ${action}`;
  task.execution = new vscode.ShellExecution(commandLine, shellOptions);
  task.presentationOptions = { clear: true };

  const group = findTaskGroup(taskId);
  if (group) {
    task.group = group;
  }

  return task;
}

function createProjectToolCommand(taskId: TaskId) {
  const action = findProjectToolAction(taskId);
  return `${consts.PYSIDE_PROJECT_TOOL} ${action ?? ''}`;
}

function findTaskName(id: TaskId): string | undefined {
  return allTasksInfo.find((e) => e.id === id)?.name;
}

function findTaskGroup(id: TaskId): vscode.TaskGroup | undefined {
  return allTasksInfo.find((e) => e.id === id)?.group;
}

function findProjectToolAction(id: TaskId): ProjectToolAction | undefined {
  return allTasksInfo.find((e) => e.id === id)?.action;
}

function findTaskIdFromAction(action: string): TaskId | undefined {
  const act = action.trim().toLowerCase();
  for (const e of allTasksInfo) {
    if (e.action === act) {
      return e.id;
    }
  }

  return undefined;
}

function findFolderForTask(task: vscode.Task) {
  if (task.scope && typeof task.scope !== 'number') {
    return task.scope;
  }

  const active = vscode.window.activeTextEditor?.document.uri;
  if (active) {
    const folder = vscode.workspace.getWorkspaceFolder(active);
    if (folder) {
      return folder;
    }
  }

  return vscode.workspace.workspaceFolders?.[0];
}

const allTasksInfo = [
  {
    id: TaskId.Run,
    name: 'run',
    group: undefined,
    action: 'run' as ProjectToolAction
  },
  {
    id: TaskId.Build,
    name: 'build',
    group: vscode.TaskGroup.Build,
    action: 'build' as ProjectToolAction
  },
  {
    id: TaskId.Clean,
    name: 'clean',
    group: vscode.TaskGroup.Clean,
    action: 'clean' as ProjectToolAction
  },
  {
    id: TaskId.Deploy,
    name: 'deploy',
    group: undefined,
    action: 'deploy' as ProjectToolAction
  }
] as const;
