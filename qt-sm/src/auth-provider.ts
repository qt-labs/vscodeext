// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import {
  BearerTokenProvider,
  OidcAuthError,
  OidcAuthenticator,
  OidcError,
  OIDC_DEFAULTS,
  QtCredentialStorage,
  applyOidcEnvOverrides,
  type LogLevel
} from 'sms-api';
import { createLogger } from 'qt-lib';
import {
  OIDC_STAGING_CLIENT_ID,
  PERSONAL_ACCESS_TOKEN_URL,
  SIGN_IN_EXPIRY_MS,
  SIGN_IN_STALL_MS
} from '@/constants';
import signInCallbackPage from '../webview-ui/sign-in-callback.html';

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
    }
  };
}

export const AUTH_PROVIDER_ID = 'qt-account';
const AUTH_PROVIDER_LABEL = 'Qt Account';
/** Session id and label used when a personal access token is the credential. */
export const PAT_SESSION_ID = 'personal-access-token';
export const PAT_ACCOUNT_LABEL = 'Personal access token';
export const LOGIN_CANCELLED_MESSAGE = 'Login cancelled';

export type SignInPhase =
  'idle' | 'signing' | 'stalled' | 'failed' | 'signedIn';

/** Progress of the browser sign-in, rendered by the walkthrough. */
export interface SignInState {
  phase: SignInPhase;
  /** Authorization URL of the pending login, so the UI can offer to reopen it. */
  authorizationUrl?: string;
  /** Set while `phase` is `failed`. */
  errorMessage?: string;
}

/**
 * VS Code AuthenticationProvider for the Qt Account.
 *
 * The login runs the OIDC authorization code flow with PKCE in the system
 * browser (sms-api `OidcAuthenticator`) and stores the tokens in the shared
 * Qt.ini (`QtCredentialStorage`), where the Qt Software Management Service
 * reads them before each backend request and renews them itself. A personal
 * access token stored in the same file (by qtcli or
 * `signInWithPersonalAccessToken`) is reported as a session as well.
 *
 * The session is derived from the file: `reloadFromDisk()` and the file
 * watcher pick up logins and logouts made by other Qt tools.
 */
export class QtAccountAuthenticationProvider
  implements vscode.AuthenticationProvider, vscode.Disposable
{
  private readonly storage: QtCredentialStorage;
  private readonly authenticator: OidcAuthenticator;
  private readonly bearer: BearerTokenProvider;
  private readonly disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeSessions =
    new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  readonly onDidChangeSessions = this._onDidChangeSessions.event;

  private readonly _onDidChangeSignInState =
    new vscode.EventEmitter<SignInState>();
  readonly onDidChangeSignInState = this._onDidChangeSignInState.event;

  private _session: vscode.AuthenticationSession | undefined;
  private _signInState: SignInState = { phase: 'idle' };
  private pendingLogin: Promise<vscode.AuthenticationSession> | undefined;
  private stallTimer: ReturnType<typeof setTimeout> | undefined;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  private expired = false;
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(extensionMode: vscode.ExtensionMode) {
    this.storage = new QtCredentialStorage();
    this.storage.onLog = logCallback('QtCredentialStorage');
    const clientId =
      extensionMode === vscode.ExtensionMode.Production
        ? OIDC_DEFAULTS.clientId
        : OIDC_STAGING_CLIENT_ID;
    this.authenticator = new OidcAuthenticator(this.storage, {
      config: applyOidcEnvOverrides({ ...OIDC_DEFAULTS, clientId }),
      onLog: logCallback('OidcAuthenticator'),
      successPage: signInCallbackPage,
      onAuthorizationUrl: (url) => {
        this.openBrowser(url);
      }
    });
    this.bearer = new BearerTokenProvider(this.storage, this.authenticator);
    this.bearer.onLog = logCallback('BearerTokenProvider');

    logger.info(
      `Qt Account credentials file: ${this.storage.settingsPath} ` +
        `(issuer ${this.authenticator.config.issuerUrl}, client ${this.authenticator.config.clientId})`
    );
    this.storage.loadSettings();
    this._session = this.sessionFromStorage();
    logger.info(
      this._session
        ? `Found a stored Qt Account session for ${this._session.account.label}`
        : 'No stored Qt Account credentials found'
    );
    this.watchSettingsFile();
  }

  dispose(): void {
    this.clearTimers();
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this._onDidChangeSessions.dispose();
    this._onDidChangeSignInState.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  get signInState(): SignInState {
    return this._signInState;
  }

  get session(): vscode.AuthenticationSession | undefined {
    return this._session;
  }

  // ── vscode.AuthenticationProvider ─────────────────────────────────────

  async getSessions(
    scopes?: readonly string[]
  ): Promise<vscode.AuthenticationSession[]> {
    if (scopes && scopes.length > 0 && !scopes.includes(AUTH_PROVIDER_ID)) {
      return Promise.resolve([]);
    }
    return Promise.resolve(this._session ? [this._session] : []);
  }

  async createSession(
    scopes: readonly string[]
  ): Promise<vscode.AuthenticationSession> {
    void scopes;
    if (this.pendingLogin) {
      // A second request while the browser is open: show the page again and
      // let the caller share the pending result.
      this.reopenBrowser();
      return this.pendingLogin;
    }
    this.pendingLogin = this.runBrowserLogin().finally(() => {
      this.pendingLogin = undefined;
    });
    return this.pendingLogin;
  }

  async removeSession(sessionId: string): Promise<void> {
    const removed = this._session;
    if (!removed || removed.id !== sessionId) {
      return Promise.resolve();
    }
    let ok = true;
    const tokens = this.storage.oidcTokens();
    if (tokens.accessToken || tokens.refreshToken || tokens.idToken) {
      ok = this.storage.clearOidcTokens() && ok;
    }
    if (this.storage.personalAccessToken) {
      ok = this.storage.clearPersonalAccessToken() && ok;
    }
    if (!ok) {
      const message = `Could not sign out of Qt Account: ${this.storage.errorString}`;
      logger.error(message);
      void vscode.window.showErrorMessage(message);
      return Promise.resolve();
    }
    this.setSignInState({ phase: 'idle' });
    this.syncSession();
    logger.info(`Signed out of Qt Account (${removed.account.label})`);
    void vscode.window.showInformationMessage(
      `Signed out of Qt Account (${removed.account.label})`
    );
    return Promise.resolve();
  }

  // ── Browser sign-in controls ──────────────────────────────────────────

  /** Opens the authorization URL of the pending login again and restarts the timers. */
  reopenBrowser(): void {
    const url = this.authenticator.authorizationUrl;
    if (!this.authenticator.isActive || !url) {
      return;
    }
    this.openBrowser(url);
  }

  /** Abandons the pending browser login; the sign-in state goes back to idle. */
  cancelSignIn(): void {
    if (this.authenticator.isActive) {
      this.authenticator.cancel();
    }
  }

  /**
   * Stores a personal access token (for windowless use, see
   * https://login.qt.io/personal-access-tokens) and clears any OIDC tokens,
   * so that only one credential type is active, like `qtcli login --pat`.
   */
  async signInWithPersonalAccessToken(): Promise<
    vscode.AuthenticationSession | undefined
  > {
    const token = await vscode.window.showInputBox({
      title: 'Qt Account Personal Access Token',
      prompt: `Paste a personal access token created at ${PERSONAL_ACCESS_TOKEN_URL}`,
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) =>
        value.trim() ? undefined : 'A personal access token is required'
    });
    if (!token?.trim()) {
      return undefined;
    }
    this.storage.personalAccessToken = token.trim();
    if (!this.storage.savePersonalAccessToken()) {
      void vscode.window.showErrorMessage(
        `Cannot store the personal access token: ${this.storage.errorString}`
      );
      return undefined;
    }
    if (!this.storage.clearOidcTokens()) {
      // The service would keep using the OIDC tokens first, so this is a failure.
      void vscode.window.showErrorMessage(
        `Cannot clear the stored Qt Account login: ${this.storage.errorString}`
      );
      return undefined;
    }
    this.setSignInState({ phase: 'signedIn' });
    this.syncSession();
    logger.info('Stored a personal access token for the Qt Account');
    void vscode.window.showInformationMessage(
      'Personal access token stored. Qt packages are now installed with it.'
    );
    return this._session;
  }

  // ── Tokens and storage ─────────────────────────────────────────────────

  /**
   * A bearer token for a direct backend request: the OIDC access token,
   * renewed first when expired, otherwise the personal access token. Rejects
   * with a user facing message when nothing can be sent.
   */
  async acquireAccessToken(): Promise<string> {
    try {
      return await this.bearer.acquire();
    } finally {
      this.syncSession();
    }
  }

  /**
   * Renews an expired login once at startup so that a revoked refresh token
   * shows up as signed out. Network failures keep the session (offline is
   * not signed out). Call after subscribing to `onDidChangeSessions`.
   */
  async startBackgroundRenewal(): Promise<void> {
    const tokens = this.storage.oidcTokens();
    if (
      !tokens.refreshToken ||
      !this.authenticator.acceptsIssuer(tokens.issuer) ||
      !this.storage.isOidcAccessTokenExpired()
    ) {
      return;
    }
    try {
      await this.authenticator.refresh();
      logger.info('Renewed the stored Qt Account login');
    } catch (err) {
      if (err instanceof OidcAuthError && err.code === OidcError.InvalidGrant) {
        logger.warn('The stored Qt Account login was revoked, signed out');
      } else {
        logger.warn(
          `Could not renew the stored Qt Account login: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } finally {
      this.syncSession();
    }
  }

  /** Re-reads Qt.ini and fires session events when the identity changed. */
  reloadFromDisk(): void {
    if (this.authenticator.isActive) {
      return; // our own login is writing the file
    }
    this.storage.loadSettings();
    this.syncSession();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async runBrowserLogin(): Promise<vscode.AuthenticationSession> {
    this.resetExpiry();
    this.setSignInState({ phase: 'signing' });
    try {
      await this.authenticator.login();
    } catch (err) {
      this.clearTimers();
      if (err instanceof OidcAuthError && err.code === OidcError.Cancelled) {
        if (this.expired) {
          const message =
            "You weren't signed in within 10 minutes, so this link expired.";
          logger.warn(`Qt Account login expired: ${message}`);
          this.setSignInState({ phase: 'failed', errorMessage: message });
          throw new Error(message);
        }
        logger.info('Qt Account login cancelled');
        this.setSignInState({ phase: 'idle' });
        throw new Error(LOGIN_CANCELLED_MESSAGE);
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Qt Account login failed: ${message}`);
      this.setSignInState({ phase: 'failed', errorMessage: message });
      throw new Error(message);
    }
    this.clearTimers();

    // Only one credential type is active at a time, like qtcli login.
    if (
      this.storage.personalAccessToken &&
      !this.storage.clearPersonalAccessToken()
    ) {
      logger.warn(
        `Cannot clear the personal access token from ${this.storage.settingsPath}: ${this.storage.errorString}`
      );
    }

    this.setSignInState({ phase: 'signedIn' });
    this.syncSession();
    const session = this._session;
    if (!session) {
      const message = 'The Qt Account login stored no usable credentials.';
      logger.error(message);
      this.setSignInState({ phase: 'failed', errorMessage: message });
      throw new Error(message);
    }
    logger.info(`Signed in to Qt Account as ${session.account.label}`);
    void vscode.window.showInformationMessage(
      `Signed in to Qt Account as ${session.account.label}`
    );
    return session;
  }

  private openBrowser(url: string): void {
    void vscode.env.openExternal(vscode.Uri.parse(url, true)).then(
      (opened) => {
        if (!opened) {
          logger.warn(
            'VS Code did not open the browser for the Qt Account sign-in'
          );
        }
      },
      (err: unknown) => {
        logger.warn(
          `Cannot open the browser for the Qt Account sign-in: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    );
    this.armTimers();
    this.setSignInState({ phase: 'signing', authorizationUrl: url });
  }

  private armTimers(): void {
    this.clearTimers();
    this.stallTimer = setTimeout(() => {
      if (this.authenticator.isActive) {
        logger.info(
          'No answer from the browser yet, reporting the sign-in as stalled'
        );
        const url = this.authenticator.authorizationUrl;
        this.setSignInState(
          url
            ? { phase: 'stalled', authorizationUrl: url }
            : { phase: 'stalled' }
        );
      }
    }, SIGN_IN_STALL_MS);
    this.expiryTimer = setTimeout(() => {
      if (this.authenticator.isActive) {
        this.expired = true;
        this.authenticator.cancel();
      }
    }, SIGN_IN_EXPIRY_MS);
  }

  // A method rather than an assignment in runBrowserLogin(), so that the
  // compiler does not narrow the flag to false across the await.
  private resetExpiry(): void {
    this.expired = false;
  }

  private clearTimers(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = undefined;
    }
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }

  private setSignInState(state: SignInState): void {
    this._signInState = state;
    this._onDidChangeSignInState.fire(state);
  }

  private sessionFromStorage(): vscode.AuthenticationSession | undefined {
    const tokens = this.storage.oidcTokens();
    if (
      (tokens.accessToken || tokens.refreshToken) &&
      this.authenticator.acceptsIssuer(tokens.issuer)
    ) {
      const email = this.storage.accountEmail;
      const id = tokens.sub || email || AUTH_PROVIDER_ID;
      return {
        id,
        accessToken: tokens.accessToken,
        account: { id, label: email || AUTH_PROVIDER_LABEL },
        scopes: [AUTH_PROVIDER_ID]
      };
    }
    const pat = this.storage.personalAccessToken;
    if (pat) {
      return {
        id: PAT_SESSION_ID,
        accessToken: pat,
        account: { id: PAT_SESSION_ID, label: PAT_ACCOUNT_LABEL },
        scopes: [AUTH_PROVIDER_ID]
      };
    }
    return undefined;
  }

  /** Recomputes the session from the storage and fires the matching event. */
  private syncSession(): void {
    const previous = this._session;
    const next = this.sessionFromStorage();
    this._session = next;
    if (!previous && next) {
      this._onDidChangeSessions.fire({
        added: [next],
        removed: [],
        changed: []
      });
    } else if (previous && !next) {
      this._onDidChangeSessions.fire({
        added: [],
        removed: [previous],
        changed: []
      });
    } else if (previous && next) {
      if (
        previous.id !== next.id ||
        previous.account.label !== next.account.label
      ) {
        this._onDidChangeSessions.fire({
          added: [next],
          removed: [previous],
          changed: []
        });
      } else if (previous.accessToken !== next.accessToken) {
        this._onDidChangeSessions.fire({
          added: [],
          removed: [],
          changed: [next]
        });
      }
    }
  }

  /**
   * Other Qt tools (qtcli, the bootstrap, the service renewing tokens) write
   * the same file. Reload it when it changes so the account state stays in
   * sync without a window reload.
   */
  private watchSettingsFile(): void {
    const settingsPath = this.storage.settingsPath;
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.Uri.file(path.dirname(settingsPath)),
        path.basename(settingsPath)
      )
    );
    const schedule = () => {
      if (this.reloadTimer) {
        clearTimeout(this.reloadTimer);
      }
      this.reloadTimer = setTimeout(() => {
        this.reloadTimer = undefined;
        this.reloadFromDisk();
      }, 300);
    };
    watcher.onDidCreate(schedule);
    watcher.onDidChange(schedule);
    watcher.onDidDelete(schedule);
    this.disposables.push(watcher);
  }
}

/**
 * Register the Qt Account authentication provider.
 * Call from extension activate().
 */
export function registerAuthenticationProvider(
  context: vscode.ExtensionContext
): QtAccountAuthenticationProvider {
  const provider = new QtAccountAuthenticationProvider(context.extensionMode);

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
