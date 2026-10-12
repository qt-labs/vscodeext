// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

interface AttachConnectionInfo {
  host: string;
  port: number;
}
interface FpsDisplayInfo {
  numSyncs: number;
  minSync: number;
  maxSync: number;
  minRender: number;
  maxRender: number;
}

/* eslint-disable @typescript-eslint/class-methods-use-this */
export class QmlPreviewUI {
  private readonly _fpsStatusItem: vscode.StatusBarItem;
  private readonly _speedStatusItem: vscode.StatusBarItem;
  private _lastValidFps = 0;
  private _progressResolve: (() => void) | undefined;

  constructor() {
    this._fpsStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this._fpsStatusItem.name = 'QML Preview FPS';

    this._speedStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    this._speedStatusItem.name = 'QML Preview Animation Speed';
    this._speedStatusItem.command = 'qt-qml.setQmlPreviewAnimationSpeed';
    this.updateAnimationSpeed(1);
  }

  updateAnimationSpeed(speed: number) {
    this._speedStatusItem.text = `$(watch) ${speed.toString()}x`;
    this._speedStatusItem.tooltip = `QML Preview animation speed: ${speed.toString()}x\nClick to change`;
  }

  showAnimationSpeedStatus() {
    this._speedStatusItem.show();
  }

  hideAnimationSpeedStatus() {
    this._speedStatusItem.hide();
  }

  /**
   * Ask for the animation speed factor, offering common presets.
   */
  async promptForAnimationSpeed(current: number) {
    const presets = [0.1, 0.25, 0.5, 1, 2, 4];
    const customItem: vscode.QuickPickItem = { label: 'Custom...' };
    const presetItems = presets.map((preset): vscode.QuickPickItem => {
      const label = `${preset.toString()}x`;
      return preset === current ? { label, description: 'current' } : { label };
    });
    const picked = await vscode.window.showQuickPick(
      [...presetItems, customItem],
      { placeHolder: `Animation speed (current: ${current.toString()}x)` }
    );
    if (!picked) {
      return undefined;
    }
    if (picked !== customItem) {
      return presets[presetItems.indexOf(picked)];
    }

    const input = await vscode.window.showInputBox({
      prompt: 'Enter the animation speed factor (1 is normal speed)',
      value: current.toString(),
      validateInput: (value) => {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0 || num > 100) {
          return 'Enter a number greater than 0 and at most 100';
        }
        return undefined;
      }
    });
    return input === undefined ? undefined : Number(input);
  }

  updateFps(fps: FpsDisplayInfo) {
    const frames = fps.numSyncs;
    if (frames !== 0) {
      this._lastValidFps = frames;
    }

    let fpsText: string;
    if (this._lastValidFps === 0 || (frames === 0 && this._lastValidFps < 2)) {
      fpsText = '-- FPS';
    } else {
      fpsText = `${this._lastValidFps.toString()} FPS`;
    }

    this._fpsStatusItem.text = `$(pulse) ${fpsText}`;
    this._fpsStatusItem.tooltip = `QML Preview\nSync: ${fps.minSync.toString()}ms - ${fps.maxSync.toString()}ms\nRender: ${fps.minRender.toString()}ms - ${fps.maxRender.toString()}ms`;
  }

  showFpsStatus() {
    this._fpsStatusItem.text = '$(pulse) -- FPS';
    this._fpsStatusItem.tooltip = 'QML Preview FPS';
    this._fpsStatusItem.show();
  }

  hideFpsStatus() {
    this._lastValidFps = 0;
    this._fpsStatusItem.hide();
  }

  dispose() {
    this.removeWaitingForConnection();
    this._fpsStatusItem.dispose();
    this._speedStatusItem.dispose();
  }

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
    this.showInfo('QML Preview is already running.');
  }

  showNotRunning() {
    this.showInfo('QML Preview is not running.');
  }

  showNotConnected() {
    this.showWarning('QML Preview is not connected. Start it first.');
  }

  showFailedToGetPort() {
    this.showError('Cannot obtain a free port for QML Preview.');
  }

  showFailedToGetLaunchTarget() {
    this.showError('Cannot get launch target executable for QML Preview.');
  }

  showFailedToStartProcess() {
    this.showError('Cannot start QML Preview process.');
  }

  showProcessExited(code: number | null, signal: NodeJS.Signals | null) {
    this.showError(
      `QML Preview process exited with code ${code?.toString() ?? ''}, signal ${String(signal ?? '')}`
    );
  }

  showFailedToStart(error: unknown) {
    this.showError(`Cannot start QML Preview: ${String(error)}`);
  }

  showFailedToAttach(error: unknown) {
    this.removeWaitingForConnection();
    this.showError(`Cannot attach to QML Preview: ${String(error)}`);
  }

  showAttachSuccess(host: string, port: number) {
    this.removeWaitingForConnection();
    // Remove notification after 5 seconds
    const title = `QML Preview attached successfully at ${host}:${port.toString()}`;
    const progressOptions = {
      title: title,
      location: vscode.ProgressLocation.Notification,
      cancellable: false
    };
    const timeout = 5000;
    void vscode.window.withProgress(progressOptions, async (progress) => {
      progress.report({ increment: 100 });
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, timeout);
      });
    });
  }

  showWaitingForConnection(host: string, port: number, onCancel?: () => void) {
    const title = `Connecting to QML Preview at ${host}:${port.toString()}...`;
    const progressOptions = {
      title: title,
      location: vscode.ProgressLocation.Notification,
      cancellable: true
    };

    return vscode.window.withProgress(
      progressOptions,
      async (progress, token) => {
        void progress;
        // Handle cancellation
        token.onCancellationRequested(() => {
          if (onCancel) {
            onCancel();
          }
          if (this._progressResolve) {
            this._progressResolve();
            this._progressResolve = undefined;
          }
        });

        return new Promise<void>((resolve) => {
          this._progressResolve = resolve;
        });
      }
    );
  }

  removeWaitingForConnection() {
    if (this._progressResolve) {
      this._progressResolve();
      this._progressResolve = undefined;
    }
  }

  showHotReloadFailed(reason: string) {
    this.showWarning(
      `QML Preview hot reload failed: ${reason}. Restarting the application...`
    );
  }

  showHotReloadFailedAttached(reason: string) {
    this.showWarning(
      `QML Preview hot reload failed: ${reason}. Restart the application to recover.`
    );
  }

  showReloaded() {
    this.showInfo('QML Preview reloaded.');
  }

  showCacheCleared() {
    this.showInfo('QML Preview cache cleared.');
  }

  setPreviewRunning() {
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlPreviewRunning',
      true
    );
    this.showFpsStatus();
    this.showAnimationSpeedStatus();
  }

  setPreviewStopped() {
    void vscode.commands.executeCommand(
      'setContext',
      'qt-qml.qmlPreviewRunning',
      false
    );
    this.hideFpsStatus();
    this.hideAnimationSpeedStatus();
  }

  async promptForHost() {
    return vscode.window.showInputBox({
      prompt: 'Enter the host address of the QML application',
      placeHolder: '127.0.0.1',
      value: '127.0.0.1'
    });
  }

  async promptForPort() {
    const portInput = await vscode.window.showInputBox({
      prompt: 'Enter the port number of the QML application',
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0 || num > 65535) {
          return 'Enter a valid port number (1-65535)';
        }
        return undefined;
      }
    });

    if (!portInput) {
      return undefined;
    }

    return parseInt(portInput);
  }

  async promptForConnectionInfo(): Promise<AttachConnectionInfo | undefined> {
    const host = await this.promptForHost();
    if (!host) {
      return undefined;
    }

    const port = await this.promptForPort();
    if (!port) {
      return undefined;
    }

    return { host, port };
  }
}
