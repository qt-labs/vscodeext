/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Local HTTP server acting as the OIDC provider (discovery, authorization,
 * token and userinfo endpoints under /v1/oidc). A port of the C++
 * MockOidcServer of the service's auto tests.
 */

import * as crypto from 'crypto';
import * as http from 'http';
import * as net from 'net';

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: http.IncomingHttpHeaders;
  body: string;
}

interface MockResponse {
  status: number;
  body: string;
  location?: string;
}

export class MockOidcServer {
  private readonly server: http.Server;
  private readonly sockets = new Set<net.Socket>();
  private port = 0;
  private codeChallenge = '';
  private nonce = '';

  // Tokens the next successful token response carries.
  accessToken = 'mock-access-token-1';
  refreshToken = 'mock-refresh-token-1';
  email = 'user@example.com';
  expiresIn = 3600;
  clientId = 'qt-pif-sms';

  denyAuthorization = false;
  failTokenRequest = false;
  wrongIdTokenAudience = false;
  wrongIdTokenNonce = false;
  expiredIdToken = false;
  wrongRefreshSub = false;
  idTokenWithoutSub = false;
  stallTokenRequest = false;
  /** The Qt account login server serves the email only from userinfo. */
  emailInIdToken = false;
  userInfoStatus = 200;
  userInfoSub = 'user-1';
  /** Empty: issuer() */
  discoveryIssuer = '';
  /** Replaces the whole discovery document body when set. */
  discoveryBody: string | undefined;
  /** Called synchronously before the token response. */
  onTokenRequest: (() => void) | undefined;

  readonly requests: MockRequest[] = [];

  constructor() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
    this.server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
    });
  }

  async listen(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    if (address && typeof address === 'object') {
      this.port = address.port;
    }
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${String(this.port)}`;
  }

  get issuer(): string {
    return `${this.baseUrl}/v1/oidc`;
  }

  requestsTo(path: string): MockRequest[] {
    return this.requests.filter((r) => r.path === path);
  }

  idToken(forRefresh = false): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = this.expiredIdToken ? now - 60 : now + 3600;
    const sub = forRefresh && this.wrongRefreshSub ? 'attacker-1' : 'user-1';
    const header = { alg: 'none' };
    const payload: Record<string, unknown> = {
      sub,
      iss: this.issuer,
      aud: this.wrongIdTokenAudience ? 'wrong-client' : this.clientId,
      nonce: this.wrongIdTokenNonce ? 'wrong-nonce' : this.nonce,
      exp
    };
    if (this.emailInIdToken) {
      payload.email = this.email;
    }
    if (this.idTokenWithoutSub) {
      delete payload.sub;
    }
    const encode = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${encode(header)}.${encode(payload)}.sig`;
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', this.baseUrl);
      const request: MockRequest = {
        method: req.method ?? 'GET',
        path: url.pathname,
        query: url.searchParams,
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf-8')
      };
      this.requests.push(request);
      if (this.stallTokenRequest && request.path === '/v1/oidc/token') {
        // Keep the connection open without responding so the client times out.
        return;
      }
      const response = this.handle(request);
      const headers: http.OutgoingHttpHeaders = {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(response.body),
        connection: 'close'
      };
      if (response.location) {
        headers.location = response.location;
      }
      res.writeHead(response.status, headers);
      res.end(response.body);
    });
  }

  private tokenResponse(forRefresh = false): MockResponse {
    return {
      status: 200,
      body: JSON.stringify({
        access_token: this.accessToken,
        token_type: 'Bearer',
        expires_in: this.expiresIn,
        refresh_token: this.refreshToken,
        id_token: this.idToken(forRefresh)
      })
    };
  }

  private handle(request: MockRequest): MockResponse {
    const oidc = '/v1/oidc';
    if (request.path === `${oidc}/.well-known/openid-configuration`) {
      if (this.discoveryBody !== undefined) {
        return { status: 200, body: this.discoveryBody };
      }
      return {
        status: 200,
        body: JSON.stringify({
          issuer: this.discoveryIssuer || this.issuer,
          authorization_endpoint: `${this.issuer}/auth`,
          token_endpoint: `${this.issuer}/token`,
          userinfo_endpoint: `${this.issuer}/userinfo`
        })
      };
    }

    if (request.path === `${oidc}/userinfo`) {
      if (
        this.userInfoStatus !== 200 ||
        request.headers.authorization !== `Bearer ${this.accessToken}`
      ) {
        return {
          status: this.userInfoStatus !== 200 ? this.userInfoStatus : 401,
          body: ''
        };
      }
      return {
        status: 200,
        body: JSON.stringify({ sub: this.userInfoSub, email: this.email })
      };
    }

    if (request.path === `${oidc}/auth`) {
      this.codeChallenge = request.query.get('code_challenge') ?? '';
      this.nonce = request.query.get('nonce') ?? '';
      const redirect = new URL(request.query.get('redirect_uri') ?? '');
      if (this.denyAuthorization) {
        redirect.searchParams.set('error', 'access_denied');
      } else {
        redirect.searchParams.set('code', 'mock-code');
      }
      redirect.searchParams.set('state', request.query.get('state') ?? '');
      return { status: 302, body: '', location: redirect.toString() };
    }

    if (request.path === `${oidc}/token`) {
      this.onTokenRequest?.();
      const form = new URLSearchParams(request.body);
      const grant = form.get('grant_type');
      const error = JSON.stringify({ error: 'invalid_grant' });
      if (this.failTokenRequest) {
        return { status: 400, body: error };
      }
      if (grant === 'authorization_code') {
        const verifier = form.get('code_verifier') ?? '';
        const challenge = crypto
          .createHash('sha256')
          .update(verifier)
          .digest('base64url');
        if (
          form.get('code') !== 'mock-code' ||
          challenge !== this.codeChallenge
        ) {
          return { status: 400, body: error };
        }
        return this.tokenResponse();
      }
      if (grant === 'refresh_token') {
        return this.tokenResponse(true);
      }
      return { status: 400, body: error };
    }

    return { status: 200, body: '{}' };
  }
}

/**
 * Stands in for the system browser: requests the authorization URL and follows
 * the redirect to the loopback reply handler of the authenticator. Resolves
 * with the final status code and body.
 */
export async function browse(
  url: string,
  redirectsLeft = 5
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          const location = res.headers.location;
          if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
            browse(location, redirectsLeft - 1).then(resolve, reject);
            return;
          }
          resolve({ status, body: Buffer.concat(chunks).toString('utf-8') });
        });
      })
      .on('error', reject);
  });
}
