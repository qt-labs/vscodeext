/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Selects the bearer token for backend requests and renews an expired OIDC
 * access token first. Mirrors the C++ `QInstaller::Auth::BearerTokenProvider`.
 *
 * The credentials are, in this order: a non expired OIDC access token of the
 * issuer the authenticator is configured for, then the personal access token,
 * both from the `QtCredentialStorage`. Call `prepare()` (or `acquire()`)
 * before each request so that an expired token is renewed and written back
 * to Qt.ini.
 */

import type { QtCredentialStorage } from './credential-storage';
import type { OidcAuthenticator } from './oidc';
import type { LogCallback, LogLevel } from './types';

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
}

export class BearerTokenProvider {
  private renewing = false;
  private pending: Waiter[] = [];

  onLog: LogCallback | undefined;

  constructor(
    private readonly storage: QtCredentialStorage,
    private readonly authenticator: OidcAuthenticator
  ) {}

  /**
   * Reloads Qt.ini, because a login in another process can replace it, and
   * renews an expired OIDC access token when a refresh token of the current
   * issuer is stored. Calls made during a renewal wait for it and share its
   * result. Rejects with a user facing message when the renewal fails and no
   * personal access token can be sent instead. Resolving does not mean that a
   * credential exists: `bearerToken()` may still return ''.
   */
  async prepare(): Promise<void> {
    if (!this.renewing) {
      this.storage.loadSettings();
      if (!this.needsRenewal()) {
        return;
      }
    }
    const waiter = new Promise<void>((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
    if (!this.renewing) {
      this.renewing = true;
      void this.runRenewal();
    }
    return waiter;
  }

  /**
   * The token to send: a non expired OIDC access token of the current
   * issuer, otherwise the personal access token, otherwise ''. An expired
   * OIDC access token is never returned.
   */
  bearerToken(): string {
    const oidcToken = this.usableOidcAccessToken();
    if (oidcToken) {
      this.log('info', 'Authenticating with the OIDC access token');
      return oidcToken;
    }
    const pat = this.storage.personalAccessToken;
    if (pat) {
      this.log('info', 'Authenticating with the personal access token');
    }
    return pat;
  }

  /** `prepare()` followed by `bearerToken()`. */
  async acquire(): Promise<string> {
    await this.prepare();
    return this.bearerToken();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private log(level: LogLevel, message: string): void {
    this.onLog?.(level, message);
  }

  private needsRenewal(): boolean {
    const tokens = this.storage.oidcTokens();
    return (
      tokens.refreshToken !== '' &&
      (tokens.accessToken === '' || this.storage.isOidcAccessTokenExpired()) &&
      this.authenticator.acceptsIssuer(tokens.issuer)
    );
  }

  private usableOidcAccessToken(): string {
    const tokens = this.storage.oidcTokens();
    if (tokens.accessToken === '' || this.storage.isOidcAccessTokenExpired()) {
      return '';
    }
    if (!this.authenticator.acceptsIssuer(tokens.issuer)) {
      this.log(
        'warn',
        'Skipping the OIDC access token: it was issued by another issuer than the current one.'
      );
      return '';
    }
    return tokens.accessToken;
  }

  private async runRenewal(): Promise<void> {
    let error: string | undefined;
    try {
      await this.authenticator.refresh();
      if (
        this.storage.oidcTokens().accessToken === '' ||
        this.storage.isOidcAccessTokenExpired()
      ) {
        error =
          'The renewed Qt account login has already expired. Log in again.';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (this.storage.personalAccessToken) {
        this.log(
          'info',
          `OIDC renewal failed, falling back to the PAT: ${message}`
        );
      } else {
        error = `Cannot renew the Qt account login: ${message} Log in again.`;
      }
    }
    this.renewing = false;
    const pending = this.pending;
    this.pending = [];
    if (error) {
      this.log('warn', error);
    }
    for (const waiter of pending) {
      if (error) {
        waiter.reject(new Error(error));
      } else {
        waiter.resolve();
      }
    }
  }
}
