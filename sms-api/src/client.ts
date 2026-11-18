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
  type Installation,
  type InstallationTarget,
  type InstalledPackages,
  type RemoveOptions,
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
  InstallReason,
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

/**
 * The `installRoot` and `workingDirectory` fields of a request. Empty
 * fields are left out, so that the service sees only what the caller named.
 */
function targetToParams(target: InstallationTarget): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (target.installRoot) {
    params.installRoot = target.installRoot;
  }
  if (target.workingDirectory) {
    params.workingDirectory = target.workingDirectory;
  }
  return params;
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
  // Like the C++ client: anything but `automatic` is manual.
  const installReason =
    obj.installReason === InstallReason.Automatic
      ? InstallReason.Automatic
      : InstallReason.Manual;
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
    packageType: stringField(obj, 'packageType'),
    compressedSize: numberField(obj, 'compressedSize'),
    uncompressedSize: numberField(obj, 'uncompressedSize'),
    installState,
    installReason
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
    launch: parseLaunchItems(obj.launch),
    remainingInstallations: parseInstallations(obj.remainingInstallations)
  };
}

function parsePackageList(result: unknown): PackageData[] {
  const obj = (result as Record<string, unknown> | null) ?? {};
  const packages = Array.isArray(obj.packages)
    ? (obj.packages as Record<string, unknown>[])
    : [];
  return packages.map(parsePackageData);
}

function parseInstalledPackages(result: unknown): InstalledPackages {
  const obj = (result as Record<string, unknown> | null) ?? {};
  return {
    installRoot: stringField(obj, 'installRoot'),
    packages: parsePackageList(result)
  };
}

function parseInstallations(raw: unknown): Installation[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null
    )
    .map((entry) => ({
      installationPath: stringField(entry, 'installationPath'),
      packages: numberField(entry, 'packages')
    }));
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
  /** Identifies the application to the service for usage statistics. */
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
  private readonly _client: ClientInfo | undefined;
  private readonly _onElevationRequired: ElevationHandler | undefined;

  constructor(options?: SessionOptions) {
    super();
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
   * `packages/install`. Installs the packages into the installation that
   * `target` names; a new installation is created by naming its directory
   * as `installRoot`. Agreements answered in `options` are not asked again;
   * the service asks the others with `service/question`, answered through
   * `callbacks.onPrompt`. Fails with error 9001 when `target` names no
   * installation and with 9000 when the directory cannot be installed into.
   */
  async install(
    target: InstallationTarget,
    packages: PackageReference[],
    options?: InstallOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    const params: Record<string, unknown> = {
      ...targetToParams(target),
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

  /**
   * `packages/remove`. Removes the packages from the installation that
   * `target` names. The packages that depend on a removed package are
   * removed too. With `options.autoRemove`, the dependencies that nothing
   * needs any more are removed as well. When the removal takes packages
   * that were not named, the service asks the `removal_confirmation`
   * question (see `IPC.questionIds`) through `callbacks.onPrompt`, unless
   * `options.confirmRemoval` says the user has confirmed already. A
   * reference without a version must match exactly one installed package.
   * Fails with error 10000 when the removal is not confirmed, 5000 when a
   * package is not installed in the installation, and 9001 when `target`
   * names no installation.
   */
  async remove(
    target: InstallationTarget,
    packages: PackageReference[],
    options?: RemoveOptions,
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    const params: Record<string, unknown> = {
      ...targetToParams(target),
      packages: packages.map(formatPackageRef)
    };
    Packages.addRemoveOptions(params, options);
    return this.performOperation(IPC.methods.remove, params, callbacks);
  }

  /**
   * `packages/remove` without packages: removes the packages of the
   * installation that `target` names that were installed only as
   * dependencies and that nothing needs any more. Finding nothing to remove
   * is a success, the message says so. The confirmation question is asked
   * as for `remove`.
   */
  async removeOrphans(
    target: InstallationTarget,
    options?: Omit<RemoveOptions, 'autoRemove'>,
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    const params: Record<string, unknown> = targetToParams(target);
    Packages.addRemoveOptions(params, { ...options, autoRemove: true });
    return this.performOperation(IPC.methods.remove, params, callbacks);
  }

  /**
   * `packages/purge`. Removes the complete installation that `target`
   * names: all its packages, then the directory with everything in it,
   * also files that belong to no package. The service does not ask for a
   * confirmation, so ask the user first. The result lists the remaining
   * installations. Fails with error 5000 when the directory is not a
   * recorded installation.
   */
  async purge(
    target: InstallationTarget,
    callbacks?: JobCallbacks
  ): Promise<PackageOperationResult> {
    return this.performOperation(
      IPC.methods.purge,
      targetToParams(target),
      callbacks
    );
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
   * rules of the packages, to show before `packages/install`. `target` is
   * the installation the install will work on: the service checks it first,
   * so that the user is not asked to accept agreements for an installation
   * that would fail.
   */
  async fetchRequirements(
    target: InstallationTarget,
    packages: PackageReference[],
    callbacks?: JobCallbacks
  ): Promise<PackageRequirements> {
    return callService<PackageRequirements>(
      this.session,
      IPC.methods.fetchRequirements,
      {
        ...targetToParams(target),
        packages: packages.map(formatPackageRef)
      },
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
   * the host OS and architecture of the service. When `target` names an
   * installation, the packages installed in it have `installState`
   * `Installed`. An empty target does not fail the search.
   */
  async searchAvailablePackages(
    target: InstallationTarget,
    filters?: PackageFilters,
    callbacks?: JobCallbacks
  ): Promise<PackageData[]> {
    return callService<PackageData[]>(
      this.session,
      IPC.methods.search,
      { ...targetToParams(target), filters: filtersToJson(filters) },
      parsePackageList,
      callbacks
    );
  }

  /**
   * `packages/list`. The packages installed in the installation that
   * `target` names. Only the `packageType` filter is used, for example
   * `{ packageType: 'alias' }` lists the alias packages alone. Fails with
   * error 9001 when `target` names no installation.
   */
  async listInstalledPackages(
    target: InstallationTarget,
    filters?: PackageFilters,
    callbacks?: JobCallbacks
  ): Promise<InstalledPackages> {
    return callService<InstalledPackages>(
      this.session,
      IPC.methods.listInstalled,
      { ...targetToParams(target), filters: filtersToJson(filters) },
      parseInstalledPackages,
      callbacks
    );
  }

  /**
   * `packages/installations`. The installations the service records,
   * sorted by directory. Empty when nothing is installed.
   */
  async listInstallations(callbacks?: JobCallbacks): Promise<Installation[]> {
    return callService<Installation[]>(
      this.session,
      IPC.methods.listInstallations,
      {},
      (result) => {
        const obj = (result as Record<string, unknown> | null) ?? {};
        return parseInstallations(obj.installations);
      },
      callbacks
    );
  }

  /**
   * `packages/validate-root`. Checks that packages can be installed into
   * the installation that `target` names, without storing anything, and
   * resolves the installation root as the service resolved it. Fails with
   * error 9001 when `target` names no installation and with 9000 when the
   * directory cannot be installed into.
   */
  async validateInstallRoot(
    target: InstallationTarget,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return callService<string>(
      this.session,
      IPC.methods.validateRoot,
      targetToParams(target),
      (result) => {
        const obj = (result as Record<string, unknown> | null) ?? {};
        return stringField(obj, 'installRoot');
      },
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

  /**
   * The removal options are sent only when they are true, so that a
   * service reading the params cannot mistake the default for a request.
   */
  private static addRemoveOptions(
    params: Record<string, unknown>,
    options: RemoveOptions | undefined
  ): void {
    if (options?.autoRemove) {
      params.autoRemove = true;
    }
    if (options?.confirmRemoval) {
      params.confirmRemoval = true;
    }
  }

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

  /**
   * The stored `installationPath` setting, or `undefined` when none is set.
   * No request of the service uses it: each request names the installation
   * it works on (see `InstallationTarget`).
   */
  async getInstallationPath(
    callbacks?: JobCallbacks
  ): Promise<string | undefined> {
    return this.getSetting(IPC.settingsKeys.installationPath, callbacks);
  }

  /**
   * Store the `installationPath` setting. The service only stores it, it
   * does not check it and no request uses it: name the installation in each
   * request instead (see `InstallationTarget`).
   */
  async setInstallationPath(
    installationPath: string,
    callbacks?: JobCallbacks
  ): Promise<string> {
    return this.setSetting(
      IPC.settingsKeys.installationPath,
      installationPath,
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
