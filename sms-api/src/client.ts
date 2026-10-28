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
import { qtCompanyIniPath } from './paths';
import {
  type ClientInfo,
  type CreateOfflineOptions,
  type ElevationHandler,
  type ElevationRequest,
  type InstallOptions,
  type SmsError,
  type PackageReference,
  type PackageData,
  type PackageOperationResult,
  type PackageUpdate,
  type PackageFilters,
  type PackageRequirements,
  type LaunchItem,
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
  SmsServiceError,
  IPC
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** `<id>@<version>`. The `@` is sent even without a version, like the C++ client. */
function formatPackageRef(pkg: PackageReference): string {
  return `${pkg.id}${IPC.nameVersionSeparator}${pkg.version ?? ''}`;
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

/** Empty and unknown phases count as `download`. */
function parseProgressType(raw: unknown): ProgressType {
  if (typeof raw !== 'string') {
    return ProgressType.Download;
  }
  const map: Record<string, ProgressType> = {
    download: ProgressType.Download,
    install: ProgressType.Install,
    remove: ProgressType.Remove
  };
  return map[raw.toLowerCase()] ?? ProgressType.Download;
}

function buildProgressInfo(
  progressParams: Record<string, unknown>
): ProgressInfo {
  const rawProgress = progressParams.progress;
  const progress = typeof rawProgress === 'number' ? rawProgress : 0;
  const message = progressParams.message as string | undefined;
  const type = parseProgressType(progressParams.type);
  const info: ProgressInfo = { type, progress };
  if (message !== undefined) {
    (info as { message: string }).message = message;
  }
  return info;
}

function stringField(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === 'string' ? value : '';
}

function numberField(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  return typeof value === 'number' ? value : 0;
}

/**
 * `displayNames` is an array of strings, but `packages/search` passes the
 * backend value through, which can be a single string or missing.
 */
function parseDisplayNames(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw.length > 0 ? [raw] : [];
  }
  if (Array.isArray(raw)) {
    return raw.filter(
      (name): name is string => typeof name === 'string' && name.length > 0
    );
  }
  return [];
}

function parsePackageData(obj: Record<string, unknown>): PackageData {
  const rawState = obj.installState;
  const installState =
    rawState === InstallState.Installed ||
    rawState === InstallState.UpdateAvailable
      ? rawState
      : InstallState.Uninstalled;
  return {
    id: stringField(obj, 'id'),
    version: stringField(obj, 'version'),
    name: stringField(obj, 'name'),
    displayNames: parseDisplayNames(obj.displayNames),
    author: stringField(obj, 'author'),
    description: stringField(obj, 'description'),
    license: stringField(obj, 'license'),
    product: stringField(obj, 'product'),
    productId: stringField(obj, 'productId'),
    productVersion: stringField(obj, 'productVersion'),
    productName: stringField(obj, 'productName'),
    compressedSize: numberField(obj, 'compressedSize'),
    uncompressedSize: numberField(obj, 'uncompressedSize'),
    installState
  };
}

function parseLicenseAgreement(obj: Record<string, unknown>): LicenseAgreement {
  return {
    id: stringField(obj, 'id'),
    title: stringField(obj, 'title'),
    text: stringField(obj, 'text'),
    format: stringField(obj, 'format'),
    acceptText: stringField(obj, 'acceptText'),
    rejectText: stringField(obj, 'rejectText')
  };
}

function parseUnsatisfiedRule(obj: Record<string, unknown>): UnsatisfiedRule {
  const rule = (obj.rule as Record<string, unknown> | undefined) ?? {};
  const pkgs = Array.isArray(obj.packages)
    ? (obj.packages as Record<string, unknown>[])
    : [];

  const ruleType = stringField(rule, 'ruleType');
  const conditionType = stringField(rule, 'conditionType');
  return {
    ruleId: stringField(rule, 'ruleId'),
    ruleType,
    conditionType,
    conditionId: stringField(rule, 'conditionId'),
    packages: pkgs.map((p) => {
      const ref: PackageReference = { id: stringField(p, 'packageId') };
      const ver = stringField(p, 'packageVersion');
      if (ver) {
        (ref as { version: string }).version = ver;
      }
      return ref;
    }),
    userMessage:
      ruleType === 'visibility'
        ? 'Package not available for your account'
        : `Installation blocked by rule: ${ruleType}`,
    isResolvableByUser: conditionType === 'la_accepted'
  };
}

function parseLaunchItems(raw: unknown): LaunchItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
    )
    .map((item) => ({
      order: numberField(item, 'order'),
      uri: stringField(item, 'uri'),
      type: stringField(item, 'type'),
      args: Array.isArray(item.args)
        ? item.args.filter((a): a is string => typeof a === 'string')
        : []
    }))
    .sort((a, b) => a.order - b.order);
}

function parseOperationResult(result: unknown): PackageOperationResult {
  const obj = (result as Record<string, unknown> | null) ?? {};
  return {
    message: stringField(obj, 'message'),
    launch: parseLaunchItems(obj.launch)
  };
}

function parsePackageList(result: unknown): PackageData[] {
  const obj = (result as Record<string, unknown> | null) ?? {};
  const packages = Array.isArray(obj.packages)
    ? (obj.packages as Record<string, unknown>[])
    : [];
  return packages.map(parsePackageData);
}

/**
 * Send one request and resolve with the parsed result. Rejects with an
 * `SmsServiceError` that carries the error code of the service.
 */
async function callService<T>(
  session: Session,
  method: string,
  params: unknown,
  parseResult: (result: unknown) => T,
  callbacks?: JobCallbacks
): Promise<T> {
  const dispatcher = session.dispatcher;

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
          const message = stringField(messageParams, 'message');
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
        reject(new SmsServiceError(error));
      },
      onProgress,
      onPrompt,
      onMessage
    );
  });
}

// ── Session ──────────────────────────────────────────────────────────────────

export interface SessionEvents {
  stateChanged: (state: SessionState) => void;
  error: (error: SmsError) => void;
}

export interface SessionOptions {
  /** Name and version of the application, for example `my-tool/1.0`. */
  userAgent?: string;
  /** Author, name and version of the application for usage statistics. */
  client?: ClientInfo;
  socketPath?: string;
  connectTimeoutMs?: number;
  /** Starts the elevated helper when the service asks for it. */
  onElevationRequired?: ElevationHandler;
}

export class Session extends EventEmitter {
  private _state: SessionState = SessionState.Disconnected;
  private _lastError: SmsError | undefined;
  private _dispatcher: JsonRpcDispatcher | undefined;
  private _socket: Socket | undefined;
  private readonly _socketPath: string;
  private readonly _connectTimeoutMs: number;
  private readonly _userAgent: string;
  private readonly _client: ClientInfo | undefined;
  private readonly _onElevationRequired: ElevationHandler | undefined;

  constructor(options?: SessionOptions) {
    super();
    this._userAgent = options?.userAgent ?? 'sms-api';
    this._client = options?.client;
    this._socketPath = options?.socketPath ?? IPC.defaultSocket;
    this._connectTimeoutMs = options?.connectTimeoutMs ?? 5000;
    this._onElevationRequired = options?.onElevationRequired;
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

  get userAgent(): string {
    return this._userAgent;
  }

  get client(): ClientInfo | undefined {
    return this._client;
  }

  /** Internal – used by Packages and Settings to access the dispatcher. */
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
      this._dispatcher = new JsonRpcDispatcher(socket, {
        ...(this._userAgent ? { userAgent: this._userAgent } : {}),
        ...(this._client ? { client: this._client } : {}),
        ...(this._onElevationRequired
          ? { onElevationRequired: this._onElevationRequired }
          : {})
      });

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

const SERVICE_EXECUTABLE =
  process.platform === 'win32'
    ? 'QtSoftwareManagementService.exe'
    : 'QtSoftwareManagementService';

/** The `--start-server` mode of the elevated helper. */
const ELEVATED_HELPER_MODE = 'PRODUCTION';

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

  /**
   * The service executable, looked up in the order the protocol defines:
   * the explicit path, then `serviceInstallPath` of QtCompany.ini, then the
   * directory of the running executable.
   */
  serviceBinaryPath(): string | undefined {
    return this.resolveServiceBin();
  }

  /**
   * Start the elevated helper for a `service/elevation-required` request.
   * Shows the authorization dialog of the operating system. Resolves `true`
   * when the helper was started, `false` when the
   * user refused or the start failed. Use it as the `onElevationRequired`
   * of a `Session`.
   */
  async startElevatedHelper(request: ElevationRequest): Promise<boolean> {
    const binPath = this.resolveServiceBin();
    if (!binPath) {
      this.setError({
        category: ErrorCategory.ServiceLifecycle,
        code: ErrorCode.ServiceNotFound,
        message: 'Cannot find service executable for the elevated helper'
      });
      return false;
    }

    try {
      let exitCode: number | null;
      switch (process.platform) {
        case 'linux':
          exitCode = await ServiceLauncher.runToExit('pkexec', [
            binPath,
            '--start-server',
            ServiceLauncher.elevatedHelperArgument(request, currentUserId())
          ]);
          break;
        case 'darwin':
          exitCode = await ServiceLauncher.runToExit('osascript', [
            '-e',
            ServiceLauncher.macAdministratorScript(binPath, request)
          ]);
          break;
        case 'win32':
          exitCode = await ServiceLauncher.runToExit('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            ServiceLauncher.windowsRunAsScript(binPath, request)
          ]);
          break;
        default:
          this.setError({
            category: ErrorCategory.Authorization,
            code: ErrorCode.ElevatedProcessFailed,
            message: `Elevation is not supported on ${process.platform}`
          });
          return false;
      }
      if (exitCode === 0) {
        this._lastError = undefined;
        return true;
      }
      this.setError({
        category: ErrorCategory.Authorization,
        code: ErrorCode.ElevatedProcessFailed,
        message: `The elevated helper was not started (exit code ${String(exitCode)})`
      });
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setError({
        category: ErrorCategory.Authorization,
        code: ErrorCode.ElevatedProcessFailed,
        message: `Cannot start the elevated helper: ${msg}`
      });
      return false;
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /** `PRODUCTION,<elevatedSocketName>,<authorizationKey>,<requester>` */
  private static elevatedHelperArgument(
    request: ElevationRequest,
    requester: string
  ): string {
    return [
      ELEVATED_HELPER_MODE,
      request.elevatedSocketName,
      request.authorizationKey,
      requester
    ].join(',');
  }

  /**
   * `do shell script ... with administrator privileges` runs the command
   * through Authorization Services, which keeps the real user ID that the
   * helper reads. The helper is started in the background so the script
   * returns as soon as the user has authorized it.
   */
  private static macAdministratorScript(
    binPath: string,
    request: ElevationRequest
  ): string {
    const command = [
      binPath,
      '--start-server',
      ServiceLauncher.elevatedHelperArgument(request, currentUserId())
    ]
      .map(shellQuote)
      .join(' ');
    const script = `${command} >/dev/null 2>&1 &`;
    return `do shell script ${appleScriptString(script)} with administrator privileges`;
  }

  /**
   * `Start-Process -Verb RunAs` is `ShellExecuteEx` with the `runas` verb.
   * The requester is the SID of the current user, read in the same script.
   * `Start-Process` throws when the user refuses the UAC dialog, which
   * ends the script with a non-zero exit code.
   */
  private static windowsRunAsScript(
    binPath: string,
    request: ElevationRequest
  ): string {
    const prefix = ServiceLauncher.elevatedHelperArgument(request, '');
    return [
      "$ErrorActionPreference = 'Stop'",
      '$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
      `Start-Process -FilePath ${powershellString(binPath)} ` +
        `-ArgumentList @('--start-server', (${powershellString(prefix)} + $sid)) ` +
        '-Verb RunAs -WindowStyle Hidden',
      'exit 0'
    ].join('; ');
  }

  private static async runToExit(
    command: string,
    args: string[]
  ): Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = spawn(command, args, {
          stdio: 'ignore',
          windowsHide: true
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      child.once('error', (err: Error) => {
        reject(err);
      });
      child.once('exit', (code) => {
        resolve(code);
      });
    });
  }

  private resolveServiceBin(): string | undefined {
    // 1. Explicit path
    if (this._serviceBin && fs.existsSync(this._serviceBin)) {
      return this._serviceBin;
    }

    // 2. serviceInstallPath from QtCompany.ini (written by the bootstrap)
    const iniPath = qtCompanyIniPath();
    try {
      const content = fs.readFileSync(iniPath, 'utf-8');
      const match = /^serviceInstallPath\s*=\s*(.+)$/m.exec(content);
      if (match?.[1]) {
        const serviceDir = match[1].trim();
        const iniCandidate = path.join(serviceDir, SERVICE_EXECUTABLE);
        if (fs.existsSync(iniCandidate)) {
          return iniCandidate;
        }
      }
    } catch {
      // QtCompany.ini doesn't exist or isn't readable — continue
    }

    // 3. Next to the current process executable
    const exeDir = path.dirname(process.execPath);
    const candidate = path.join(exeDir, SERVICE_EXECUTABLE);
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
      const isWin = process.platform === 'win32';
      // The service writes offline installers to its working directory.
      this._serviceProcess = spawn(binPath, ['--no-console-log'], {
        cwd: path.dirname(binPath),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: !isWin,
        windowsHide: true
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

/** Numeric user ID on Linux and macOS, the `<requester>` of the helper. */
function currentUserId(): string {
  const uid = process.getuid?.();
  return uid === undefined ? '' : String(uid);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function powershellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// ── Packages ─────────────────────────────────────────────────────────────────

export class Packages {
  private readonly session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  // ── Operations ───────────────────────────────────────────────────────────

  /**
   * `packages/install`. Agreements answered in `options` are not asked
   * again; the service asks the others with `service/question`, answered
   * through `callbacks.onPrompt`.
   */
  async install(
    packages: PackageReference[],
    options?: InstallOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    const params: Record<string, unknown> = {
      packages: packages.map(formatPackageRef)
    };
    if (options?.preAnsweredAgreements) {
      params.answers = options.preAnsweredAgreements.map((a) => ({
        id: a.id,
        replyChoice: a.answer
      }));
    }
    return this.performOperation(IPC.methods.install, params, callbacks);
  }

  /**
   * `packages/create-offline`. The installer is written to the working
   * directory of the service.
   */
  async createOffline(
    packages: PackageReference[],
    options?: CreateOfflineOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    const params: Record<string, unknown> = {};
    if (packages.length > 0) {
      params.packages = packages.map(formatPackageRef);
    }
    if (options?.vendorConfig) {
      params.vendorConfig = options.vendorConfig;
    }
    return this.performOperation(IPC.methods.createOffline, params, callbacks);
  }

  /** Planned. The service answers with error 12000. */
  async download(
    packages: PackageReference[],
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    return this.performOperation(
      IPC.methods.download,
      { packages: packages.map(formatPackageRef) },
      callbacks
    );
  }

  /** Planned. The service answers with error 12000. */
  async update(
    packages?: PackageReference[],
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    const params: Record<string, unknown> = {};
    if (packages && packages.length > 0) {
      params.packages = packages.map(formatPackageRef);
    }
    return this.performOperation(IPC.methods.update, params, callbacks);
  }

  /** Planned. The service answers with error 12000. */
  async remove(
    packages: PackageReference[],
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    return this.performOperation(
      IPC.methods.remove,
      { packages: packages.map(formatPackageRef) },
      callbacks
    );
  }

  /** Planned. The service answers with error 12000. */
  async purge(callbacks?: JobCallbacks): Promise<PackageOperationResult> {
    return this.performOperation(IPC.methods.purge, {}, callbacks);
  }

  /**
   * `packages/cancel`. Cancels the running download, for all clients. Has
   * no effect once the service extracts or installs files. The cancelled
   * request then ends with an error response.
   */
  async cancel(callbacks?: JobCallbacks): Promise<void> {
    await callService(
      this.session,
      IPC.methods.cancel,
      {},
      () => undefined,
      callbacks
    );
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /**
   * `packages/requirements`. The license agreements and the unsatisfied
   * rules of the packages, to show before `packages/install`.
   */
  async fetchRequirements(
    packages: PackageReference[],
    callbacks?: JobCallbacks
  ): Promise<PackageRequirements> {
    return callService<PackageRequirements>(
      this.session,
      IPC.methods.fetchRequirements,
      { packages: packages.map(formatPackageRef) },
      (result) => {
        const obj = (result as Record<string, unknown> | null) ?? {};
        const agreements = Array.isArray(obj.agreements)
          ? (obj.agreements as Record<string, unknown>[])
          : [];
        const rules = Array.isArray(obj.unsatisfiedRules)
          ? (obj.unsatisfiedRules as Record<string, unknown>[])
          : [];
        return {
          licenseAgreements: agreements.map(parseLicenseAgreement),
          unsatisfiedRules: rules.map(parseUnsatisfiedRule)
        };
      },
      callbacks
    );
  }

  /**
   * `packages/search`. Filters that are not given use the defaults of the
   * service: `packageType` alias, `packagePresentation` module_group, and
   * the host OS and architecture of the service.
   */
  async searchAvailablePackages(
    filters?: PackageFilters,
    callbacks?: JobCallbacks
  ): Promise<PackageData[]> {
    return callService<PackageData[]>(
      this.session,
      IPC.methods.search,
      { filters: filtersToJson(filters) },
      parsePackageList,
      callbacks
    );
  }

  /** `packages/list`. The installed packages. */
  async listInstalledPackages(
    callbacks?: JobCallbacks
  ): Promise<PackageData[]> {
    return callService<PackageData[]>(
      this.session,
      IPC.methods.listInstalled,
      {},
      parsePackageList,
      callbacks
    );
  }

  /** Planned. The service answers with error 12000. */
  async listAvailableUpdates(
    filters?: PackageFilters,
    callbacks?: JobCallbacks
  ): Promise<PackageUpdate[]> {
    return callService<PackageUpdate[]>(
      this.session,
      IPC.methods.listUpdates,
      { filters: filtersToJson(filters) },
      (result) => {
        const obj = (result as Record<string, unknown> | null) ?? {};
        const packages = Array.isArray(obj.packages)
          ? (obj.packages as Record<string, unknown>[])
          : [];
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

  /** Planned. The service answers with error 12000. */
  async showPackageInfo(
    pkg: PackageReference,
    callbacks?: JobCallbacks
  ): Promise<PackageData> {
    return callService<PackageData>(
      this.session,
      IPC.methods.showInfo,
      { package: { id: pkg.id, version: pkg.version ?? '' } },
      (result) => {
        const obj = (result as Record<string, unknown> | null) ?? {};
        const pkgObj =
          (obj.package as Record<string, unknown> | undefined) ?? {};
        return parsePackageData(pkgObj);
      },
      callbacks
    );
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async performOperation(
    method: string,
    params: Record<string, unknown>,
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    return callService(
      this.session,
      method,
      params,
      parseOperationResult,
      callbacks
    );
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export class Settings {
  private readonly session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  /**
   * `settings/set` for one key. Values are always strings, also for numbers
   * and booleans. Temporary values are kept until the service stops.
   */
  async setSetting(
    key: string,
    value: string,
    persistence: SettingsPersistence = SettingsPersistence.Temporary,
    callbacks?: JobCallbacks
  ): Promise<string> {
    const params = [{ key, value, type: persistence }];

    return callService<string>(
      this.session,
      IPC.methods.setSetting,
      params,
      (result) => {
        const obj = (result as Record<string, unknown> | null) ?? {};
        return stringField(obj, 'message');
      },
      callbacks
    );
  }

  /**
   * `settings/get` for one key. Resolves `undefined` when the key has no
   * value: the service leaves such keys out of the result.
   */
  async getSetting(
    key: string,
    callbacks?: JobCallbacks
  ): Promise<string | undefined> {
    const params = [key];

    return callService<string | undefined>(
      this.session,
      IPC.methods.getSetting,
      params,
      (result) => {
        const obj = (result as Record<string, unknown> | null) ?? {};
        const value = obj[key];
        return typeof value === 'string' ? value : undefined;
      },
      callbacks
    );
  }

  /** The installation directory, or `undefined` when none is set. */
  async getInstallationPath(
    callbacks?: JobCallbacks
  ): Promise<string | undefined> {
    return this.getSetting(IPC.settingsKeys.installationPath, callbacks);
  }

  /**
   * Set the installation directory. Only a persistent value takes effect,
   * so it is always saved to disk.
   */
  async setInstallationPath(
    InsPath: string,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.setSetting(
      IPC.settingsKeys.installationPath,
      InsPath,
      SettingsPersistence.Persistent,
      callbacks
    );
  }

  /**
   * The consent to send usage statistics. `undefined` means the user has
   * not decided yet.
   */
  async getTelemetry(callbacks?: JobCallbacks): Promise<boolean | undefined> {
    const value = await this.getSetting(IPC.settingsKeys.telemetry, callbacks);
    if (value === undefined) {
      return undefined;
    }
    return value === 'true';
  }

  /**
   * Set the consent to send usage statistics. The service reads it when it
   * starts, so the value is saved to disk by default.
   */
  async setTelemetry(
    enabled: boolean,
    persistence: SettingsPersistence = SettingsPersistence.Persistent,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.setSetting(
      IPC.settingsKeys.telemetry,
      enabled ? 'true' : 'false',
      persistence,
      callbacks
    );
  }
}
