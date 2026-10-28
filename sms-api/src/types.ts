/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

// ── Error types ──────────────────────────────────────────────────────────────

/**
 * Error area. The value is the thousands digit of the error code, so an
 * unknown code still maps to its area.
 */
export enum ErrorCategory {
  None = 0,
  ServiceConnection = 1,
  ServiceProtocol = 2,
  Authentication = 3,
  Authorization = 4,
  Package = 5,
  Network = 6,
  Cache = 7,
  Filesystem = 8,
  Configuration = 9,
  UserCanceled = 10,
  ServiceLifecycle = 11,
  Service = 12,
  Unknown = 13
}

export enum ErrorCode {
  None = 0,

  // Connection [1000-1999], client library only
  ConnectionFailed = 1000,
  ConnectionTimeout = 1001,
  InvalidState = 1002,
  SocketError = 1003,

  // Protocol [2000-2999]
  UnknownCommand = 2000,
  InvalidArguments = 2001,
  InvalidResponseFormat = 2002,
  InvalidRequestFormat = 2003,
  UnknownResponseType = 2004,

  // Authentication [3000-3999]
  MissingToken = 3000,

  // Authorization [4000-4999]
  ElevatedProcessFailed = 4000,

  // Package [5000-5999]
  NoSuchPackage = 5000,
  InvalidMetadata = 5001,
  UnsatisfiedRequirements = 5002,

  // Network [6000-6999]
  HostNotFound = 6000,
  NetworkError = 6001,
  SslVerifyError = 6002,
  ProxyError = 6003,

  // Cache [7000-7999]
  InvalidCache = 7000,

  // Filesystem [8000-8999]
  NotEnoughDiskSpace = 8000,
  OperationNotPermitted = 8001,

  // Configuration [9000-9999]
  InvalidManagedDirectory = 9000,

  // Cancellation [10000-10999]
  UserCancelled = 10000,

  // Service lifecycle [11000-11999], client library only
  ServiceNotFound = 11000,
  ServiceStartFailed = 11001,
  ServiceStartTimeout = 11002,
  ServiceStopFailed = 11003,

  // Service [12000-12999]
  InternalError = 12000,

  // Unknown
  UnknownError = 13000
}

export interface SmsError {
  readonly category: ErrorCategory;
  readonly code: ErrorCode;
  readonly message: string;
}

/**
 * The error area of a code. Codes outside the known ranges are `Unknown`, as
 * the compatibility rules of the protocol ask for.
 */
export function errorCategoryForCode(code: number): ErrorCategory {
  if (!Number.isFinite(code) || code < 0) {
    return ErrorCategory.Unknown;
  }
  const area = Math.floor(code / 1000);
  return typeof ErrorCategory[area] === 'string'
    ? (area as ErrorCategory)
    : ErrorCategory.Unknown;
}

/**
 * An error response from the service, or a transport failure, as a thrown
 * error. `code` lets callers tell a cancelled install (10000) from a failed
 * one, or a method an older service does not know (2000) from a crash.
 */
export class SmsServiceError extends Error implements SmsError {
  readonly category: ErrorCategory;
  readonly code: ErrorCode;

  constructor(error: SmsError) {
    super(error.message);
    this.name = 'SmsServiceError';
    this.category = error.category;
    this.code = error.code;
  }
}

// ── Client identity ──────────────────────────────────────────────────────────

/**
 * Describes the client application to the service, which uses it for usage
 * statistics. Sent on every request as `client`.
 */
export interface ClientInfo {
  readonly author: string;
  readonly name: string;
  readonly version: string;
}

// ── Package types ────────────────────────────────────────────────────────────

export interface PackageReference {
  readonly id: string;
  readonly version?: string;
}

export enum InstallState {
  Uninstalled = 0,
  Installed = 1,
  UpdateAvailable = 2
}

export interface PackageData {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  /** Names to show in a user interface. Empty when the backend sends none. */
  readonly displayNames: string[];
  readonly author: string;
  readonly description: string;
  readonly license: string;
  readonly product: string;
  readonly productId: string;
  readonly productVersion: string;
  readonly productName: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  /** `packages/list` only. The service currently always reports 0. */
  readonly installState: InstallState;
}

export interface PackageUpdate {
  readonly newPackage: PackageData;
  readonly oldPackage: PackageData;
}

/** An application or link the client can offer to open after an install. */
export interface LaunchItem {
  readonly order: number;
  /** Path of an executable, or a URL. */
  readonly uri: string;
  /** `executable` or `link`. */
  readonly type: string;
  readonly args: string[];
}

/** Result of a package operation such as `packages/install`. */
export interface PackageOperationResult {
  readonly message: string;
  /** Sorted by `order`. Only `packages/install` fills it. */
  readonly launch: LaunchItem[];
}

// ── Filters & Options ────────────────────────────────────────────────────────

export interface PackageFilters {
  hostOs?: string;
  targetOs?: string;
  hostArch?: string;
  targetArch?: string;
  compiler?: string;
  packageType?: string;
  packagePresentation?: string;
  packageVersion?: string;
  packageId?: string;
  author?: string;
  product?: string;
  module?: string;
  [key: string]: string | undefined;
}

export interface InstallOptions {
  /**
   * License agreements answered in advance, from `packages/requirements`.
   * The service then does not ask `service/question` for them.
   */
  preAnsweredAgreements?: LicenseAnswer[];
}

export interface CreateOfflineOptions {
  /** Absolute path of a vendor configuration file for the installer. */
  vendorConfig?: string;
}

// ── Requirements types ───────────────────────────────────────────────────────

export interface LicenseAgreement {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  /** Format of `text`, for example `text` or `md`. Empty for offline installers. */
  readonly format: string;
  /** Send this exact text as the answer to accept. */
  readonly acceptText: string;
  readonly rejectText: string;
}

export interface UnsatisfiedRule {
  readonly ruleId: string;
  /** `visibility`: no access to the package. `installability`: a condition must be met. */
  readonly ruleType: string;
  /** `la_accepted` can be resolved with license answers. Others block the install. */
  readonly conditionType: string;
  readonly conditionId: string;
  readonly packages: PackageReference[];
  readonly userMessage: string;
  readonly isResolvableByUser: boolean;
}

export interface PackageRequirements {
  readonly licenseAgreements: LicenseAgreement[];
  readonly unsatisfiedRules: UnsatisfiedRule[];
}

export interface LicenseAnswer {
  readonly id: string;
  /** The `acceptText` of the agreement accepts it. Anything else rejects it. */
  readonly answer: string;
}

// ── User Prompt ──────────────────────────────────────────────────────────────

export enum UserPromptType {
  Choice = 'Choice',
  Text = 'Text',
  DirectoryPath = 'DirectoryPath',
  FilePath = 'FilePath'
}

export interface UserPrompt {
  readonly type: UserPromptType;
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly defaultAnswer: string;
  readonly choices: string[];
  readonly placeholderText: string;
}

export type UserPromptReply =
  | { kind: 'choice'; choice: string }
  | { kind: 'text'; text: string }
  | { kind: 'cancel' };

// ── Elevation ────────────────────────────────────────────────────────────────

/**
 * A `service/elevation-required` request. The client starts the elevated
 * helper and reports whether it is ready.
 */
export interface ElevationRequest {
  /** Socket the helper must listen on. */
  readonly elevatedSocketName: string;
  /** Secret the helper uses to authenticate the service. Never log it. */
  readonly authorizationKey: string;
  /** Explanation to show to the user. Empty when the service sent none. */
  readonly reason: string;
}

/** Resolves `true` when the elevated helper was started. */
export type ElevationHandler = (request: ElevationRequest) => Promise<boolean>;

// ── Job / Progress ───────────────────────────────────────────────────────────

export enum JobStatus {
  Pending = 'Pending',
  Running = 'Running',
  Paused = 'Paused',
  Finished = 'Finished',
  Failed = 'Failed',
  Canceled = 'Canceled'
}

/** Phase of an operation. Empty or unknown values are reported as `Download`. */
export enum ProgressType {
  Download = 'download',
  Install = 'install',
  Remove = 'remove'
}

export interface ProgressInfo {
  readonly type: ProgressType;
  /** Progress in percent, 0 to 100. */
  readonly progress: number;
  readonly message?: string;
}

export interface MessageInfo {
  readonly message: string;
}

export interface JobCallbacks {
  onProgress?: (info: ProgressInfo) => void;
  onMessage?: (info: MessageInfo) => void;
  onPrompt?: (prompt: UserPrompt) => Promise<UserPromptReply>;
}

// ── Session state ────────────────────────────────────────────────────────────

export enum SessionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Error = 'Error'
}

// ── Logging ──────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCallback = (level: LogLevel, message: string) => void;

// ── Settings types ────────────────────────────────────────────────────────────

/**
 * Persistence tier for a settings entry.
 * Mirrors C++ `SettingsType` in ipcconstants.h.
 */
export enum SettingsPersistence {
  /** Session-scoped; lost when the service exits. */
  Temporary = 0,
  /** Written to disk; survives service restarts. */
  Persistent = 1
}

// ── IPC Constants ────────────────────────────────────────────────────────────

import * as os from 'os';
import * as path from 'path';

/**
 * Default IPC socket/pipe path.
 * Qt's QLocalServer uses named pipes on Windows (`\\.\pipe\<name>`)
 * and Unix domain sockets in the temp directory on Linux/macOS.
 */
const defaultSocketPath =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\qtclient_socket'
    : path.join(os.tmpdir(), 'qtclient_socket');

export const IPC = {
  defaultSocket: defaultSocketPath,

  /** Client requests. `planned` ones answer with error 12000 for now. */
  methods: {
    install: 'packages/install',
    createOffline: 'packages/create-offline',
    fetchRequirements: 'packages/requirements',
    search: 'packages/search',
    listInstalled: 'packages/list',
    cancel: 'packages/cancel',
    setSetting: 'settings/set',
    getSetting: 'settings/get',
    // Planned
    download: 'packages/download',
    update: 'packages/update',
    remove: 'packages/remove',
    purge: 'packages/purge',
    listUpdates: 'packages/updates',
    showInfo: 'packages/info'
  },

  /** Service notifications. They carry the client request id in `params.id`. */
  notifications: {
    progress: 'service/progress',
    message: 'service/message'
  },

  /** Service requests. The client must respond. */
  requests: {
    question: 'service/question',
    elevationRequired: 'service/elevation-required'
  },

  settingsKeys: {
    installationPath: 'installationPath',
    telemetry: 'telemetry',
    idleShutdownTimeoutSecs: 'idleShutdownTimeoutSecs'
  },

  nameVersionSeparator: '@'
} as const;
