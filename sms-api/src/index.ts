/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

// Types & enums
export {
  ErrorCategory,
  ErrorCode,
  InstallState,
  UserPromptType,
  JobStatus,
  ProgressType,
  SettingsPersistence,
  SessionState,
  AuthState,
  LoginError,
  IPC
} from './types';
export type {
  SmsError,
  PackageReference,
  PackageData,
  PackageUpdate,
  PackageFilters,
  PackageRequestOptions,
  LicenseAgreement,
  UnsatisfiedRule,
  PackageRequirements,
  LicenseAnswer,
  UserPrompt,
  UserPromptReply,
  ProgressInfo,
  MessageInfo,
  JobCallbacks,
  AuthCredentials
} from './types';

// Transport (for advanced / testing use)
export {
  PacketReader,
  encodePacket,
  encodeJsonPacket,
  connectSocket
} from './transport';
export type { DecodedPacket, TransportOptions } from './transport';

// JSON-RPC dispatcher (for advanced use)
export { JsonRpcDispatcher } from './jsonrpc';

// Public API
export { Session, ServiceLauncher, Packages, Cache, Settings } from './client';
export type {
  SessionEvents,
  ServiceLauncherOptions,
  ServiceLauncherEvents
} from './client';

// Authentication
export { QtAccountStorage, QtAccount } from './qt-account';
export type { QtAccountEvents, LogLevel, LogCallback } from './qt-account';
