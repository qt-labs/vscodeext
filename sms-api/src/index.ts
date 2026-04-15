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
  SessionState,
  IPC
} from './types';
export type {
  SmsError,
  PackageReference,
  PackageData,
  PackageUpdate,
  PackageFilters,
  PackageRequestOptions,
  UserPrompt,
  UserPromptReply,
  ProgressInfo,
  MessageInfo,
  JobCallbacks
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
export { Session, ServiceLauncher, Packages } from './client';
export type {
  SessionEvents,
  ServiceLauncherOptions,
  ServiceLauncherEvents
} from './client';
