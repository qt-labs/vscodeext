// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

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
export const ALPHA_ALLOWLIST_URL =
  'https://ordp.qt.io/install/public/vscode/60acc3e9e59df98a139e6346f00e02a25fcba5ce7ad91d67a073243f5695c4e3.txt';

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
