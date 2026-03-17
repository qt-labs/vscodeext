// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { TaskId, type ProjectToolAction } from './types.js';
import { PySideProject } from './project.mjs';
import { projectManager } from './extension.mjs';
import { PySideCommandBuilder } from './builder.js';
import * as consts from './constants.js';

const logger = createLogger('task');

interface PySideDefinition extends vscode.TaskDefinition {
  type: string;
  action: string;
}

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
    const exec = task.execution;
    if (!exec) {
      const def = task.definition as PySideDefinition;
      const folder = task.scope as vscode.WorkspaceFolder;
      const taskId = findTaskIdFromAction(def.action);
      const taskName = taskId && findTaskName(taskId);
      if (!taskId || !taskName) {
        return undefined;
      }

      const shellExec = createShellExecution(folder, taskId);
      if (shellExec) {
        return new vscode.Task(
          def,
          folder,
          taskName,
          consts.TASK_SOURCE,
          shellExec
        );
      }
    }

    return undefined;
  }
}

export function findTaskFullName(id: TaskId): string {
  return `${consts.TASK_SOURCE}: ${findTaskName(id) ?? ''}`;
}

// helpers
function createTask(project: PySideProject, taskId: TaskId) {
  const folder = project.folder;
  const action = findProjectToolAction(taskId);
  const taskName = findTaskName(taskId);
  if (action === undefined || !taskName) {
    logger.info(
      `Cannot create: task = ${taskName ?? ''}, folder = ${folder.name}`
    );
    return undefined;
  }

  const def: PySideDefinition = {
    type: consts.TASK_TYPE,
    action // contributes > taskDefinitions
  };

  const exec = createShellExecution(folder, taskId);
  if (!exec) {
    return undefined;
  }

  const task = new vscode.Task(def, folder, taskName, consts.TASK_SOURCE);
  task.detail = `${consts.PYSIDE_PROJECT_TOOL} ${action}`;
  task.execution = exec;
  task.presentationOptions = { clear: true };

  const group = findTaskGroup(taskId);
  if (group) {
    task.group = group;
  }

  return task;
}

function createShellExecution(
  folder: vscode.WorkspaceFolder,
  taskId: TaskId
): vscode.ShellExecution | undefined {
  const project = projectManager.getProject(folder);
  const env = project?.env;
  const action = findProjectToolAction(taskId);
  const taskName = findTaskName(taskId);
  if (!action || !taskName || !env) {
    logger.info(
      `Cannot create: task = ${taskName ?? ''}, folder = ${folder.name}`
    );
    return undefined;
  }

  const cmd = new PySideCommandBuilder()
    .useVenv(true)
    .venvBinPath(env.venvBinPath)
    .build(createProjectToolCommand(taskId));

  const shellOptions = {
    cwd: folder.uri.fsPath,
    executable: cmd.shellPath,
    shellArgs: cmd.shellArgs
  };

  return new vscode.ShellExecution(cmd.commandLine, shellOptions);
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
