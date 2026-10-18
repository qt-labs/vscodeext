// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { OIDC_DEFAULTS, type OidcClientConfig } from 'sms-api';

export * from 'qt-lib/src/constants';
export const EXTENSION_ID = 'qt-sm';
export const CONF_INSTALLATION_PATH = 'installationPath';
export const CONF_USER_AGENT = 'qt-visual-studio-code-gui';
export const CONF_RESET_LICENSE_AFTER_INSTALL = 'resetLicenseBeforeInstall';
// Global flag (ConfigurationTarget.Global) that the "Get Started with Qt"
// walkthrough sets when the user marks it done. Other extensions (e.g. qt-core)
// read it via workspace.getConfiguration('qt-sm').get('getStartedDone').
export const CONF_GET_STARTED_DONE = 'getStartedDone';
export const DEFAULT_BACKEND_URL = 'https://api.install.qt.io';
// Qt Account "Forgot password" page, opened from the walkthrough sign-in step.
export const RESET_PASSWORD_URL = 'https://login.qt.io/forgot';
// Qt Account registration page, opened by the "Create Account" buttons.
export const CREATE_ACCOUNT_URL = 'https://login.qt.io/register';
// Sign-in troubleshooting page. Same placeholder as the C++ installer, no
// hosted page exists yet.
export const TROUBLESHOOT_URL = 'https://login.qt.io/troubleshoot';
// Telemetry statement linked from the "Privacy & data" opt-in.
export const TELEMETRY_STATEMENT_URL =
  'https://www.qt.io/terms-conditions/telemetry-statement-2026-03-25';
// Where users manage personal access tokens for windowless sign-in.
export const PERSONAL_ACCESS_TOKEN_URL =
  'https://login.qt.io/personal-access-tokens';

// OIDC client registration used for the browser sign-in. The registration
// for this extension is `qt-pif-sms` (OIDC_DEFAULTS). Until the
// login server accepts it, the Qt Design Studio staging client is used; its
// loopback redirect URI is registered with a fixed port. Switching back is
// this one constant. QT_ACCOUNT_OIDC_* environment variables still override.
export const OIDC_CLIENT_CONFIG: OidcClientConfig = {
  ...OIDC_DEFAULTS,
  clientId: 'qt-design-studio-staging',
  scopes: 'openid offline_access email profile license:read',
  redirectPort: 54867
};

// Browser sign-in timings, from the Qt offline installer: report a stalled
// hand-off after 25 seconds without a result, give up after 10 minutes. Both
// are measured from the last time the browser was opened.
export const SIGN_IN_STALL_MS = 25_000;
export const SIGN_IN_EXPIRY_MS = 10 * 60_000;

// Survey popup constants
export const SURVEY_URL = 'https://www.surveymonkey.com/r/BMQH2W3';
// TODO: Make this 30 minutes before the alpha release
export const SURVEY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

// State keys for survey
export const STATE_SURVEY_COMPLETED = 'surveyCompleted';
export const STATE_SURVEY_DISMISSED = 'surveyDismissed';
export const STATE_SURVEY_LAST_PROMPT = 'surveyLastPrompt';

// State keys for the walkthrough
export const STATE_WALKTHROUGH_FIRST_APP_DONE = 'walkthroughFirstAppDone';
// Set when the user pressed Continue on the signed-in card; cleared by
// sign-out and by resetting the walkthrough.
export const STATE_WALKTHROUGH_SIGN_IN_ACKNOWLEDGED =
  'walkthroughSignInAcknowledged';
// The two "Privacy & data" opt-ins of the signed-in card.
export const STATE_PRIVACY_USAGE_DATA = 'privacyUsageDataOptIn';
export const STATE_PRIVACY_CRASH_DUMPS = 'privacyCrashDumpsOptIn';
