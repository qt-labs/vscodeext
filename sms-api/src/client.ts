/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import { EventEmitter } from 'events';
import { Socket } from 'net';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';

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
  type PackageRequirements,
  type LicenseAgreement,
  type UnsatisfiedRule,
  type ProgressInfo,
  type MessageInfo,
  type JobCallbacks,
  SessionState,
  ErrorCategory,
  ErrorCode,
  InstallState,
  ProgressType,
  SettingsPersistence,
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

function parseProgressType(raw: unknown): ProgressType {
  if (typeof raw !== 'string') {
    return ProgressType.Download;
  }
  const map: Record<string, ProgressType> = {
    download: ProgressType.Download,
    install: ProgressType.Install,
    remove: ProgressType.Remove,
    query: ProgressType.Query
  };
  return map[raw.toLowerCase()] ?? ProgressType.Download;
}

function buildProgressInfo(
  progressParams: Record<string, unknown>
): ProgressInfo {
  const progress = (progressParams.progress as number | undefined) ?? 0;
  const message = progressParams.message as string | undefined;
  const type = parseProgressType(progressParams.type);
  const info: ProgressInfo = { type, progress };
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

function parseLicenseAgreement(obj: Record<string, unknown>): LicenseAgreement {
  return {
    id: (obj.id as string | undefined) ?? '',
    title: (obj.title as string | undefined) ?? '',
    text: (obj.text as string | undefined) ?? '',
    acceptText: (obj.acceptText as string | undefined) ?? '',
    rejectText: (obj.rejectText as string | undefined) ?? ''
  };
}

function parseUnsatisfiedRule(obj: Record<string, unknown>): UnsatisfiedRule {
  const rule = (obj.rule as Record<string, unknown> | undefined) ?? {};
  const pkgs =
    (obj.packages as Record<string, unknown>[] | undefined) ?? [];

  const ruleType = (rule.ruleType as string | undefined) ?? '';
  return {
    ruleId: (rule.ruleId as string | undefined) ?? '',
    ruleType,
    conditionType: (rule.conditionType as string | undefined) ?? '',
    conditionId: (rule.conditionId as string | undefined) ?? '',
    packages: pkgs.map((p) => {
      const ref: PackageReference = {
        id: (p.packageId as string | undefined) ?? ''
      };
      const ver = p.packageVersion as string | undefined;
      if (ver) {
        (ref as { version: string }).version = ver;
      }
      return ref;
    }),
    userMessage:
      ruleType === 'visibility'
        ? 'Package not available for your account'
        : `Installation blocked by rule: ${ruleType}`
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

// ── ServiceLauncher ──────────────────────────────────────────────────────────

export interface ServiceLauncherOptions {
  /** Absolute path to QtSoftwareManagementService executable. */
  serviceBin?: string;
  /** Socket path used for health-checking whether the service is running. */
  socketPath?: string;
  /** Maximum time (ms) to wait for the service socket after launch. */
  startupTimeoutMs?: number;
  /** Interval (ms) between socket-ready polls during startup. */
  pollIntervalMs?: number;
  /** Optional callback invoked with each line of stdout from the service. */
  onStdout?: (line: string) => void;
  /** Optional callback invoked with each line of stderr from the service. */
  onStderr?: (line: string) => void;
}

export interface ServiceLauncherEvents {
  errorOccurred: (error: SmsError) => void;
}

export class ServiceLauncher extends EventEmitter {
  private _lastError: SmsError | undefined;
  private _serviceProcess: ChildProcess | undefined;
  private readonly _serviceBin: string | undefined;
  private readonly _socketPath: string;
  private readonly _startupTimeoutMs: number;
  private readonly _pollIntervalMs: number;
  private readonly _onStdout: ((line: string) => void) | undefined;
  private readonly _onStderr: ((line: string) => void) | undefined;

  constructor(opts?: ServiceLauncherOptions) {
    super();
    this._serviceBin = opts?.serviceBin;
    this._socketPath = opts?.socketPath ?? IPC.defaultSocket;
    this._startupTimeoutMs = opts?.startupTimeoutMs ?? 10_000;
    this._pollIntervalMs = opts?.pollIntervalMs ?? 100;
    this._onStdout = opts?.onStdout;
    this._onStderr = opts?.onStderr;
  }

  get lastError(): SmsError | undefined {
    return this._lastError;
  }

  /**
   * Start the service if it is not already running.
   * Returns `true` when a running service is confirmed on the socket.
   */
  async startService(): Promise<boolean> {
    if (await this.isServiceRunning()) {
      return true;
    }

    const binPath = this.resolveServiceBin();
    if (!binPath) {
      this.setError({
        category: ErrorCategory.ServiceLifecycle,
        code: ErrorCode.ServiceNotFound,
        message: 'Cannot find service executable'
      });
      return false;
    }

    return this.launchAndWait(binPath);
  }

  stopService(): boolean {
    if (this._serviceProcess && !this._serviceProcess.killed) {
      this._serviceProcess.kill('SIGTERM');
      this._serviceProcess = undefined;
      return true;
    }
    return false;
  }

  async isServiceRunning(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ path: this._socketPath });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private resolveServiceBin(): string | undefined {
    // 1. Explicit path
    if (this._serviceBin && fs.existsSync(this._serviceBin)) {
      return this._serviceBin;
    }

    // 2. Next to current process executable
    const exeDir = path.dirname(process.execPath);
    const candidateName =
      process.platform === 'win32'
        ? 'QtSoftwareManagementService.exe'
        : 'QtSoftwareManagementService';
    const candidate = path.join(exeDir, candidateName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    return this._serviceBin; // may be undefined
  }

  private async launchAndWait(binPath: string): Promise<boolean> {
    if (!fs.existsSync(binPath)) {
      this.setError({
        category: ErrorCategory.ServiceLifecycle,
        code: ErrorCode.ServiceNotFound,
        message: `Cannot find service executable: ${binPath}`
      });
      return false;
    }

    let earlyExit: { code: number | null; signal: string | null } | undefined;
    const stderrChunks: string[] = [];

    try {
      this._serviceProcess = spawn(binPath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });
      this._serviceProcess.unref();
    } catch {
      this.setError({
        category: ErrorCategory.ServiceLifecycle,
        code: ErrorCode.ServiceStartFailed,
        message: `Cannot start service process: ${binPath}`
      });
      return false;
    }

    // Capture stdout for diagnostics
    this._serviceProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trimEnd();
        if (trimmed.length > 0) {
          this._onStdout?.(trimmed);
        }
      }
    });

    // Capture stderr for diagnostics
    this._serviceProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trimEnd();
        if (trimmed.length > 0) {
          stderrChunks.push(trimmed);
          this._onStderr?.(trimmed);
        }
      }
    });

    // Detect early exit so we can fail fast instead of polling until timeout
    this._serviceProcess.once('exit', (code, signal) => {
      earlyExit = { code, signal };
    });

    // Poll for the service socket, aborting if the process exits
    const ready = await this.pollForSocket(() => earlyExit !== undefined);
    if (ready) {
      this._lastError = undefined;
      return true;
    }

    // Build a useful error message
    let detail: string;
    if (earlyExit) {
      const exitInfo = earlyExit.signal
        ? `signal ${earlyExit.signal}`
        : `code ${String(earlyExit.code)}`;
      const stderr =
        stderrChunks.length > 0
          ? `\nService stderr:\n  ${stderrChunks.join('\n  ')}`
          : '';
      detail = `Service process exited (${exitInfo}) before socket became available${stderr}`;
      this.setError({
        category: ErrorCategory.ServiceLifecycle,
        code: ErrorCode.ServiceStartFailed,
        message: detail
      });
    } else {
      const stderr =
        stderrChunks.length > 0
          ? `\nService stderr:\n  ${stderrChunks.join('\n  ')}`
          : '';
      detail = `Service started but socket not available within ${String(this._startupTimeoutMs)} ms${stderr}`;
      this.setError({
        category: ErrorCategory.ServiceLifecycle,
        code: ErrorCode.ServiceStartTimeout,
        message: detail
      });
    }

    return false;
  }

  private async pollForSocket(abortEarly?: () => boolean): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < this._startupTimeoutMs) {
      if (abortEarly?.()) {
        return false;
      }
      await ServiceLauncher.sleepMs(this._pollIntervalMs);
      if (await this.isServiceRunning()) {
        return true;
      }
    }
    return false;
  }

  private static async sleepMs(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private setError(error: SmsError): void {
    this._lastError = error;
    this.emit('errorOccurred', error);
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

  async createOffline(
    packages: PackageReference[],
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.performPackageTransaction(
      IPC.methods.createOffline,
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

  async fetchRequirements(
    packages?: PackageReference[],
    options?: PackageRequestOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageRequirements> {
    const params: Record<string, unknown> = {};
    if (packages && packages.length > 0) {
      params.packages = packages.map(formatPackageRef);
    }
    Packages.applyTimeout(params, options);

    return this.callService<PackageRequirements>(
      IPC.methods.fetchRequirements,
      params,
      (result) => {
        const obj = result as Record<string, unknown>;
        const agreements =
          (obj.agreements as Record<string, unknown>[] | undefined) ?? [];
        const rules =
          (obj.unsatisfiedRules as Record<string, unknown>[] | undefined) ?? [];
        return {
          licenseAgreements: agreements.map(parseLicenseAgreement),
          unsatisfiedRules: rules.map(parseUnsatisfiedRule)
        };
      },
      callbacks
    );
  }

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
    if (options?.preAnsweredAgreements) {
      params.answers = options.preAnsweredAgreements.map((a) => ({
        id: a.id,
        answer: a.answer
      }));
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

  /**
   * Set a setting using the tiered wire format.
   * Each entry carries a key, value, and persistence type.
   */
  async setSetting(
    key: string,
    value: string,
    persistence: SettingsPersistence = SettingsPersistence.Temporary,
    callbacks?: JobCallbacks
  ): Promise<string> {
    const params = [{ key, value, type: persistence }];

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
    const params = [key];

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

  /**
   * Get the current installation path from the service.
   * Convenience wrapper around getSetting.
   */
  async getInstallationPath(callbacks?: JobCallbacks): Promise<string> {
    return this.getSetting(IPC.settingsKeys.installationPath, callbacks);
  }

  /**
   * Set the installation path on the service.
   * Persisted across service restarts.
   */
  async setInstallationPath(
    path: string,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.setSetting(
      IPC.settingsKeys.installationPath,
      path,
      SettingsPersistence.Persistent,
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
