/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Reads and writes the OIDC tokens, the account email and the personal access
 * token in the organization level `Qt.ini`. Mirrors the C++
 * `QInstaller::Auth::QtCredentialStorage` of the Qt Software Management
 * Service, which reads the same file before each backend request and writes
 * renewed tokens back to it.
 *
 * Groups and keys:
 *   auth/qtaccount/email
 *   auth/oidc_pkce/{access_token,refresh_token,id_token,expires_at,token_type,sub,issuer}
 *   auth/pat/access_token
 *
 * Every save rewrites only its own groups and leaves the rest of the file
 * untouched. Writes are serialized across processes with a lock file that is
 * compatible with QLockFile, and `storeRenewedOidcTokens()` refuses to
 * overwrite tokens that another process stored during a renewal.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { IniDocument } from './ini';
import { qtIniPath } from './paths';
import type { LogCallback, LogLevel } from './types';

export interface OidcTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  /** Expiry of the access token, `undefined` when the server reported none. */
  expiresAt: Date | undefined;
  tokenType: string;
  /** The `sub` claim of the ID token stored at login. */
  sub: string;
  /** Normalized issuer URL that issued the tokens. */
  issuer: string;
}

export function emptyOidcTokens(): OidcTokens {
  return {
    accessToken: '',
    refreshToken: '',
    idToken: '',
    expiresAt: undefined,
    tokenType: '',
    sub: '',
    issuer: ''
  };
}

export const GROUP_QT_ACCOUNT = 'auth/qtaccount';
export const GROUP_OIDC = 'auth/oidc_pkce';
export const GROUP_PAT = 'auth/pat';
const KEY_EMAIL = 'email';
const KEY_ACCESS_TOKEN = 'access_token';
const KEY_REFRESH_TOKEN = 'refresh_token';
const KEY_ID_TOKEN = 'id_token';
const KEY_EXPIRES_AT = 'expires_at';
const KEY_TOKEN_TYPE = 'token_type';
const KEY_SUB = 'sub';
const KEY_ISSUER = 'issuer';

/** An access token that expires within this margin counts as expired. */
export const OIDC_EXPIRY_MARGIN_SECS = 30;
/** How long a save waits for the lock file (QLockFile default in the C++). */
export const SETTINGS_LOCK_TIMEOUT_MS = 10000;
/** A lock file older than this whose owner cannot be verified is stale. */
export const STALE_LOCK_MS = 30000;
const LOCK_POLL_MS = 50;

export interface QtCredentialStorageOptions {
  lockTimeoutMs?: number;
  staleLockMs?: number;
}

/** QSettings writes an invalid QDateTime as an empty string. */
function formatExpiresAt(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function parseExpiresAt(text: string | undefined): Date | undefined {
  if (!text) {
    return undefined;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // EPERM: the process exists but belongs to another user.
    return code === 'EPERM';
  }
}

/**
 * QSettings::sync() locks `<file>.lock` itself, so the token writes of the C++
 * use their own lock file next to the settings file.
 */
export function settingsLockPath(filePath: string): string {
  return `${filePath}.auth.lock`;
}

class SettingsLock {
  private held = false;

  constructor(
    private readonly lockPath: string,
    private readonly timeoutMs: number,
    private readonly staleMs: number,
    private readonly log: (level: LogLevel, message: string) => void
  ) {}

  /** Returns false when the lock cannot be taken within the timeout. */
  tryLock(): boolean {
    const deadline = Date.now() + this.timeoutMs;
    for (;;) {
      if (this.tryCreate()) {
        this.held = true;
        return true;
      }
      if (this.isStale()) {
        this.log('warn', `Removing stale lock file ${this.lockPath}`);
        try {
          fs.unlinkSync(this.lockPath);
        } catch {
          // Someone else removed it first; retry.
        }
        continue;
      }
      if (Date.now() >= deadline) {
        return false;
      }
      sleepSync(LOCK_POLL_MS);
    }
  }

  unlock(): void {
    if (!this.held) {
      return;
    }
    this.held = false;
    try {
      fs.unlinkSync(this.lockPath);
    } catch {
      // Already gone.
    }
  }

  private tryCreate(): boolean {
    let fd: number | undefined;
    try {
      fd = fs.openSync(this.lockPath, 'wx', 0o644);
      // Same layout as QLockFile: pid, application name, host name.
      fs.writeSync(
        fd,
        `${String(process.pid)}\n${path.basename(process.execPath)}\n${os.hostname()}\n`
      );
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        return false;
      }
      throw err;
    } finally {
      if (fd !== undefined) {
        fs.closeSync(fd);
      }
    }
  }

  /** Mirrors QLockFilePrivate::isApparentlyStale(). */
  private isStale(): boolean {
    let content: string;
    let mtimeMs: number;
    try {
      content = fs.readFileSync(this.lockPath, 'utf-8');
      mtimeMs = fs.statSync(this.lockPath).mtimeMs;
    } catch {
      return false; // Vanished meanwhile; the retry will create it.
    }
    const [pidLine, , hostLine] = content.split('\n');
    const pid = Number.parseInt(pidLine ?? '', 10);
    const sameHost = !hostLine || hostLine === os.hostname();
    if (sameHost && Number.isFinite(pid) && pid > 0 && !isProcessAlive(pid)) {
      return true;
    }
    return this.staleMs > 0 && Math.abs(Date.now() - mtimeMs) > this.staleMs;
  }
}

export class QtCredentialStorage {
  private readonly _settingsPath: string;
  private readonly _lockTimeoutMs: number;
  private readonly _staleLockMs: number;
  private _errorString = '';
  private _accountEmail = '';
  private _oidcTokens: OidcTokens = emptyOidcTokens();
  private _personalAccessToken = '';

  onLog: LogCallback | undefined;

  constructor(settingsPath?: string, options?: QtCredentialStorageOptions) {
    this._settingsPath =
      settingsPath ?? QtCredentialStorage.defaultSettingsPath();
    this._lockTimeoutMs = options?.lockTimeoutMs ?? SETTINGS_LOCK_TIMEOUT_MS;
    this._staleLockMs = options?.staleLockMs ?? STALE_LOCK_MS;
  }

  /** `<GenericDataLocation>/Qt/Qt.ini` */
  static defaultSettingsPath(): string {
    return qtIniPath();
  }

  get settingsPath(): string {
    return this._settingsPath;
  }

  /** Description of the last failure, empty after a successful operation. */
  get errorString(): string {
    return this._errorString;
  }

  get accountEmail(): string {
    return this._accountEmail;
  }

  set accountEmail(email: string) {
    this._accountEmail = email;
  }

  get personalAccessToken(): string {
    return this._personalAccessToken;
  }

  set personalAccessToken(token: string) {
    this._personalAccessToken = token;
  }

  oidcTokens(): OidcTokens {
    return { ...this._oidcTokens };
  }

  /** True when there is no valid expiry or it lies within the margin. */
  isOidcAccessTokenExpired(): boolean {
    const expiresAt = this._oidcTokens.expiresAt;
    if (!expiresAt) {
      return true;
    }
    return expiresAt.getTime() <= Date.now() + OIDC_EXPIRY_MARGIN_SECS * 1000;
  }

  /**
   * Reads all three groups, replacing the values held in memory. Returns false
   * and clears the values when the file does not exist or cannot be read.
   */
  loadSettings(): boolean {
    this.clearValues();
    const doc = this.readDocument();
    if (!doc) {
      return false;
    }
    this.readOidcGroup(doc);
    this._personalAccessToken =
      doc.get(`${GROUP_PAT}/${KEY_ACCESS_TOKEN}`) ?? '';
    this._errorString = '';
    return true;
  }

  /**
   * Re-reads only the OIDC tokens and the account email. The personal access
   * token in memory is left unchanged.
   */
  reloadOidcGroup(): boolean {
    const doc = this.readDocument();
    if (!doc) {
      return false;
    }
    this.readOidcGroup(doc);
    this._errorString = '';
    return true;
  }

  /** Stores the tokens of a new login together with `accountEmail`. */
  storeOidcTokens(tokens: OidcTokens): boolean {
    const previous = this._oidcTokens;
    this._oidcTokens = { ...tokens };
    if (this.saveOidcTokens()) {
      return true;
    }
    this._oidcTokens = previous;
    return false;
  }

  /**
   * Stores renewed tokens unless the file no longer holds
   * `previousRefreshToken`, in which case a newer login or renewal has been
   * stored meanwhile: nothing is written and the file's tokens are loaded
   * into memory instead. Returns true when file and memory agree afterwards.
   */
  storeRenewedOidcTokens(
    tokens: OidcTokens,
    previousRefreshToken: string
  ): boolean {
    const previous = this._oidcTokens;
    this._oidcTokens = { ...tokens };
    if (this.saveRenewedOidcTokens(previousRefreshToken)) {
      return true;
    }
    this._oidcTokens = previous;
    return false;
  }

  /** Removes the `auth/oidc_pkce` and `auth/qtaccount` groups. */
  clearOidcTokens(): boolean {
    const ok = this.withLockedDocument((doc) => {
      doc.removeGroup(GROUP_OIDC);
      doc.removeGroup(GROUP_QT_ACCOUNT);
      return true;
    });
    if (ok) {
      this._accountEmail = '';
      this._oidcTokens = emptyOidcTokens();
    }
    return ok;
  }

  /** Writes `personalAccessToken` to the `auth/pat` group. */
  savePersonalAccessToken(): boolean {
    return this.withLockedDocument((doc) => {
      doc.set(`${GROUP_PAT}/${KEY_ACCESS_TOKEN}`, this._personalAccessToken);
      return true;
    });
  }

  /** Removes the `auth/pat` group. */
  clearPersonalAccessToken(): boolean {
    const ok = this.withLockedDocument((doc) => {
      doc.removeGroup(GROUP_PAT);
      return true;
    });
    if (ok) {
      this._personalAccessToken = '';
    }
    return ok;
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private log(level: LogLevel, message: string): void {
    this.onLog?.(level, message);
  }

  private fail(message: string): false {
    this._errorString = message;
    this.log('warn', message);
    return false;
  }

  private clearValues(): void {
    this._accountEmail = '';
    this._oidcTokens = emptyOidcTokens();
    this._personalAccessToken = '';
  }

  private readDocument(): IniDocument | undefined {
    const filePath = this._settingsPath;
    if (!fs.existsSync(filePath)) {
      this._errorString = `Cannot find settings file: ${filePath}`;
      return undefined;
    }
    try {
      return IniDocument.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      this.fail(`Cannot read settings file: ${filePath}`);
      return undefined;
    }
  }

  private readOidcGroup(doc: IniDocument): void {
    const get = (key: string) => doc.get(`${GROUP_OIDC}/${key}`) ?? '';
    this._oidcTokens = {
      accessToken: get(KEY_ACCESS_TOKEN),
      refreshToken: get(KEY_REFRESH_TOKEN),
      idToken: get(KEY_ID_TOKEN),
      expiresAt: parseExpiresAt(get(KEY_EXPIRES_AT)),
      tokenType: get(KEY_TOKEN_TYPE),
      sub: get(KEY_SUB),
      issuer: get(KEY_ISSUER)
    };
    this._accountEmail = doc.get(`${GROUP_QT_ACCOUNT}/${KEY_EMAIL}`) ?? '';
  }

  private writeOidcGroup(doc: IniDocument): void {
    const t = this._oidcTokens;
    doc.set(`${GROUP_OIDC}/${KEY_ACCESS_TOKEN}`, t.accessToken);
    doc.set(`${GROUP_OIDC}/${KEY_REFRESH_TOKEN}`, t.refreshToken);
    doc.set(`${GROUP_OIDC}/${KEY_ID_TOKEN}`, t.idToken);
    doc.set(`${GROUP_OIDC}/${KEY_EXPIRES_AT}`, formatExpiresAt(t.expiresAt));
    doc.set(`${GROUP_OIDC}/${KEY_TOKEN_TYPE}`, t.tokenType);
    doc.set(`${GROUP_OIDC}/${KEY_SUB}`, t.sub);
    doc.set(`${GROUP_OIDC}/${KEY_ISSUER}`, t.issuer);
    doc.set(`${GROUP_QT_ACCOUNT}/${KEY_EMAIL}`, this._accountEmail);
  }

  private saveOidcTokens(): boolean {
    return this.withLockedDocument((doc) => {
      this.writeOidcGroup(doc);
      return true;
    });
  }

  private saveRenewedOidcTokens(previousRefreshToken: string): boolean {
    return this.withLockedDocument((doc) => {
      const stored = doc.get(`${GROUP_OIDC}/${KEY_REFRESH_TOKEN}`) ?? '';
      if (stored !== previousRefreshToken) {
        this.log(
          'info',
          'Newer OIDC tokens were stored during the renewal, discarding the renewed tokens.'
        );
        this.readOidcGroup(doc);
        return false; // nothing to write
      }
      this.writeOidcGroup(doc);
      return true;
    });
  }

  /**
   * Locks, reads the file, applies `modify` and writes the file back when
   * `modify` returns true. Returns false only on failure.
   */
  private withLockedDocument(modify: (doc: IniDocument) => boolean): boolean {
    const filePath = this._settingsPath;
    const dir = path.dirname(filePath);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      return this.fail(`Cannot create directory: ${dir}`);
    }

    const lock = new SettingsLock(
      settingsLockPath(filePath),
      this._lockTimeoutMs,
      this._staleLockMs,
      (level, message) => {
        this.log(level, message);
      }
    );
    let locked: boolean;
    try {
      locked = lock.tryLock();
    } catch (err) {
      return this.fail(
        `Cannot lock settings file: ${filePath} (${(err as Error).message})`
      );
    }
    if (!locked) {
      return this.fail(`Cannot lock settings file: ${filePath}`);
    }

    try {
      let doc: IniDocument;
      try {
        doc = fs.existsSync(filePath)
          ? IniDocument.parse(fs.readFileSync(filePath, 'utf-8'))
          : new IniDocument();
      } catch {
        return this.fail(`Cannot read settings file: ${filePath}`);
      }

      if (!modify(doc)) {
        this._errorString = '';
        return true;
      }

      const tmpPath = `${filePath}.${String(process.pid)}.tmp`;
      try {
        fs.writeFileSync(tmpPath, doc.serialize(), { mode: 0o600 });
        fs.renameSync(tmpPath, filePath);
        if (process.platform !== 'win32') {
          fs.chmodSync(filePath, 0o600);
        }
      } catch (err) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // nothing to clean up
        }
        return this.fail(
          `Failed to write settings file: ${filePath} (${(err as Error).message})`
        );
      }
      this._errorString = '';
      return true;
    } finally {
      lock.unlock();
    }
  }
}
