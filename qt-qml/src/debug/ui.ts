// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class QmlEngineUI {
  private progressResolve: (() => void) | undefined;
  showSuccesfullAttach() {
    this.removeWaitingForDebugger();
    // Remove notification after 5 seconds
    const title = 'QML Debugger attached successfully';
    const progressOptions = {
      title: title,
      location: vscode.ProgressLocation.Notification,
      cancellable: false
    };
    const timeout = 5000;
    return vscode.window.withProgress(progressOptions, async (progress) => {
      progress.report({ increment: 100 });
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, timeout);
      });
    });
  }
  showWaitingForDebugger(port?: string) {
    void this;
    let title = `Waiting for the executable to start... `;
    if (port) {
      title += `Port: ${port}`;
    }
    const progressOptions = {
      title: title,
      location: vscode.ProgressLocation.Notification,
      cancellable: false
    };

    return vscode.window.withProgress(progressOptions, async () => {
      return new Promise<void>((resolve) => {
        this.progressResolve = resolve;
      });
    });
  }

  removeWaitingForDebugger() {
    if (this.progressResolve) {
      this.progressResolve();
      this.progressResolve = undefined;
    }
  }
  showError(message: string) {
    this.removeWaitingForDebugger();
    void vscode.window.showErrorMessage(message);
  }
  dispose() {
    this.removeWaitingForDebugger();
  }
}
