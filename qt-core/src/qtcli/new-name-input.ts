// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { QtcliAction, fallbackWorkingDir, isValidNewName } from './common';

export class QtcliNewNameInput {
  private _value = '';
  private _workingDir = fallbackWorkingDir();
  private readonly _input: vscode.InputBox;
  private readonly _disposables: vscode.Disposable[] = [];

  public onDidAccept: vscode.Event<void>;
  public onDidChangeWorkingDir: vscode.Event<string>;
  private readonly _onDidAcceptEmitter: vscode.EventEmitter<void>;
  private readonly _onDidChangeWorkingDirEmitter: vscode.EventEmitter<string>;

  constructor(action: QtcliAction) {
    this._input = vscode.window.createInputBox();
    this._input.value = 'untitled';
    this._input.title =
      action === QtcliAction.NewFile ? 'New File' : 'New Project';
    this._input.placeholder =
      action === QtcliAction.NewFile
        ? 'Enter a file name to create'
        : 'Enter a project name to create';
    this._input.buttons = [
      {
        iconPath: new vscode.ThemeIcon('folder'),
        tooltip: 'Select a base directory'
      }
    ];

    this._disposables = [
      this._input.onDidAccept(this._onAccepted.bind(this)),
      this._input.onDidTriggerButton(this._onButtonTriggered.bind(this)),
      this._input.onDidChangeValue(this._updateValidationMessage.bind(this))
    ];

    this._onDidAcceptEmitter = new vscode.EventEmitter<void>();
    this._onDidChangeWorkingDirEmitter = new vscode.EventEmitter<string>();
    this.onDidAccept = this._onDidAcceptEmitter.event;
    this.onDidChangeWorkingDir = this._onDidChangeWorkingDirEmitter.event;
  }

  dispose() {
    for (const d of this._disposables) {
      d.dispose();
    }

    this._input.dispose();
  }

  public getValue(): string {
    return this._value;
  }

  public getWorkingDir(): string {
    return this._workingDir;
  }

  public hasValidInput(): boolean {
    return this._input.validationMessage === undefined;
  }

  public setWorkingDir(dir: string) {
    this._workingDir = dir;
  }

  public show() {
    this._updateUi();
    this._input.show();
  }

  private _updateUi() {
    this._input.prompt = this._workingDir;
  }

  private _onAccepted() {
    this._value = this._input.value;
    this._onDidAcceptEmitter.fire();
    this._input.hide();
  }

  private async _onButtonTriggered() {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: 'Select Directory',
      defaultUri: vscode.Uri.file(this._workingDir)
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri.length > 0) {
      this._workingDir = folderUri[0]?.fsPath ?? '';
      this._onDidChangeWorkingDirEmitter.fire(this._workingDir);
    }

    this.show();
  }

  private _updateValidationMessage() {
    if (isValidNewName(this._input.value)) {
      this._input.validationMessage = undefined;
      return;
    }

    this._input.validationMessage = {
      message: '',
      severity: vscode.InputBoxValidationSeverity.Warning
    };
  }
}
