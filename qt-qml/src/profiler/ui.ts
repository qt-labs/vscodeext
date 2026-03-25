// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

/* eslint-disable @typescript-eslint/class-methods-use-this */
export class QmlProfilerUI {
  private readonly _recordingStatusItem: vscode.StatusBarItem;

  constructor() {
    this._recordingStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this._recordingStatusItem.name = 'QML Profiler';
  }

  // ─── status bar ──────────────────────────────────────────────────────────

  setProfilerRunning() {
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlProfilerRunning',
      true
    );
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlProfilerRecording',
      false
    );
    this._recordingStatusItem.text = '$(record) QML Profiler';
    this._recordingStatusItem.tooltip =
      'QML Profiler is connecting. Click to stop.';
    this._recordingStatusItem.command = 'qt-qml.stopQmlProfiler';
    this._recordingStatusItem.show();
  }

  setProfilerRecording() {
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlProfilerRunning',
      true
    );
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlProfilerRecording',
      true
    );
    this._recordingStatusItem.text = '$(stop-circle) Recording…';
    this._recordingStatusItem.tooltip =
      'QML Profiler is recording. Click to stop and save trace.';
    this._recordingStatusItem.command = 'qt-qml.stopQmlProfiler';
    this._recordingStatusItem.show();
  }

  setProfilerStopped() {
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlProfilerRunning',
      false
    );
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlProfilerRecording',
      false
    );
    this._recordingStatusItem.hide();
  }

  // ─── notifications ───────────────────────────────────────────────────────

  showError(message: string) {
    void vscode.window.showErrorMessage(message);
  }

  showInfo(message: string) {
    void vscode.window.showInformationMessage(message);
  }

  showWarning(message: string) {
    void vscode.window.showWarningMessage(message);
  }

  showAlreadyRunning() {
    this.showInfo('QML Profiler is already running.');
  }

  showNotRunning() {
    this.showInfo('QML Profiler is not running.');
  }

  showNotConnected() {
    this.showWarning('QML Profiler is not connected. Start it first.');
  }

  showAlreadyRecording() {
    this.showInfo('QML Profiler is already recording.');
  }

  showNotRecording() {
    this.showInfo('QML Profiler is not currently recording.');
  }

  showFailedToStart(error: unknown) {
    this.showError(`Cannot start QML Profiler: ${String(error)}`);
  }

  showFailedToAttach(error: unknown) {
    this.removeWaitingForConnection();
    this.showError(`Cannot attach to QML Profiler: ${String(error)}`);
  }

  showAttachSuccess(host: string, port: number) {
    this.removeWaitingForConnection();
    const title = `QML Profiler attached at ${host}:${String(port)}`;
    void vscode.window.withProgress(
      {
        title,
        location: vscode.ProgressLocation.Notification,
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 100 });
        return new Promise<void>((resolve) => {
          setTimeout(resolve, 4000);
        });
      }
    );
  }

  showNoTraceData() {
    this.showWarning(
      'No profiling data was collected. Make sure the application ran with QML code.'
    );
  }

  private _progressResolve: (() => void) | undefined;

  showWaitingForConnection(host: string, port: number, onCancel?: () => void) {
    const title = `Connecting QML Profiler to ${host}:${String(port)}…`;
    return vscode.window.withProgress(
      {
        title,
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async (_progress, token) => {
        token.onCancellationRequested(() => {
          onCancel?.();
          this._progressResolve?.();
          this._progressResolve = undefined;
        });
        return new Promise<void>((resolve) => {
          this._progressResolve = resolve;
        });
      }
    );
  }

  removeWaitingForConnection() {
    this._progressResolve?.();
    this._progressResolve = undefined;
  }

  async promptForConnectionInfo(): Promise<
    { host: string; port: number } | undefined
  > {
    const host = await vscode.window.showInputBox({
      prompt: 'Enter the host for QML Profiler',
      value: '127.0.0.1',
      placeHolder: '127.0.0.1'
    });
    if (!host) {
      return undefined;
    }
    const portStr = await vscode.window.showInputBox({
      prompt: 'Enter the port for QML Profiler',
      validateInput: (v) =>
        /^\d+$/.test(v) && Number(v) > 0 && Number(v) < 65536
          ? null
          : 'Enter a valid port (1-65535)'
    });
    if (!portStr) {
      return undefined;
    }
    return { host, port: Number(portStr) };
  }

  dispose() {
    this.removeWaitingForConnection();
    this._recordingStatusItem.dispose();
  }
}
