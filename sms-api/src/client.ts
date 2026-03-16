/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import { EventEmitter } from 'events';
import { Socket } from 'net';

import { connectSocket, type TransportOptions } from './transport';
import {
  JsonRpcDispatcher,
  type PromptHandler,
  type MessageHandler
} from './jsonrpc';
import {
  type SmsError,
  type PackageReference,
  type PackageData,
  type PackageUpdate,
  type PackageFilters,
  type PackageRequestOptions,
  type ProgressInfo,
  type MessageInfo,
  type JobCallbacks,
  SessionState,
  ErrorCategory,
  ErrorCode,
  InstallState,
  IPC
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPackageRef(pkg: PackageReference): string {
  if (pkg.version) {
    return `${pkg.id}${IPC.nameVersionSeparator}${pkg.version}`;
  }
  return pkg.id;
}

function filtersToJson(filters?: PackageFilters): unknown[] {
  if (!filters) {
    return [];
  }
  const arr: Record<string, string>[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      arr.push({ [key]: value });
    }
  }
  return arr;
}

function buildProgressInfo(
  progressParams: Record<string, unknown>
): ProgressInfo {
  const progress = (progressParams.progress as number | undefined) ?? 0;
  const message = progressParams.message as string | undefined;
  const info: ProgressInfo = { progress };
  if (message !== undefined) {
    (info as { message: string }).message = message;
  }
  return info;
}

function parsePackageData(obj: Record<string, unknown>): PackageData {
  return {
    id: (obj.id as string | undefined) ?? '',
    version: (obj.version as string | undefined) ?? '',
    name: (obj.name as string | undefined) ?? '',
    author: (obj.author as string | undefined) ?? '',
    description: (obj.description as string | undefined) ?? '',
    license: (obj.license as string | undefined) ?? '',
    product: (obj.product as string | undefined) ?? '',
    productId: (obj.productId as string | undefined) ?? '',
    productVersion: (obj.productVersion as string | undefined) ?? '',
    productName: (obj.productName as string | undefined) ?? '',
    compressedSize: (obj.compressedSize as number | undefined) ?? 0,
    uncompressedSize: (obj.uncompressedSize as number | undefined) ?? 0,
    installState:
      (obj.installState as InstallState | undefined) ?? InstallState.Uninstalled
  };
}

// ── Session ──────────────────────────────────────────────────────────────────

export interface SessionEvents {
  stateChanged: (state: SessionState) => void;
  error: (error: SmsError) => void;
}

export class Session extends EventEmitter {
  private _state: SessionState = SessionState.Disconnected;
  private _lastError: SmsError | undefined;
  private _dispatcher: JsonRpcDispatcher | undefined;
  private _socket: Socket | undefined;
  private readonly _socketPath: string;
  private readonly _connectTimeoutMs: number;

  constructor(socketPath?: string, connectTimeoutMs?: number) {
    super();
    this._socketPath = socketPath ?? IPC.defaultSocket;
    this._connectTimeoutMs = connectTimeoutMs ?? 5000;
  }

  get state(): SessionState {
    return this._state;
  }

  get lastError(): SmsError | undefined {
    return this._lastError;
  }

  get isConnected(): boolean {
    return this._state === SessionState.Connected;
  }

  /** Internal – used by Packages to access the dispatcher. */
  get dispatcher(): JsonRpcDispatcher {
    if (!this._dispatcher) {
      throw new Error('Not connected to service');
    }
    return this._dispatcher;
  }

  async connectToService(): Promise<void> {
    if (this._state === SessionState.Connected) {
      return;
    }

    this.setState(SessionState.Connecting);

    try {
      const socket = await connectSocket({
        socketPath: this._socketPath,
        connectTimeoutMs: this._connectTimeoutMs
      } satisfies TransportOptions);

      this._socket = socket;
      this._dispatcher = new JsonRpcDispatcher(socket);

      // Observe connection interruption
      socket.once('close', () => {
        if (this._state === SessionState.Connected) {
          this.setError({
            category: ErrorCategory.ServiceConnection,
            code: ErrorCode.SocketError,
            message: 'Connection lost'
          });
          this.setState(SessionState.Error);
        }
      });

      this.setState(SessionState.Connected);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setError({
        category: ErrorCategory.ServiceConnection,
        code: ErrorCode.ConnectionFailed,
        message: msg
      });
      this.setState(SessionState.Error);
      throw err;
    }
  }

  disconnectFromService(): void {
    this._dispatcher?.dispose();
    this._dispatcher = undefined;

    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.destroy();
      this._socket = undefined;
    }

    this.setState(SessionState.Disconnected);
  }

  private setState(state: SessionState): void {
    if (this._state === state) {
      return;
    }
    this._state = state;
    this.emit('stateChanged', state);
  }

  private setError(error: SmsError): void {
    this._lastError = error;
    this.emit('error', error);
  }
}

// ── Packages ─────────────────────────────────────────────────────────────────

export class Packages {
  private readonly session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  // ── Transaction commands ───────────────────────────────────────────────

  async install(
    packages: PackageReference[],
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.performPackageTransaction(
      IPC.methods.install,
      packages,
      options,
      callbacks
    );
  }

  async download(
    packages: PackageReference[],
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.performPackageTransaction(
      IPC.methods.download,
      packages,
      options,
      callbacks
    );
  }

  async update(
    packages?: PackageReference[],
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.performPackageTransaction(
      IPC.methods.update,
      packages ?? [],
      options,
      callbacks
    );
  }

  async remove(
    packages: PackageReference[],
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.performPackageTransaction(
      IPC.methods.remove,
      packages,
      options,
      callbacks
    );
  }

  async purge(
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.performPackageTransaction(
      IPC.methods.purge,
      [],
      options,
      callbacks
    );
  }

  // ── Query commands ─────────────────────────────────────────────────────

  async searchAvailablePackages(
    filters?: PackageFilters,
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageData[]> {
    return this.performListQuery(
      IPC.methods.search,
      filters,
      options,
      callbacks
    );
  }

  async listInstalledPackages(
    filters?: PackageFilters,
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageData[]> {
    return this.performListQuery(
      IPC.methods.listInstalled,
      filters,
      options,
      callbacks
    );
  }

  async listAvailableUpdates(
    filters?: PackageFilters,
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageUpdate[]> {
    const params = Packages.buildQueryParams(filters, options);

    return this.callService<PackageUpdate[]>(
      IPC.methods.listUpdates,
      params,
      (result) => {
        const obj = result as Record<string, unknown>;
        const packages =
          (obj.packages as Record<string, unknown>[] | undefined) ?? [];
        return packages.map((entry) => ({
          newPackage: parsePackageData(
            (entry.new_package as Record<string, unknown> | undefined) ?? {}
          ),
          oldPackage: parsePackageData(
            (entry.old_package as Record<string, unknown> | undefined) ?? {}
          )
        }));
      },
      callbacks
    );
  }

  async showPackageInfo(
    pkg: PackageReference,
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageData> {
    const params: Record<string, unknown> = {
      package: { id: pkg.id, version: pkg.version ?? '' }
    };
    Packages.applyTimeout(params, options);

    return this.callService<PackageData>(
      IPC.methods.showInfo,
      params,
      (result) => {
        const obj = result as Record<string, unknown>;
        const pkgObj =
          (obj.package as Record<string, unknown> | undefined) ?? {};
        return parsePackageData(pkgObj);
      },
      callbacks
    );
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async performPackageTransaction(
    method: string,
    packages: PackageReference[],
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<string> {
    const params: Record<string, unknown> = {};
    if (packages.length > 0) {
      params.packages = packages.map(formatPackageRef);
    }
    if (options?.timeoutMs) {
      params.timeout = String(options.timeoutMs);
    }

    return this.callService<string>(
      method,
      params,
      (result) => {
        const obj = result as Record<string, unknown>;
        return (obj.message as string | undefined) ?? '';
      },
      callbacks
    );
  }

  private async performListQuery(
    method: string,
    filters?: PackageFilters,
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageData[]> {
    const params = Packages.buildQueryParams(filters, options);

    return this.callService<PackageData[]>(
      method,
      params,
      (result) => {
        const obj = result as Record<string, unknown>;
        const packages =
          (obj.packages as Record<string, unknown>[] | undefined) ?? [];
        return packages.map(parsePackageData);
      },
      callbacks
    );
  }

  private static buildQueryParams(
    filters?: PackageFilters,
    options?: PackageRequestOptions
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      filters: filtersToJson(filters)
    };
    Packages.applyTimeout(params, options);
    return params;
  }

  private static applyTimeout(
    params: Record<string, unknown>,
    options?: PackageRequestOptions
  ): void {
    if (options?.timeoutMs && options.timeoutMs > 0) {
      const opts = [{ timeout: String(options.timeoutMs) }];
      params.options = opts;
    }
  }

  private async callService<T>(
    method: string,
    params: unknown,
    parseResult: (result: unknown) => T,
    callbacks?: JobCallbacks
  ): Promise<T> {
    const dispatcher = this.session.dispatcher;

    return new Promise<T>((resolve, reject) => {
      const progressCb = callbacks?.onProgress;
      const onProgress = progressCb
        ? (progressParams: Record<string, unknown>) => {
            progressCb(buildProgressInfo(progressParams));
          }
        : undefined;

      const messageCb = callbacks?.onMessage;
      const onMessage: MessageHandler | undefined = messageCb
        ? (messageParams: Record<string, unknown>) => {
            const message = (messageParams.message as string | undefined) ?? '';
            messageCb({ message } satisfies MessageInfo);
          }
        : undefined;

      const promptCb = callbacks?.onPrompt;
      const onPrompt: PromptHandler | undefined = promptCb
        ? async (prompt) => promptCb(prompt)
        : undefined;

      dispatcher.call(
        method,
        params,
        (result) => {
          try {
            resolve(parseResult(result));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        (error) => {
          reject(new Error(error.message));
        },
        onProgress,
        onPrompt,
        onMessage
      );
    });
  }
}

// ── Cache ────────────────────────────────────────────────────────────────────

export class Cache {
  private readonly session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  async updateCache(callbacks?: JobCallbacks): Promise<string> {
    return this.callService<string>(
      IPC.methods.updateCache,
      {},
      (result) => {
        const obj = result as Record<string, unknown>;
        return (obj.message as string | undefined) ?? '';
      },
      callbacks
    );
  }

  async clearCache(callbacks?: JobCallbacks): Promise<string> {
    return this.callService<string>(
      IPC.methods.clearCache,
      {},
      (result) => {
        const obj = result as Record<string, unknown>;
        return (obj.message as string | undefined) ?? '';
      },
      callbacks
    );
  }

  private async callService<T>(
    method: string,
    params: unknown,
    parseResult: (result: unknown) => T,
    callbacks?: JobCallbacks
  ): Promise<T> {
    const dispatcher = this.session.dispatcher;

    return new Promise<T>((resolve, reject) => {
      const progressCb = callbacks?.onProgress;
      const onProgress = progressCb
        ? (progressParams: Record<string, unknown>) => {
            progressCb(buildProgressInfo(progressParams));
          }
        : undefined;

      const messageCb = callbacks?.onMessage;
      const onMessage: MessageHandler | undefined = messageCb
        ? (messageParams: Record<string, unknown>) => {
            const message = (messageParams.message as string | undefined) ?? '';
            messageCb({ message } satisfies MessageInfo);
          }
        : undefined;

      const promptCb = callbacks?.onPrompt;
      const onPrompt: PromptHandler | undefined = promptCb
        ? async (prompt) => promptCb(prompt)
        : undefined;

      dispatcher.call(
        method,
        params,
        (result) => {
          try {
            resolve(parseResult(result));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        (error) => {
          reject(new Error(error.message));
        },
        onProgress,
        onPrompt,
        onMessage
      );
    });
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export class Settings {
  private readonly session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  async setSetting(
    key: string,
    value: string,
    callbacks?: JobCallbacks
  ): Promise<string> {
    const params = [{ [key]: value }];

    return this.callService<string>(
      IPC.methods.setSetting,
      params,
      (result) => {
        const obj = result as Record<string, unknown>;
        return (obj.message as string | undefined) ?? '';
      },
      callbacks
    );
  }

  async getSetting(key: string, callbacks?: JobCallbacks): Promise<string> {
    const params = { key };

    return this.callService<string>(
      IPC.methods.getSetting,
      params,
      (result) => {
        const obj = result as Record<string, unknown>;
        return (obj[key] as string | undefined) ?? '';
      },
      callbacks
    );
  }

  private async callService<T>(
    method: string,
    params: unknown,
    parseResult: (result: unknown) => T,
    callbacks?: JobCallbacks
  ): Promise<T> {
    const dispatcher = this.session.dispatcher;

    return new Promise<T>((resolve, reject) => {
      const progressCb = callbacks?.onProgress;
      const onProgress = progressCb
        ? (progressParams: Record<string, unknown>) => {
            progressCb(buildProgressInfo(progressParams));
          }
        : undefined;

      const messageCb = callbacks?.onMessage;
      const onMessage: MessageHandler | undefined = messageCb
        ? (messageParams: Record<string, unknown>) => {
            const message = (messageParams.message as string | undefined) ?? '';
            messageCb({ message } satisfies MessageInfo);
          }
        : undefined;

      const promptCb = callbacks?.onPrompt;
      const onPrompt: PromptHandler | undefined = promptCb
        ? async (prompt) => promptCb(prompt)
        : undefined;

      dispatcher.call(
        method,
        params,
        (result) => {
          try {
            resolve(parseResult(result));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        },
        (error) => {
          reject(new Error(error.message));
        },
        onProgress,
        onPrompt,
        onMessage
      );
    });
  }
}
