// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as https from 'https';
import * as vscode from 'vscode';

import {
  QtAccount,
  QtAccountStorage,
  type AuthCredentials,
  type LogLevel
} from 'sms-api';
import { createLogger } from 'qt-lib';
import { ALPHA_ALLOWLIST_URL } from '@/constants';

const logger = createLogger('auth');

function logCallback(tag: string) {
  return (level: LogLevel, message: string) => {
    switch (level) {
      case 'error':
        logger.error(`[${tag}] ${message}`);
        break;
      case 'warn':
        logger.warn(`[${tag}] ${message}`);
        break;
      case 'info':
        logger.info(`[${tag}] ${message}`);
        break;
      default:
        logger.info(`[${tag}] ${message}`);
    }
  };
}

export const AUTH_PROVIDER_ID = 'qt-account';
const AUTH_PROVIDER_LABEL = 'Qt Account';

/**
 * VS Code AuthenticationProvider backed by QtAccount (HTTPS login to qls.qt.io)
 * and QtAccountStorage (shared QtCompany.ini / qtaccount.ini).
 *
 * Sessions are keyed by email address with `['qt-account']` scope.
 */
export class QtAccountAuthenticationProvider
  implements vscode.AuthenticationProvider, vscode.Disposable
{
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeSessions =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  private _currentSession: vscode.AuthenticationSession | undefined;

  constructor() {
    // Try loading existing credentials at startup
    logger.info('Initializing QtAccountAuthenticationProvider');
    const storage = new QtAccountStorage();
    storage.onLog = logCallback('QtAccountStorage');
    const loaded = storage.load();
    logger.info(
      `Storage load result: ${String(loaded)}, hasCredentials: ${String(storage.hasCredentials())}`
    );
    if (loaded && storage.hasCredentials()) {
      this._currentSession = credentialsToSession(storage.toCredentials());
      logger.info(`Loaded stored Qt Account session for ${storage.email}`);
    } else {
      logger.info('No stored credentials found');
    }
  }

  dispose(): void {
    this._onDidChangeSessions.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
  }

  async getSessions(
    scopes?: readonly string[]
  ): Promise<vscode.AuthenticationSession[]> {
    logger.info(`getSessions called with scopes: ${JSON.stringify(scopes)}`);
    // If specific scopes are requested and ours isn't included, return empty
    if (scopes && scopes.length > 0 && !scopes.includes(AUTH_PROVIDER_ID)) {
      logger.info('Scopes do not include our provider ID, returning empty');
      return Promise.resolve([]);
    }
    const hasSession = this._currentSession !== undefined;
    logger.info(`Returning ${hasSession ? '1' : '0'} session(s)`);
    return Promise.resolve(this._currentSession ? [this._currentSession] : []);
  }

  async createSession(
    scopes: readonly string[]
  ): Promise<vscode.AuthenticationSession> {
    void scopes;
    const email = await vscode.window.showInputBox({
      title: 'Qt Account Login',
      prompt: 'Enter your Qt Account email',
      placeHolder: 'you@example.com',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.includes('@')) {
          return 'Please enter a valid email address';
        }
        return undefined;
      }
    });

    if (!email) {
      throw new Error('Login cancelled');
    }

    const password = await vscode.window.showInputBox({
      title: 'Qt Account Login',
      prompt: 'Enter your Qt Account password',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'Password is required';
        }
        return undefined;
      }
    });

    if (!password) {
      throw new Error('Login cancelled');
    }

    // Check alpha access allowlist before attempting login
    let allowlist: string[];
    try {
      allowlist = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Checking alpha access...',
          cancellable: false
        },
        async () => fetchAlphaAllowlist()
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to fetch alpha allowlist: ${msg}`);
      throw new Error(
        'Unable to verify alpha access. Please check your internet connection.'
      );
    }

    if (!allowlist.includes(email.toLowerCase())) {
      const errMsg = `Qt Account "${email}" is not in the alpha access list.`;
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    logger.info(`Attempting login for ${email}`);
    const account = new QtAccount();
    account.onLog = logCallback('QtAccount');
    let credentials: AuthCredentials;

    try {
      credentials = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Signing in to Qt Account...',
          cancellable: false
        },
        async () => account.login(email, password)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Login failed for ${email}: ${msg}`);
      void vscode.window.showErrorMessage(`Qt Account login failed: ${msg}`);
      throw err;
    }

    this._currentSession = credentialsToSession(credentials);

    this._onDidChangeSessions.fire({
      added: [this._currentSession],
      removed: [],
      changed: []
    });

    logger.info(`Logged in as ${credentials.email}`);
    void vscode.window.showInformationMessage(
      `Successfully signed in to Qt Account as ${credentials.email}`
    );
    return this._currentSession;
  }

  async removeSession(sessionId: string): Promise<void> {
    logger.info(`removeSession called for sessionId: ${sessionId}`);
    if (this._currentSession?.id === sessionId) {
      const removed = this._currentSession;
      this._currentSession = undefined;

      const account = new QtAccount();
      account.onLog = logCallback('QtAccount');
      account.logout();

      this._onDidChangeSessions.fire({
        added: [],
        removed: [removed],
        changed: []
      });

      logger.info(`Logged out of Qt Account (${removed.account.label})`);
      void vscode.window.showInformationMessage(
        `Logged out of Qt Account (${removed.account.label})`
      );
    }
    return Promise.resolve();
  }

  /**
   * Try to renew existing credentials (stored JWT).
   * Returns the session if renewal succeeded, undefined otherwise.
   */
  async tryRenewSession(): Promise<vscode.AuthenticationSession | undefined> {
    logger.info('Attempting to renew session');
    const account = new QtAccount();
    account.onLog = logCallback('QtAccount');
    if (!account.hasStoredCredentials()) {
      logger.info('No stored credentials available for renewal');
      return undefined;
    }

    try {
      const credentials = await account.renewLogin();
      this._currentSession = credentialsToSession(credentials);
      this._onDidChangeSessions.fire({
        added: [],
        removed: [],
        changed: [this._currentSession]
      });
      logger.info(`Renewed Qt Account session for ${credentials.email}`);
      return this._currentSession;
    } catch (err) {
      logger.warn(
        `Failed to renew Qt Account session: ${err instanceof Error ? err.message : String(err)}`
      );
      return undefined;
    }
  }
}

async function fetchAlphaAllowlist(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    https
      .get(ALPHA_ALLOWLIST_URL as string, (res) => {
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          const emails = data
            .split('\n')
            .map((line) => line.trim().toLowerCase())
            .filter((line) => line.length > 0);
          resolve(emails);
        });
      })
      .on('error', reject);
  });
}

function credentialsToSession(
  credentials: AuthCredentials
): vscode.AuthenticationSession {
  return {
    id: credentials.userId || credentials.email,
    accessToken: credentials.jwt,
    account: {
      id: credentials.userId || credentials.email,
      label: credentials.email
    },
    scopes: [AUTH_PROVIDER_ID]
  };
}

/**
 * Register the Qt Account authentication provider.
 * Call from extension activate().
 */
export function registerAuthenticationProvider(
  context: vscode.ExtensionContext
): QtAccountAuthenticationProvider {
  const provider = new QtAccountAuthenticationProvider();

  context.subscriptions.push(
    vscode.authentication.registerAuthenticationProvider(
      AUTH_PROVIDER_ID,
      AUTH_PROVIDER_LABEL,
      provider,
      { supportsMultipleAccounts: false }
    )
  );

  context.subscriptions.push(provider);
  return provider;
}
