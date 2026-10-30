// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export interface TaskBusyRunnerOptions {
  name?: string;
  debounceTime_ms: number;
}

export class TaskBusyRunner {
  private _busy = $state(false);
  private _error = $state(undefined as unknown);
  private _isDebouncing = $state(false);
  private _pendingTimer = $state(null as ReturnType<typeof setTimeout> | null);
  private _recentOptions = $state<TaskBusyRunnerOptions | undefined>();

  get busy() {
    return this._busy;
  }

  get error() {
    return this._error;
  }

  get isDebouncing() {
    return this._isDebouncing
  }

  get recentOptions() {
    return this._recentOptions;
  }

  public async run<T>(
    task: () => Promise<T> | T,
    options?: TaskBusyRunnerOptions
  ) {
    this._recentOptions = options;

    try {
      this._resetAll();
      this._start(options?.debounceTime_ms ?? 0);
      return await task();
    } catch (e) {
      this._error = e;
      throw e;
    } finally {
      this._resetAll();
    }
  }

  private _start(delay = 0) {
    this._busy = true;

    if (delay > 0) {
      this._isDebouncing = true;
      this._pendingTimer = setTimeout(() => {
        this._isDebouncing = false;
      }, delay);
    }
  }

  private _resetAll() {
    this._busy = false;
    this._error = undefined;
    this._isDebouncing = false;

    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }
}
