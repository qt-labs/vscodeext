/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Qt account login with the OIDC authorization code flow with PKCE, and
 * renewal of the resulting tokens. Mirrors the C++
 * `QInstaller::Auth::OidcAuthenticator` of the Qt Software Management
 * Service.
 *
 * `login()` fetches the discovery document of the issuer, listens for the
 * redirect on `http://127.0.0.1:<port>/callback`, hands the authorization URL
 * to `onAuthorizationUrl` for the caller to open in the system browser,
 * exchanges the code, validates the ID token, reads the account email from
 * the ID token or the userinfo endpoint and stores everything with
 * `QtCredentialStorage.storeOidcTokens()`. `refresh()` renews an expired
 * access token with the stored refresh token under the same concurrency
 * rules as the service, which renews tokens in the same file.
 *
 * Token values are never logged.
 */

import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

import { QtCredentialStorage, type OidcTokens } from './credential-storage';
import type { LogCallback, LogLevel } from './types';

// ── Configuration ────────────────────────────────────────────────────────────

export interface OidcClientConfig {
  /** Issuer URL, the discovery path is appended to it. */
  issuerUrl: string;
  clientId: string;
  /** Space separated scopes. */
  scopes: string;
  /** `prompt` parameter of the authorization request, omitted when empty. */
  prompt: string;
  /** `resource` parameter of the authorization and token requests, omitted when empty. */
  resource: string;
  /** Loopback port of the redirect URI, 0 for an ephemeral port. */
  redirectPort: number;
}

/** Environment variables that override the client configuration. */
export const OIDC_ENV = {
  /** Same variable as the C++ auth library. */
  issuerUrl: 'QT_ACCOUNT_OIDC_ISSUER_URL',
  clientId: 'QT_ACCOUNT_OIDC_CLIENT_ID',
  scopes: 'QT_ACCOUNT_OIDC_SCOPES',
  redirectPort: 'QT_ACCOUNT_OIDC_REDIRECT_PORT'
} as const;

/** The Qt account login server registration. */
export const OIDC_DEFAULTS: Readonly<OidcClientConfig> = {
  issuerUrl: 'https://login.qt.io/v1/oidc',
  clientId: 'qt-pif-sms',
  scopes: 'openid offline_access profile email license:read packages:read',
  prompt: 'consent',
  resource: 'urn:qt:oidc:ropc:generic',
  redirectPort: 0
};

/** Applies the `OIDC_ENV` overrides that are set to a copy of `config`. */
export function applyOidcEnvOverrides(
  config: OidcClientConfig
): OidcClientConfig {
  const result = { ...config };
  const issuer = process.env[OIDC_ENV.issuerUrl];
  if (issuer) {
    result.issuerUrl = issuer;
  }
  const clientId = process.env[OIDC_ENV.clientId];
  if (clientId) {
    result.clientId = clientId;
  }
  const scopes = process.env[OIDC_ENV.scopes];
  if (scopes) {
    result.scopes = scopes;
  }
  const port = process.env[OIDC_ENV.redirectPort];
  if (port) {
    const parsed = Number.parseInt(port, 10);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535) {
      result.redirectPort = parsed;
    }
  }
  return result;
}

/** The default registration with the environment overrides applied. */
export function defaultOidcClientConfig(): OidcClientConfig {
  return applyOidcEnvOverrides({ ...OIDC_DEFAULTS });
}

// ── Errors ───────────────────────────────────────────────────────────────────

export enum OidcError {
  /** The operation was cancelled with `cancel()`. */
  Cancelled = 'Cancelled',
  /** A request to the login server failed or timed out. */
  Network = 'Network',
  /** The server rejected the refresh token. The stored OIDC tokens are cleared. */
  InvalidGrant = 'InvalidGrant',
  /** The login server reported an error. */
  ServerError = 'ServerError',
  /** A server response failed validation, or the issuer URL is not allowed. */
  InvalidResponse = 'InvalidResponse',
  /** The credential storage cannot be read or written. */
  Storage = 'Storage',
  /** The stored tokens were issued by another issuer. They are left as they were. */
  IssuerMismatch = 'IssuerMismatch',
  /** A login or refresh is already in progress. */
  Busy = 'Busy'
}

export class OidcAuthError extends Error {
  constructor(
    readonly code: OidcError,
    message: string
  ) {
    super(message);
    this.name = 'OidcAuthError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DISCOVERY_PATH = '/.well-known/openid-configuration';
const CALLBACK_PATH = '/callback';
const CALLBACK_HOST = '127.0.0.1';
const TOKEN_TYPE = 'bearer';
const MAX_DISCOVERY_BYTES = 65536;
const MAX_TOKEN_BYTES = 65536;
// RFC 6749 section 5.2: a token endpoint error is a small JSON object sent with 400.
const TOKEN_ERROR_STATUS = 400;
const MAX_USERINFO_BYTES = 65536;
const DEFAULT_TRANSFER_TIMEOUT_MS = 30000;

/** Strips a trailing slash so issuers compare equal regardless of it. */
export function normalizeIssuer(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Decodes the payload (second segment) of a JWT. Returns `{}` on failure. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not JSON
  }
  return {};
}

function isLoopbackHost(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '');
  const family = net.isIP(bare);
  if (family === 4) {
    return bare.startsWith('127.');
  }
  if (family === 6) {
    return bare === '::1' || bare.toLowerCase() === '::ffff:127.0.0.1';
  }
  return false;
}

function audienceContains(aud: unknown, clientId: string): boolean {
  if (typeof aud === 'string') {
    return aud === clientId;
  }
  return Array.isArray(aud) && aud.includes(clientId);
}

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface HttpResult {
  status: number;
  body: Buffer;
}

interface HttpOptions {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxBytes: number;
  signal: AbortSignal;
}

/** Sends one request and collects up to `maxBytes` of the body. */
async function sendHttp(
  url: string,
  options: HttpOptions
): Promise<HttpResult> {
  return new Promise<HttpResult>((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'https:' ? https : http;
    const headers = { ...options.headers };
    if (options.body !== undefined) {
      headers['content-length'] = String(Buffer.byteLength(options.body));
    }
    const req = transport.request(
      target,
      { method: options.method, headers, signal: options.signal },
      (res) => {
        const chunks: Buffer[] = [];
        let received = 0;
        res.on('data', (chunk: Buffer) => {
          if (received >= options.maxBytes) {
            return;
          }
          const room = options.maxBytes - received;
          const part = chunk.length > room ? chunk.subarray(0, room) : chunk;
          chunks.push(part);
          received += part.length;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) });
        });
        res.on('error', reject);
      }
    );
    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error('Operation timed out'));
    });
    req.on('error', reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

function parseJsonObject(body: Buffer): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(body.toString('utf-8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not JSON
  }
  return undefined;
}

function stringClaim(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  return typeof value === 'string' ? value : '';
}

function callbackPage(ok: boolean, message: string): string {
  const escaped = message.replace(/[&<>"]/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return '&quot;';
    }
  });
  const title = ok ? 'Signed in to Qt Account' : 'Qt Account sign-in failed';
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    `<title>${title}</title>` +
    '<style>body{font-family:system-ui,sans-serif;margin:3em auto;max-width:40em;' +
    'padding:0 1em;color:#222}h1{font-size:1.4em}</style></head><body>' +
    `<h1>${title}</h1><p>${escaped}</p></body></html>`
  );
}

// ── Authenticator ────────────────────────────────────────────────────────────

interface Discovery {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string | undefined;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: Date | undefined;
}

type OperationKind = 'login' | 'refresh';

/** State of the operation in progress, dropped by `cleanup()`. */
interface Operation {
  kind: OperationKind;
  cancelled: boolean;
  abort: AbortController;
  server: http.Server | undefined;
  /** Rejects the wait for the redirect, set while waiting. */
  rejectWait: ((err: OidcAuthError) => void) | undefined;
}

function closeServer(op: Operation): void {
  const server = op.server;
  if (!server) {
    return;
  }
  op.server = undefined;
  server.closeAllConnections();
  server.close();
}

function throwIfCancelled(op: Operation): void {
  if (op.cancelled) {
    throw new OidcAuthError(OidcError.Cancelled, 'Cancelled.');
  }
}

/** Resolves with the authorization code once the browser is redirected back. */
async function waitForRedirect(
  op: Operation,
  state: string,
  issuer: string
): Promise<string> {
  const server = op.server;
  if (!server) {
    throw new OidcAuthError(OidcError.Cancelled, 'Cancelled.');
  }
  return new Promise<string>((resolve, reject) => {
    op.rejectWait = reject;
    const finish = (
      res: http.ServerResponse,
      status: number,
      ok: boolean,
      message: string
    ) => {
      res.writeHead(status, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      });
      res.end(callbackPage(ok, message));
    };
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', `http://${CALLBACK_HOST}`);
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }
      const params = url.searchParams;
      if (params.get('state') !== state) {
        // Not our redirect; keep waiting for the real one.
        finish(
          res,
          400,
          false,
          'This sign-in link does not belong to the pending login.'
        );
        return;
      }
      const iss = params.get('iss');
      if (iss !== null && normalizeIssuer(iss) !== issuer) {
        finish(
          res,
          400,
          false,
          'The sign-in response came from an unexpected server.'
        );
        reject(
          new OidcAuthError(
            OidcError.InvalidResponse,
            `The authorization response names an unexpected issuer: ${iss}`
          )
        );
        return;
      }
      const error = params.get('error');
      if (error !== null) {
        const description = params.get('error_description') ?? '';
        finish(res, 200, false, 'Return to Visual Studio Code to try again.');
        reject(
          new OidcAuthError(
            OidcError.ServerError,
            description
              ? `The login server reported: ${error} (${description})`
              : `The login server reported: ${error}`
          )
        );
        return;
      }
      const code = params.get('code');
      if (!code) {
        finish(
          res,
          400,
          false,
          'The sign-in response carries no authorization code.'
        );
        return;
      }
      finish(
        res,
        200,
        true,
        'You can close this window and return to Visual Studio Code.'
      );
      resolve(code);
    });
  }).finally(() => {
    op.rejectWait = undefined;
  });
}

export interface OidcAuthenticatorOptions {
  /** Client registration, `defaultOidcClientConfig()` when omitted. */
  config?: OidcClientConfig;
  /** Idle timeout of every request to the login server. Default 30 s. */
  transferTimeoutMs?: number;
  onLog?: LogCallback;
  /** Called during `login()` with the URL the user has to open in a browser. */
  onAuthorizationUrl?: (url: string) => void;
}

export class OidcAuthenticator {
  readonly config: OidcClientConfig;
  private readonly storage: QtCredentialStorage;
  private readonly transferTimeoutMs: number;
  private operation: Operation | undefined;
  private discovery: Discovery | undefined;
  private _authorizationUrl: string | undefined;

  onLog: LogCallback | undefined;
  onAuthorizationUrl: ((url: string) => void) | undefined;

  constructor(
    storage: QtCredentialStorage,
    options?: OidcAuthenticatorOptions
  ) {
    this.storage = storage;
    const config = options?.config ?? defaultOidcClientConfig();
    this.config = { ...config, issuerUrl: normalizeIssuer(config.issuerUrl) };
    this.transferTimeoutMs =
      options?.transferTimeoutMs ?? DEFAULT_TRANSFER_TIMEOUT_MS;
    this.onLog = options?.onLog;
    this.onAuthorizationUrl = options?.onAuthorizationUrl;
  }

  /** True while `login()` or `refresh()` is in progress. */
  get isActive(): boolean {
    return this.operation !== undefined;
  }

  /**
   * The authorization URL of the pending or last login, so a UI can offer to
   * open it again. It carries the state and the PKCE challenge, no secret.
   */
  get authorizationUrl(): string | undefined {
    return this._authorizationUrl;
  }

  /**
   * True when `issuer`, as stored with the tokens, names the configured
   * issuer. An empty `issuer` is accepted so tokens stored without one stay
   * usable.
   */
  acceptsIssuer(issuer: string): boolean {
    return issuer === '' || normalizeIssuer(issuer) === this.config.issuerUrl;
  }

  /** True for a URL with a host that uses HTTPS, or plain HTTP on a loopback address. */
  static isAllowedEndpoint(url: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.hostname === '') {
      return false;
    }
    if (parsed.protocol === 'https:') {
      return true;
    }
    return parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname);
  }

  /**
   * Starts the interactive login. Resolves once the tokens and the account
   * email are stored, rejects with an `OidcAuthError` otherwise. Rejects with
   * `OidcError.Busy` while another login or refresh is in progress.
   */
  async login(): Promise<void> {
    const op = this.begin('login');
    try {
      const discovery = await this.discover(op);
      await this.runLogin(op, discovery);
      this.log('info', 'OIDC login succeeded.');
    } catch (err) {
      throw this.finishWithError(op, err);
    } finally {
      this.cleanup(op);
    }
  }

  /**
   * Renews the access token with the stored refresh token. Resolves at once
   * when the file already holds a non expired token renewed by another
   * process. Rejects with `OidcError.IssuerMismatch` for tokens of another
   * issuer and with `OidcError.InvalidGrant` when the server rejects the
   * refresh token, in which case the stored tokens are cleared.
   */
  async refresh(): Promise<void> {
    const op = this.begin('refresh');
    try {
      await this.runRefresh(op);
    } catch (err) {
      throw this.finishWithError(op, err);
    } finally {
      this.cleanup(op);
    }
  }

  /** Cancels the operation in progress; its promise rejects with `Cancelled`. */
  cancel(): void {
    const op = this.operation;
    if (!op) {
      return;
    }
    op.cancelled = true;
    op.abort.abort();
    op.rejectWait?.(new OidcAuthError(OidcError.Cancelled, 'Cancelled.'));
    closeServer(op);
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private log(level: LogLevel, message: string): void {
    this.onLog?.(level, message);
  }

  private begin(kind: OperationKind): Operation {
    if (this.operation) {
      this.log(
        'warn',
        'An OIDC operation is already in progress, ignoring the request.'
      );
      throw new OidcAuthError(
        OidcError.Busy,
        'A Qt Account login or token renewal is already in progress.'
      );
    }
    const op: Operation = {
      kind,
      cancelled: false,
      abort: new AbortController(),
      server: undefined,
      rejectWait: undefined
    };
    this.operation = op;
    return op;
  }

  private finishWithError(op: Operation, err: unknown): OidcAuthError {
    let error: OidcAuthError;
    if (op.cancelled) {
      error = new OidcAuthError(OidcError.Cancelled, 'Cancelled.');
    } else if (err instanceof OidcAuthError) {
      error = err;
    } else {
      error = new OidcAuthError(OidcError.Network, errorMessage(err));
    }
    this.log(
      'warn',
      `${op.kind === 'login' ? 'OIDC login failed' : 'OIDC token renewal failed'}: ${error.message}`
    );
    return error;
  }

  private cleanup(op: Operation): void {
    closeServer(op);
    if (this.operation === op) {
      this.operation = undefined;
    }
  }

  private async request(
    op: Operation,
    url: string,
    options: Omit<HttpOptions, 'timeoutMs' | 'signal'>
  ): Promise<HttpResult> {
    const result = await sendHttp(url, {
      ...options,
      timeoutMs: this.transferTimeoutMs,
      signal: op.abort.signal
    });
    throwIfCancelled(op);
    return result;
  }

  private async discover(op: Operation): Promise<Discovery> {
    const issuer = this.config.issuerUrl;
    if (this.discovery?.issuer === issuer) {
      return this.discovery;
    }
    if (!OidcAuthenticator.isAllowedEndpoint(issuer)) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        `The OIDC issuer URL must use HTTPS (or HTTP on a loopback address): ${issuer}`
      );
    }
    const url = `${issuer}${DISCOVERY_PATH}`;
    this.log('info', `Fetching OIDC discovery document from ${url}`);
    let result: HttpResult;
    try {
      result = await this.request(op, url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        maxBytes: MAX_DISCOVERY_BYTES
      });
    } catch (err) {
      if (err instanceof OidcAuthError) {
        throw err;
      }
      throw new OidcAuthError(
        OidcError.Network,
        `Cannot fetch the OIDC discovery document: ${errorMessage(err)}`
      );
    }
    if (result.status < 200 || result.status >= 300) {
      throw new OidcAuthError(
        OidcError.Network,
        `Cannot fetch the OIDC discovery document: HTTP ${String(result.status)}`
      );
    }
    const doc = parseJsonObject(result.body);
    if (!doc) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        'Cannot parse the OIDC discovery document.'
      );
    }
    const documentIssuer = stringClaim(doc, 'issuer');
    if (normalizeIssuer(documentIssuer) !== issuer) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        `The OIDC discovery document names an unexpected issuer: ${documentIssuer}`
      );
    }
    const authorizationEndpoint = stringClaim(doc, 'authorization_endpoint');
    const tokenEndpoint = stringClaim(doc, 'token_endpoint');
    if (
      !OidcAuthenticator.isAllowedEndpoint(authorizationEndpoint) ||
      !OidcAuthenticator.isAllowedEndpoint(tokenEndpoint)
    ) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        'The OIDC discovery document has no valid HTTPS authorization and token endpoints.'
      );
    }
    const userInfoEndpoint = stringClaim(doc, 'userinfo_endpoint');
    this.discovery = {
      issuer,
      authorizationEndpoint,
      tokenEndpoint,
      userInfoEndpoint: OidcAuthenticator.isAllowedEndpoint(userInfoEndpoint)
        ? userInfoEndpoint
        : undefined
    };
    return this.discovery;
  }

  // ── Login ──────────────────────────────────────────────────────────────

  private async runLogin(op: Operation, discovery: Discovery): Promise<void> {
    const port = await this.listen(op);
    const redirectUri = `http://${CALLBACK_HOST}:${String(port)}${CALLBACK_PATH}`;
    const state = base64url(crypto.randomBytes(16));
    const nonce = base64url(crypto.randomBytes(16));
    const codeVerifier = base64url(crypto.randomBytes(32));
    const codeChallenge = base64url(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );

    // Built by hand so spaces become %20 rather than the + of URLSearchParams;
    // %20 survives URL round trips through other APIs unchanged.
    const params: [string, string][] = [
      ['response_type', 'code'],
      ['client_id', this.config.clientId],
      ['redirect_uri', redirectUri],
      ['scope', this.config.scopes],
      ['state', state],
      ['nonce', nonce],
      ['code_challenge', codeChallenge],
      ['code_challenge_method', 'S256']
    ];
    if (this.config.prompt) {
      params.push(['prompt', this.config.prompt]);
    }
    if (this.config.resource) {
      params.push(['resource', this.config.resource]);
    }
    const url = new URL(discovery.authorizationEndpoint);
    const existing = url.search ? `${url.search.slice(1)}&` : '';
    url.search =
      existing +
      params
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    this._authorizationUrl = url.toString();

    const redirect = waitForRedirect(op, state, discovery.issuer);
    this.log('info', 'Starting the OIDC login in the browser.');
    this.onAuthorizationUrl?.(this._authorizationUrl);
    const code = await redirect;
    closeServer(op);

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
      code_verifier: codeVerifier
    });
    if (this.config.resource) {
      form.set('resource', this.config.resource);
    }
    const response = this.parseTokenResponse(
      'login',
      await this.postTokenEndpoint(op, discovery, form)
    );

    if (!response.idToken) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        'The token response holds no ID token.'
      );
    }
    const claims = decodeJwtPayload(response.idToken);
    if (
      !this.hasValidCoreClaims(claims, discovery.issuer) ||
      stringClaim(claims, 'nonce') !== nonce
    ) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        'The ID token failed validation.'
      );
    }

    const tokens: OidcTokens = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      idToken: response.idToken,
      expiresAt: response.expiresAt,
      tokenType: TOKEN_TYPE,
      sub: stringClaim(claims, 'sub'),
      issuer: discovery.issuer
    };

    const email = stringClaim(claims, 'email');
    if (email) {
      this.storage.accountEmail = email;
    } else if (discovery.userInfoEndpoint) {
      this.storage.accountEmail = await this.fetchUserInfoEmail(
        op,
        discovery.userInfoEndpoint,
        tokens
      );
    }

    if (!this.storage.storeOidcTokens(tokens)) {
      throw new OidcAuthError(
        OidcError.Storage,
        `Cannot store the login tokens: ${this.storage.errorString}`
      );
    }
  }

  private async listen(op: Operation): Promise<number> {
    const server = http.createServer();
    op.server = server;
    const port = this.config.redirectPort;
    return new Promise<number>((resolve, reject) => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        reject(
          new OidcAuthError(
            OidcError.Network,
            `Cannot listen for the login redirect on ${CALLBACK_HOST}:${String(port)}: ${err.message}`
          )
        );
      });
      server.listen(port, CALLBACK_HOST, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(
            new OidcAuthError(
              OidcError.Network,
              'Cannot listen for the login redirect on the loopback interface.'
            )
          );
        }
      });
    });
  }

  private async postTokenEndpoint(
    op: Operation,
    discovery: Discovery,
    form: URLSearchParams
  ): Promise<{ status: number; body: Record<string, unknown> | undefined }> {
    let result: HttpResult;
    try {
      result = await this.request(op, discovery.tokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json'
        },
        body: form.toString(),
        maxBytes: MAX_TOKEN_BYTES
      });
    } catch (err) {
      if (err instanceof OidcAuthError) {
        throw err;
      }
      throw new OidcAuthError(
        OidcError.Network,
        `The OIDC token request failed: ${errorMessage(err)}`
      );
    }
    return { status: result.status, body: parseJsonObject(result.body) };
  }

  private parseTokenResponse(
    kind: OperationKind,
    result: { status: number; body: Record<string, unknown> | undefined }
  ): TokenResponse {
    const body = result.body;
    if (result.status < 200 || result.status >= 300) {
      const error = body ? stringClaim(body, 'error') : '';
      if (error) {
        const description = body ? stringClaim(body, 'error_description') : '';
        throw new OidcAuthError(
          OidcError.ServerError,
          description
            ? `The login server reported: ${error} (${description})`
            : `The login server reported: ${error}`
        );
      }
      throw new OidcAuthError(
        OidcError.ServerError,
        `The login server replied with HTTP ${String(result.status)}.`
      );
    }
    if (!body) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        'Cannot parse the token response.'
      );
    }
    const accessToken = stringClaim(body, 'access_token');
    if (!accessToken) {
      throw new OidcAuthError(
        OidcError.InvalidResponse,
        'The token response holds no access token.'
      );
    }
    const refreshToken = stringClaim(body, 'refresh_token');
    if (!refreshToken && kind === 'login') {
      this.log(
        'warn',
        'The token response holds no refresh token, the login cannot be renewed.'
      );
    }
    const expiresIn = body.expires_in;
    const expiresAt =
      typeof expiresIn === 'number' && Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000)
        : undefined;
    return {
      accessToken,
      refreshToken,
      idToken: stringClaim(body, 'id_token'),
      expiresAt
    };
  }

  private hasValidCoreClaims(
    claims: Record<string, unknown>,
    issuer: string
  ): boolean {
    const exp = claims.exp;
    return (
      normalizeIssuer(stringClaim(claims, 'iss')) === issuer &&
      audienceContains(claims.aud, this.config.clientId) &&
      typeof exp === 'number' &&
      exp * 1000 > Date.now()
    );
  }

  /**
   * Returns the email from the userinfo endpoint, or '' when the request
   * fails or names another subject than the ID token. The login still
   * succeeds without an email.
   */
  private async fetchUserInfoEmail(
    op: Operation,
    endpoint: string,
    tokens: OidcTokens
  ): Promise<string> {
    this.log('info', `Fetching the OIDC account details from ${endpoint}`);
    let result: HttpResult;
    try {
      result = await this.request(op, endpoint, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${tokens.accessToken}`
        },
        maxBytes: MAX_USERINFO_BYTES
      });
    } catch (err) {
      if (err instanceof OidcAuthError) {
        throw err;
      }
      this.log(
        'warn',
        `Cannot fetch the OIDC account details, the account email is not known: ${errorMessage(err)}`
      );
      return '';
    }
    if (result.status < 200 || result.status >= 300) {
      this.log(
        'warn',
        `Cannot fetch the OIDC account details, the account email is not known: HTTP ${String(result.status)}`
      );
      return '';
    }
    const claims = parseJsonObject(result.body) ?? {};
    // OpenID Connect Core 1.0 section 5.3.2: the sub claim must match the ID token.
    const sub = stringClaim(claims, 'sub');
    if (!sub || sub !== tokens.sub) {
      this.log(
        'warn',
        'The OIDC account details name another subject than the ID token, the account email is not known.'
      );
      return '';
    }
    return stringClaim(claims, 'email');
  }

  // ── Refresh ────────────────────────────────────────────────────────────

  private async runRefresh(op: Operation): Promise<void> {
    if (!this.storage.reloadOidcGroup()) {
      throw new OidcAuthError(
        OidcError.Storage,
        `Cannot reload the credential storage: ${this.storage.errorString}`
      );
    }
    const stored = this.storage.oidcTokens();
    if (!this.acceptsIssuer(stored.issuer)) {
      throw new OidcAuthError(
        OidcError.IssuerMismatch,
        'The stored OIDC tokens were issued by a different server. Log in again with the current issuer URL.'
      );
    }
    if (!this.storage.isOidcAccessTokenExpired()) {
      this.log(
        'info',
        'OIDC access token was renewed by another process before the renewal started, reusing it.'
      );
      return;
    }
    const usedRefreshToken = stored.refreshToken;
    if (!usedRefreshToken) {
      throw new OidcAuthError(OidcError.Storage, 'No refresh token is stored.');
    }

    const discovery = await this.discover(op);
    this.log('info', 'Renewing the expired OIDC access token.');
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: usedRefreshToken,
      client_id: this.config.clientId
    });
    if (this.config.resource) {
      form.set('resource', this.config.resource);
    }

    const result = await this.postTokenEndpoint(op, discovery, form);
    if (
      result.status === TOKEN_ERROR_STATUS &&
      result.body !== undefined &&
      stringClaim(result.body, 'error') === 'invalid_grant'
    ) {
      this.handleRejectedRefresh(usedRefreshToken);
      return;
    }
    const response = this.parseTokenResponse('refresh', result);

    const tokens: OidcTokens = {
      ...this.storage.oidcTokens(),
      accessToken: response.accessToken,
      expiresAt: response.expiresAt,
      tokenType: TOKEN_TYPE,
      issuer: discovery.issuer
    };
    if (response.refreshToken) {
      tokens.refreshToken = response.refreshToken;
    }
    if (response.idToken) {
      const claims = decodeJwtPayload(response.idToken);
      if (
        !this.hasValidCoreClaims(claims, discovery.issuer) ||
        stringClaim(claims, 'sub') !== tokens.sub
      ) {
        throw new OidcAuthError(
          OidcError.InvalidResponse,
          'The refreshed ID token failed validation.'
        );
      }
      tokens.idToken = response.idToken;
      const email = stringClaim(claims, 'email');
      if (email) {
        this.storage.accountEmail = email;
      }
    }

    if (!this.storage.storeRenewedOidcTokens(tokens, usedRefreshToken)) {
      throw new OidcAuthError(
        OidcError.Storage,
        `Cannot store the renewed tokens: ${this.storage.errorString}`
      );
    }
    this.log('info', 'OIDC access token renewed.');
  }

  /**
   * The server rejected the refresh token. Either another process renewed the
   * tokens meanwhile (the file holds a non expired token: reuse it) or the
   * token is revoked (clear the tokens and fail with `InvalidGrant`).
   */
  private handleRejectedRefresh(usedRefreshToken: string): void {
    if (
      this.storage.reloadOidcGroup() &&
      !this.storage.isOidcAccessTokenExpired()
    ) {
      this.log(
        'info',
        'OIDC refresh token was rejected because another process renewed the tokens meanwhile, reusing them.'
      );
      return;
    }
    const cleared: OidcTokens = {
      ...this.storage.oidcTokens(),
      accessToken: '',
      refreshToken: ''
    };
    if (!this.storage.storeRenewedOidcTokens(cleared, usedRefreshToken)) {
      this.log(
        'warn',
        `Cannot clear revoked OIDC tokens: ${this.storage.errorString}`
      );
      this.storage.reloadOidcGroup();
    }
    throw new OidcAuthError(
      OidcError.InvalidGrant,
      'The refresh token has been revoked. Log in again.'
    );
  }
}
