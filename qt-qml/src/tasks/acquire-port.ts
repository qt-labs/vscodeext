// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import getPort from 'get-port';

import { telemetry } from 'qt-lib';

interface AcquirePortTaskDefinition extends vscode.TaskDefinition {
  /**
   * The task name
   */
  task: string;
}

export let compoundPort: string | undefined = undefined;

// This is a dummy terminal that does nothing.
// Since vscode.CustomExecution expects a callback which returns a
// Pseudoterminal, we need to provide one. That's why we have this dummy
// terminal class.
export class DummyTaskTerminal implements vscode.Pseudoterminal {
  private readonly _writeEmitter = new vscode.EventEmitter<string>();
  private readonly _closeEmitter = new vscode.EventEmitter<number>();
  public get onDidWrite() {
    return this._writeEmitter.event;
  }
  public get onDidClose() {
    return this._closeEmitter.event;
  }
  open() {
    this.close();
  }
  close() {
    this._closeEmitter.fire(0);
  }
}

export class AcquirePortTaskProvider implements vscode.TaskProvider {
  static type = 'Qt';
  constructor() {
    vscode.debug.onDidTerminateDebugSession((session) => {
      if (session.type === 'qml') {
        compoundPort = undefined;
      }
    });
  }
  private static getTask(
    taskDefinition: AcquirePortTaskDefinition
  ): vscode.Task {
    const taskCallback = async (
      _callbacktaskDefinition: vscode.TaskDefinition
    ) => {
      void _callbacktaskDefinition;
      telemetry.sendAction('acquirePortTaskProvider');
      compoundPort = (await getPort()).toString();
      return Promise.resolve(new DummyTaskTerminal());
    };
    const WASMStartTask = new vscode.Task(
      taskDefinition,
      vscode.TaskScope.Workspace,
      'Acquire Port',
      AcquirePortTaskProvider.type,
      new vscode.CustomExecution(taskCallback)
    );
    return WASMStartTask;
  }
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public provideTasks(): vscode.Task[] {
    const result: vscode.Task[] = [];
    const taskDefinition: AcquirePortTaskDefinition = {
      type: AcquirePortTaskProvider.type,
      task: 'Acquire Port'
    };
    const AcquirePortTask = AcquirePortTaskProvider.getTask(taskDefinition);
    result.push(AcquirePortTask);
    return result;
  }
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public resolveTask(_task: vscode.Task): vscode.Task | undefined {
    const definition: AcquirePortTaskDefinition =
      _task.definition as AcquirePortTaskDefinition;
    return AcquirePortTaskProvider.getTask(definition);
  }
}

export const acquirePortTaskProvider = new AcquirePortTaskProvider();
