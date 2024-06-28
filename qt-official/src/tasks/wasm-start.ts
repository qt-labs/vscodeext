// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

interface WASMStartTaskDefinition extends vscode.TaskDefinition {
  /**
   * The task name
   */
  task: string;
}

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

export class WASMStartTaskProvider implements vscode.TaskProvider {
  static WASMStartType = 'Qt';
  private static getTask(taskDefinition: WASMStartTaskDefinition): vscode.Task {
    const taskCallback = async (
      callbacktaskDefinition: vscode.TaskDefinition
    ) => {
      void callbacktaskDefinition;
      const dummyTaskTerminal = new DummyTaskTerminal();
      const checkExtension = async (extensionId: string) => {
        const extension = vscode.extensions.getExtension(extensionId);
        if (extension) {
          if (!extension.isActive) {
            await extension.activate();
            return true;
          }
          return false;
        } else {
          const message =
            `The extension ${extensionId} is required to debug ` +
            `Qt WebAssembly applications. Do you want to install it?`;
          void vscode.window
            .showInformationMessage(message, 'Install')
            .then((selection) => {
              if (selection === 'Install') {
                const action = 'workbench.extensions.installExtension';
                const extensionName = extensionId;
                void vscode.commands.executeCommand(action, extensionName);
              }
            });
          return false;
        }
      };
      const dependentExtensions = [
        'ms-vscode.wasm-dwarf-debugging',
        'ms-vscode.live-server'
      ];
      const extensionPromises = dependentExtensions.map(checkExtension);
      const extensionResults = await Promise.all(extensionPromises);
      if (!extensionResults.includes(false)) {
        void vscode.commands.executeCommand('livePreview.runServerLoggingTask');
      }
      return Promise.resolve(dummyTaskTerminal);
    };
    const WASMStartTask = new vscode.Task(
      taskDefinition,
      vscode.TaskScope.Workspace,
      'WASM Start',
      'Qt',
      new vscode.CustomExecution(taskCallback)
    );
    return WASMStartTask;
  }
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public provideTasks(): vscode.Task[] {
    const result: vscode.Task[] = [];
    const taskDefinition: WASMStartTaskDefinition = {
      type: WASMStartTaskProvider.WASMStartType,
      task: 'WASMStart'
    };
    const WASMStartTask = WASMStartTaskProvider.getTask(taskDefinition);
    result.push(WASMStartTask);
    return result;
  }
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public resolveTask(_task: vscode.Task): vscode.Task | undefined {
    const definition: WASMStartTaskDefinition =
      _task.definition as WASMStartTaskDefinition;
    return WASMStartTaskProvider.getTask(definition);
  }
}

export const wasmStartTaskProvider = new WASMStartTaskProvider();
