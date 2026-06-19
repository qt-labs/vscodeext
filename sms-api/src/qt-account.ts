/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Qt Account authentication — mirrors the C++ QtAccount/QtAccountStorage
 * from tqtc-qtpif-software-management-service/src/libs/auth/.
 *
 * Provides:
 *   - QtAccountStorage: read/write qtaccount.ini credentials file
 *   - QtAccount: HTTPS login to qls.qt.io, JWT token management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as crypto from 'crypto';

import { AuthState, LoginError, type AuthCredentials } from './types';

export type LogLevel = 'info' | 'warn' | 'error';

// ── Constants ────────────────────────────────────────────────────────────────

const AUTH_SERVER = 'https://qls.qt.io';
const LOGIN_ENDPOINT = '/api/v2/login';
const RENEW_TOKEN_ENDPOINT = '/api/v2/login/renewToken';

// INI file keys — compatible with C++ QtAccountStorage (qtaccount.ini)
const INI_GROUP = 'QtAccount';
const INI_KEY_EMAIL = 'email';
const INI_KEY_JWT = 'jwt';
const INI_KEY_USER_ID = 'u';

// ── INI parser/writer (minimal, QSettings-compatible) ────────────────────────

function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentGroup = '';
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }
    const groupMatch = /^\[(.+)\]$/.exec(line);
    if (groupMatch?.[1] !== undefined) {
      currentGroup = groupMatch[1];
      if (result[currentGroup] === undefined) {
        result[currentGroup] = {};
      }
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();
      let group = result[currentGroup];
      if (group === undefined) {
        group = {};
        result[currentGroup] = group;
      }
      group[key] = value;
    }
  }
  return result;
}

function writeIni(
  sections: Record<string, Record<string, string>>,
  existingContent?: string
): string {
  // Merge into existing content to preserve other sections
  const existing = existingContent ? parseIni(existingContent) : {};
  for (const [group, entries] of Object.entries(sections)) {
    if (existing[group] === undefined) {
      existing[group] = {};
    }
    for (const [key, value] of Object.entries(entries)) {
      existing[group][key] = value;
    }
  }

  const lines: string[] = [];
  for (const [group, entries] of Object.entries(existing)) {
    lines.push(`[${group}]`);
    for (const [key, value] of Object.entries(entries)) {
      lines.push(`${key}=${value}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── JWT helpers ──────────────────────────────────────────────────────────────

/**
 * Decode the payload (second segment) of a JWT without verifying the signature.
 * Mirrors C++ `decodeJwtPayload()`.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | undefined {
  const parts = jwt.split('.');
  if (parts.length !== 3 || parts[1] === undefined) {
    return undefined;
  }
  try {
    // JWT uses base64url encoding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function extractUserId(jwt: string): string {
  const payload = decodeJwtPayload(jwt);
  if (!payload) {
    return '';
  }
  return typeof payload.sub === 'string' ? payload.sub : '';
}

// ── Platform paths ───────────────────────────────────────────────────────────

/**
 * Returns the path to qtaccount.ini.
 * Mirrors C++ `QtAccountStorage::defaultStoragePath()`.
 */
function defaultStoragePath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Qt', 'qtaccount.ini');
  }
  // Linux/macOS: ~/.local/share/Qt/qtaccount.ini
  const dataDir =
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  return path.join(dataDir, 'Qt', 'qtaccount.ini');
}

/**
 * Returns the path to the QtCompany.ini file (used for service settings).
 *   Linux:   $HOME/.local/share/QtCompany/QtCompany.ini
 *   macOS:   $HOME/Library/Application Support/QtCompany/QtCompany.ini
 *   Windows: %APPDATA%/QtCompany/QtCompany.ini
 */
function qtCompanySettingsPath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(appData, 'QtCompany', 'QtCompany.ini');
  }
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'QtCompany',
      'QtCompany.ini'
    );
  }
  // Linux
  const dataDir =
    process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  return path.join(dataDir, 'QtCompany', 'QtCompany.ini');
}

// ── QtAccountStorage ─────────────────────────────────────────────────────────

export type LogCallback = (level: LogLevel, message: string) => void;

export class QtAccountStorage {
  private _email = '';
  private _jwt = '';
  private _userId = '';
  private _filePath = '';

  onLog: LogCallback | undefined;

  private log(level: LogLevel, message: string): void {
    this.onLog?.(level, message);
  }

  get email(): string {
    return this._email;
  }
  get jwt(): string {
    return this._jwt;
  }
  get userId(): string {
    return this._userId;
  }

  /**
   * Load credentials from the default qtaccount.ini.
   */
  load(): boolean {
    const p = defaultStoragePath();
    this.log('info', `Loading credentials from ${p}`);
    return this.loadFromPath(p);
  }

  /**
   * Load credentials from a specific file.
   */
  loadFromPath(filePath: string): boolean {
    this._filePath = filePath;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ini = parseIni(content);
      const group = ini[INI_GROUP];
      if (!group) {
        this.log('warn', `No [${INI_GROUP}] group in ${filePath}`);
        return false;
      }
      this._email = group[INI_KEY_EMAIL] ?? '';
      this._jwt = group[INI_KEY_JWT] ?? '';
      this._userId = group[INI_KEY_USER_ID] ?? '';
      this.log('info', `Loaded credentials for "${this._email}" from "${filePath}"`);
      return true;
    } catch {
      this.log('warn', `Failed to read "${filePath}"`);
      return false;
    }
  }

  /**
   * Save credentials to the default qtaccount.ini path.
   */
  save(): boolean {
    const filePath = this._filePath || defaultStoragePath();
    return this.saveToPath(filePath);
  }

  /**
   * Save credentials to a specific file.
   */
  saveToPath(filePath: string): boolean {
    this.log('info', `Saving credentials to ${filePath}`);
    try {
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });

      let existing: string | undefined;
      try {
        existing = fs.readFileSync(filePath, 'utf-8');
      } catch {
        // File doesn't exist yet
      }

      const content = writeIni(
        {
          [INI_GROUP]: {
            [INI_KEY_EMAIL]: this._email,
            [INI_KEY_JWT]: this._jwt,
            [INI_KEY_USER_ID]: this._userId
          }
        },
        existing
      );
      fs.writeFileSync(filePath, content, { mode: 0o600 });
      return true;
    } catch {
      this.log('error', `Failed to save credentials to "${filePath}"`);
      return false;
    }
  }

  setCredentials(email: string, jwt: string, userId: string): void {
    this._email = email;
    this._jwt = jwt;
    this._userId = userId;
  }

  clear(): void {
    this._email = '';
    this._jwt = '';
    this._userId = '';
  }

  hasCredentials(): boolean {
    return this._email.length > 0 && this._jwt.length > 0;
  }

  toCredentials(): AuthCredentials {
    return {
      email: this._email,
      jwt: this._jwt,
      userId: this._userId
    };
  }

  static defaultPath(): string {
    return defaultStoragePath();
  }

  static defaultQtCompanyPath(): string {
    return qtCompanySettingsPath();
  }
}

// ── QtAccount ────────────────────────────────────────────────────────────────

export interface QtAccountEvents {
  stateChanged: (state: AuthState) => void;
  loginSucceeded: (credentials: AuthCredentials) => void;
  loginFailed: (error: LoginError, message: string) => void;
}

/**
 * Qt Account login — mirrors C++ `QtAccount`.
 * Performs HTTPS login to qls.qt.io and stores credentials
 * in qtaccount.ini (compatible with the C++ service).
 */
export class QtAccount {
  private _state: AuthState = AuthState.LoggedOut;
  private _lastError: LoginError = LoginError.None;
  private _lastErrorMessage = '';
  private readonly _storage: QtAccountStorage;
  private readonly _serverUrl: string;
  private readonly _listeners: {
    stateChanged: ((state: AuthState) => void)[];
    loginSucceeded: ((credentials: AuthCredentials) => void)[];
    loginFailed: ((error: LoginError, message: string) => void)[];
  } = {
    stateChanged: [],
    loginSucceeded: [],
    loginFailed: []
  };

  onLog: LogCallback | undefined;

  constructor(options?: { serverUrl?: string; storagePath?: string }) {
    this._serverUrl =
      options?.serverUrl ??
      process.env.QT_ACCOUNT_SERVER_URL ??
      AUTH_SERVER;
    this._storage = new QtAccountStorage();
    this.log('info', `Initializing (server: ${this._serverUrl})`);
    if (options?.storagePath) {
      this._storage.loadFromPath(options.storagePath);
    } else {
      this._storage.load();
    }
    this.log('info', `Has stored credentials: ${String(this._storage.hasCredentials())}`);
  }

  get state(): AuthState {
    return this._state;
  }
  get lastError(): LoginError {
    return this._lastError;
  }
  get lastErrorMessage(): string {
    return this._lastErrorMessage;
  }
  get email(): string {
    return this._storage.email;
  }
  get storage(): QtAccountStorage {
    return this._storage;
  }

  hasStoredCredentials(): boolean {
    return this._storage.hasCredentials();
  }

  private log(level: LogLevel, message: string): void {
    this.onLog?.(level, message);
  }

  on<K extends keyof QtAccountEvents>(event: K, listener: QtAccountEvents[K]): void {
    this._listeners[event].push(listener as never);
  }

  off<K extends keyof QtAccountEvents>(event: K, listener: QtAccountEvents[K]): void {
    const arr = this._listeners[event] as unknown[];
    const idx = arr.indexOf(listener);
    if (idx >= 0) {
      arr.splice(idx, 1);
    }
  }

  /**
   * Login with email and password.
   * Mirrors C++ `QtAccount::login()`.
   */
  async login(email: string, password: string): Promise<AuthCredentials> {
    this.log('info', `Login requested for ${email}`);
    if (!email || !password) {
      return this.fail(
        LoginError.EmptyCredentials,
        'Cannot login with empty email or password'
      );
    }
    return this.performLogin(email, password);
  }

  /**
   * Renew login using stored JWT.
   * Mirrors C++ `QtAccount::renewLogin()`.
   */
  async renewLogin(): Promise<AuthCredentials> {
    this.log('info', 'Renew login requested');
    const email = this._storage.email;
    const jwt = this._storage.jwt;
    if (!email || !jwt) {
      return this.fail(
        LoginError.EmptyCredentials,
        'Cannot renew login without stored credentials'
      );
    }
    this.log('info', `Renewing login for ${email}`);
    return this.performRenewLogin(email, jwt);
  }

  /**
   * Login using environment variables QT_ACCOUNT_LOGIN_EMAIL / QT_ACCOUNT_LOGIN_PASSWORD.
   */
  async loginUsingEnvVariables(): Promise<AuthCredentials | undefined> {
    const email = process.env.QT_ACCOUNT_LOGIN_EMAIL;
    const password = process.env.QT_ACCOUNT_LOGIN_PASSWORD;
    if (!email || !password) {
      this.log('info', 'No env credentials found (QT_ACCOUNT_LOGIN_EMAIL / QT_ACCOUNT_LOGIN_PASSWORD)');
      return undefined;
    }
    this.log('info', `Logging in via environment variables for ${email}`);
    return this.login(email, password);
  }

  logout(): void {
    this.log('info', 'Logging out');
    this._storage.clear();
    this._storage.save();
    this.setState(AuthState.LoggedOut);
    this.log('info', 'Logged out, credentials cleared');
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private setState(state: AuthState): void {
    if (this._state === state) {
      return;
    }
    this.log('info', `State: ${this._state} -> ${state}`);
    this._state = state;
    for (const listener of this._listeners.stateChanged) {
      listener(state);
    }
  }

  private fail(error: LoginError, message: string): never {
    this.log('error', `Auth failed (${String(error)}): ${message}`);
    this._lastError = error;
    this._lastErrorMessage = message;
    this.setState(AuthState.Error);
    for (const listener of this._listeners.loginFailed) {
      listener(error, message);
    }
    throw new Error(message);
  }

  private async performLogin(
    email: string,
    password: string
  ): Promise<AuthCredentials> {
    this.log('info', `Performing login to ${this._serverUrl}${LOGIN_ENDPOINT}`);
    this.setState(AuthState.LoggingIn);

    const payload = {
      host_type: hostType(),
      host_word_size: '64',
      host_os: `${os.type()} ${os.release()}`,
      hw_id: hardwareId(),
      hw_name: os.hostname(),
      src: 'vscode-qt-sm',
      src_version: '1.0.0',
      email,
      password
    };

    return this.postLogin(LOGIN_ENDPOINT, payload, email);
  }

  private async performRenewLogin(
    email: string,
    jwt: string
  ): Promise<AuthCredentials> {
    this.log('info', `Performing token renewal to ${this._serverUrl}${RENEW_TOKEN_ENDPOINT}`);
    this.setState(AuthState.LoggingIn);

    const payload = {
      service_version: '1.0.0',
      hw_id: hardwareId(),
      host_word_size: '64',
      email,
      jwt
    };

    return this.postLogin(RENEW_TOKEN_ENDPOINT, payload, email);
  }

  private async postLogin(
    endpoint: string,
    payload: Record<string, string>,
    email: string
  ): Promise<AuthCredentials> {
    let responseBody: string;
    try {
      responseBody = await httpPost(this._serverUrl + endpoint, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('SSL') || msg.includes('TLS') || msg.includes('certificate')) {
        return this.fail(LoginError.SslError, msg);
      }
      return this.fail(LoginError.NetworkError, `Login request failed: ${msg}`);
    }

    let obj: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(responseBody);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return this.fail(LoginError.InvalidResponse, 'Unexpected reply format');
      }
      obj = parsed as Record<string, unknown>;
    } catch {
      return this.fail(LoginError.InvalidResponse, 'Invalid JSON in login response');
    }

    const jwt = typeof obj.jwt === 'string' ? obj.jwt : '';
    if (!jwt) {
      const serverMessage =
        typeof obj.message === 'string' ? obj.message : 'Unexpected reply';
      return this.fail(LoginError.InvalidResponse, serverMessage);
    }

    const jwtPayload = decodeJwtPayload(jwt);
    if (!jwtPayload) {
      return this.fail(
        LoginError.InvalidResponse,
        'Unexpected JWT format in server response'
      );
    }

    const userId = extractUserId(jwt);
    this._storage.setCredentials(email, jwt, userId);

    this._storage.save();

    this._lastError = LoginError.None;
    this._lastErrorMessage = '';
    this.setState(AuthState.LoggedIn);
    this.log('info', `Login succeeded for ${email} (userId: ${userId})`);

    const credentials = this._storage.toCredentials();
    for (const listener of this._listeners.loginSucceeded) {
      listener(credentials);
    }
    return credentials;
  }
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function httpPost(
  url: string,
  body: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf-8');
        const statusCode = res.statusCode ?? 0;
        if (statusCode === 401 || statusCode === 403) {
          reject(new Error(`InvalidCredentials: ${responseBody}`));
        } else if (statusCode >= 500) {
          reject(new Error(`ServerError: ${responseBody}`));
        } else if (statusCode >= 400) {
          reject(new Error(`HTTP ${String(statusCode)}: ${responseBody}`));
        } else {
          resolve(responseBody);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

// ── Platform helpers ─────────────────────────────────────────────────────────

function hostType(): string {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'mac';
    default:
      return 'linux';
  }
}

function hardwareId(): string {
  // Generate a stable machine-unique hash (mirrors C++ qtAccountUniqueID)
  const raw = `${os.hostname()}-${os.type()}-${os.arch()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
