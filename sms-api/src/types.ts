/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

// ── Error types ──────────────────────────────────────────────────────────────

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
  Service = 11,
  Unknown = 12
}

export enum ErrorCode {
  None = 0,

  // Connection [1000-1999]
  ConnectionFailed = 1000,
  ConnectionTimeout = 1001,
  InvalidState = 1002,
  SocketError = 1003,

  // Protocol [2000-2999]
  UnknownCommand = 2000,
  InvalidArguments = 2001,
  InvalidResponseFormat = 2002,
  UnknownResponseType = 2003,

  // Authentication [3000-3999]
  MissingToken = 3000,

  // Authorization [4000-4999]
  ElevatedProcessFailed = 4000,

  // Package [5000-5999]
  NoSuchPackage = 5000,
  InvalidMetadata = 5001,

  // Network [6000-6999]
  HostNotFound = 6000,
  SslVerifyError = 6001,
  ProxyError = 6002,

  // Cache [7000-7999]
  InvalidCache = 7000,

  // Filesystem [8000-8999]
  NotEnoughDiskSpace = 8000,
  OperationNotPermitted = 8001,

  // Configuration [9000-9999]
  InvalidManagedDirectory = 9000,

  // Cancellation [10000-10999]
  UserCancelled = 10000,

  // Service [11000-11999]
  InternalError = 11000,

  // Unknown
  UnknownError = 12000
}

export interface SmsError {
  readonly category: ErrorCategory;
  readonly code: ErrorCode;
  readonly message: string;
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
  readonly author: string;
  readonly description: string;
  readonly license: string;
  readonly product: string;
  readonly productId: string;
  readonly productVersion: string;
  readonly productName: string;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly installState: InstallState;
}

export interface PackageUpdate {
  readonly newPackage: PackageData;
  readonly oldPackage: PackageData;
}

// ── Filters & Options ────────────────────────────────────────────────────────

export interface PackageFilters {
  hostOs?: string;
  targetOs?: string;
  hostArch?: string;
  targetArch?: string;
  compiler?: string;
  version?: string;
  author?: string;
  product?: string;
  module?: string;
  [key: string]: string | undefined;
}

export interface PackageRequestOptions {
  timeoutMs?: number;
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
}

export type UserPromptReply =
  | { kind: 'choice'; choice: string }
  | { kind: 'text'; text: string }
  | { kind: 'cancel' };

// ── Job / Progress ───────────────────────────────────────────────────────────

export enum JobStatus {
  Pending = 'Pending',
  Running = 'Running',
  Paused = 'Paused',
  Finished = 'Finished',
  Failed = 'Failed',
  Canceled = 'Canceled'
}

export interface ProgressInfo {
  readonly progress: number; // 0.0 – 1.0
}

export interface JobCallbacks {
  onProgress?: (info: ProgressInfo) => void;
  onPrompt?: (prompt: UserPrompt) => Promise<UserPromptReply>;
}

// ── Session state ────────────────────────────────────────────────────────────

export enum SessionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Error = 'Error'
}

// ── IPC Constants ────────────────────────────────────────────────────────────

export const IPC = {
  defaultSocket: 'qtclient_socket',

  methods: {
    install: 'packages/install',
    download: 'packages/download',
    update: 'packages/update',
    remove: 'packages/remove',
    purge: 'packages/purge',
    listInstalled: 'packages/list',
    search: 'packages/search',
    listUpdates: 'packages/updates',
    showInfo: 'packages/info'
  },

  notifications: {
    progress: 'service/progress',
    question: 'service/question'
  },

  nameVersionSeparator: '@'
} as const;
