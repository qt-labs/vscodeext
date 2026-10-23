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
export { Session, ServiceLauncher, Packages, Cache, Settings } from './client';
export type {
  SessionEvents,
  ServiceLauncherOptions,
  ServiceLauncherEvents
} from './client';

// Settings file locations
export {
  genericDataLocation,
  qtIniPath,
  qtCompanyIniPath,
  legacyQtAccountIniPath
} from './paths';
export type { LogLevel, LogCallback } from './types';

// QSettings compatible INI codec
export { IniDocument } from './ini';

// Qt account authentication (OIDC in the browser, tokens in Qt.ini)
export {
  QtCredentialStorage,
  emptyOidcTokens,
  OIDC_EXPIRY_MARGIN_SECS
} from './credential-storage';
export type {
  OidcTokens,
  QtCredentialStorageOptions
} from './credential-storage';
export {
  OidcAuthenticator,
  OidcAuthError,
  OidcError,
  OIDC_DEFAULTS,
  OIDC_ENV,
  applyOidcEnvOverrides,
  defaultOidcClientConfig,
  decodeJwtPayload,
  normalizeIssuer
} from './oidc';
export type { OidcClientConfig, OidcAuthenticatorOptions } from './oidc';
export { BearerTokenProvider } from './bearer-token';
