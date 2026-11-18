// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

/**
 * Command ids posted by SignInCard. The extension host registers commands
 * under exactly these names.
 */
export const SIGN_IN_COMMANDS = {
  signIn: 'qt-sm.login',
  createAccount: 'qt-sm.createAccount',
  forgotPassword: 'qt-sm.resetPassword',
  reopen: 'qt-sm.reopenSignIn',
  cancel: 'qt-sm.cancelSignIn',
  troubleshoot: 'qt-sm.openTroubleshooting',
  signOut: 'qt-sm.logout',
  learnMore: 'qt-sm.openTelemetryStatement'
} as const;
