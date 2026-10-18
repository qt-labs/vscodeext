/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import {
  QtCredentialStorage,
  type OidcTokens
} from '../../src/credential-storage';
import {
  OIDC_DEFAULTS,
  OIDC_ENV,
  OidcAuthError,
  OidcAuthenticator,
  OidcError,
  applyOidcEnvOverrides,
  decodeJwtPayload,
  defaultOidcClientConfig,
  type OidcClientConfig
} from '../../src/oidc';
import { MockOidcServer, browse } from './mock-oidc-server';

function storedTokens(
  overrides: Partial<OidcTokens>,
  issuer: string
): OidcTokens {
  return {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    idToken: 'old-id',
    expiresAt: new Date(Date.now() - 60_000),
    tokenType: 'bearer',
    sub: 'user-1',
    issuer,
    ...overrides
  };
}

async function rejectsWith(
  promise: Promise<unknown>,
  code: OidcError,
  messagePart?: string
): Promise<OidcAuthError> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  assert.ok(
    caught instanceof OidcAuthError,
    `expected OidcAuthError, got ${String(caught)}`
  );
  assert.equal(caught.code, code, caught.message);
  if (messagePart) {
    assert.ok(caught.message.includes(messagePart), caught.message);
  }
  return caught;
}

async function portIsClosed(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(true));
  });
}

describe('OidcAuthenticator', () => {
  let server: MockOidcServer;
  let dir: string;
  let file: string;
  let storage: QtCredentialStorage;
  let config: OidcClientConfig;

  beforeEach(async () => {
    server = new MockOidcServer();
    await server.listen();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-oidc-'));
    file = path.join(dir, 'Qt.ini');
    storage = new QtCredentialStorage(file);
    config = {
      issuerUrl: server.issuer,
      clientId: 'qt-pif-sms',
      scopes: 'openid offline_access',
      prompt: 'consent',
      resource: 'urn:qt:oidc:ropc:generic',
      redirectPort: 0
    };
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function authenticator(options: { transferTimeoutMs?: number } = {}) {
    return new OidcAuthenticator(storage, { config, ...options });
  }

  /** Starts a login and drives the browser once the URL is announced. */
  async function loginWithBrowser(auth: OidcAuthenticator) {
    const urlPromise = new Promise<string>((resolve) => {
      auth.onAuthorizationUrl = resolve;
    });
    const done = auth.login();
    done.catch(() => undefined); // inspected by the caller
    const url = await urlPromise;
    const page = await browse(url);
    return { done, url, page };
  }

  // ── Login ──────────────────────────────────────────────────────────────

  it('runs the authorization code flow with PKCE and stores the tokens', async () => {
    const auth = authenticator();
    const { done, url, page } = await loginWithBrowser(auth);
    await done;

    const authUrl = new URL(url);
    assert.equal(authUrl.pathname, '/v1/oidc/auth');
    assert.equal(authUrl.searchParams.get('response_type'), 'code');
    assert.equal(authUrl.searchParams.get('client_id'), 'qt-pif-sms');
    assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authUrl.searchParams.get('prompt'), 'consent');
    assert.equal(
      authUrl.searchParams.get('resource'),
      'urn:qt:oidc:ropc:generic'
    );
    assert.equal(authUrl.searchParams.get('scope'), 'openid offline_access');
    assert.match(
      authUrl.searchParams.get('redirect_uri') ?? '',
      /^http:\/\/127\.0\.0\.1:\d+\/callback$/
    );
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('return to Visual Studio Code'), page.body);

    const tokenRequests = server.requestsTo('/v1/oidc/token');
    assert.equal(tokenRequests.length, 1);
    const form = new URLSearchParams(tokenRequests[0]!.body);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('client_id'), 'qt-pif-sms');
    assert.equal(form.get('resource'), 'urn:qt:oidc:ropc:generic');
    assert.ok(form.get('code_verifier'));
    assert.equal(server.requestsTo('/v1/oidc/userinfo').length, 1);

    const reader = new QtCredentialStorage(file);
    assert.equal(reader.loadSettings(), true);
    const tokens = reader.oidcTokens();
    assert.equal(tokens.accessToken, 'mock-access-token-1');
    assert.equal(tokens.refreshToken, 'mock-refresh-token-1');
    assert.equal(
      tokens.idToken,
      server.requestsTo('/v1/oidc/token').length ? tokens.idToken : ''
    );
    assert.ok(tokens.idToken.split('.').length === 3);
    assert.equal(tokens.tokenType, 'bearer');
    assert.equal(tokens.sub, 'user-1');
    assert.equal(tokens.issuer, server.issuer);
    assert.ok(tokens.expiresAt);
    const delta = tokens.expiresAt.getTime() - Date.now();
    assert.ok(delta > 3500_000 && delta <= 3600_000, String(delta));
    assert.equal(reader.accountEmail, 'user@example.com');
    assert.equal(reader.isOidcAccessTokenExpired(), false);
    assert.equal(auth.isActive, false);
    assert.equal(auth.authorizationUrl, url);

    // No request ever carried a token in its URL.
    for (const r of server.requests) {
      assert.ok(!r.query.toString().includes('mock-access-token'));
    }
  });

  it('reports login failures with the right error kind', async () => {
    const cases: {
      name: string;
      arrange: () => void;
      code: OidcError;
      browses: boolean;
    }[] = [
      {
        name: 'authorization denied',
        arrange: () => (server.denyAuthorization = true),
        code: OidcError.ServerError,
        browses: true
      },
      {
        name: 'token request rejected',
        arrange: () => (server.failTokenRequest = true),
        code: OidcError.ServerError,
        browses: true
      },
      {
        name: 'discovery names another issuer',
        arrange: () => (server.discoveryIssuer = 'https://other.example/oidc'),
        code: OidcError.InvalidResponse,
        browses: false
      },
      {
        name: 'ID token wrong audience',
        arrange: () => (server.wrongIdTokenAudience = true),
        code: OidcError.InvalidResponse,
        browses: true
      },
      {
        name: 'ID token wrong nonce',
        arrange: () => (server.wrongIdTokenNonce = true),
        code: OidcError.InvalidResponse,
        browses: true
      },
      {
        name: 'ID token expired',
        arrange: () => (server.expiredIdToken = true),
        code: OidcError.InvalidResponse,
        browses: true
      }
    ];
    for (const c of cases) {
      server.denyAuthorization = false;
      server.failTokenRequest = false;
      server.discoveryIssuer = '';
      server.wrongIdTokenAudience = false;
      server.wrongIdTokenNonce = false;
      server.expiredIdToken = false;
      c.arrange();
      const auth = authenticator();
      if (c.browses) {
        const { done } = await loginWithBrowser(auth);
        await rejectsWith(done, c.code);
      } else {
        await rejectsWith(auth.login(), c.code);
      }
      assert.equal(auth.isActive, false, c.name);
      assert.equal(fs.existsSync(file), false, `${c.name}: nothing stored`);
    }
  });

  it('refuses an issuer without https before any request', async () => {
    config.issuerUrl = 'http://example.com/oidc';
    await rejectsWith(
      authenticator().login(),
      OidcError.InvalidResponse,
      'HTTPS'
    );
    assert.equal(server.requests.length, 0);
  });

  it('cancel() rejects the pending login and closes the loopback port', async () => {
    const auth = authenticator();
    const urlPromise = new Promise<string>((resolve) => {
      auth.onAuthorizationUrl = resolve;
    });
    const done = auth.login();
    const url = await urlPromise;
    const port = Number(
      new URL(new URL(url).searchParams.get('redirect_uri') ?? '').port
    );
    assert.equal(auth.isActive, true);
    auth.cancel();
    await rejectsWith(done, OidcError.Cancelled);
    assert.equal(auth.isActive, false);
    assert.equal(await portIsClosed(port), true);
    assert.equal(fs.existsSync(file), false);
  });

  it('cancel() can be followed by a new login', async () => {
    const auth = authenticator();
    const first = auth.login();
    first.catch(() => undefined);
    auth.cancel();
    await rejectsWith(first, OidcError.Cancelled);
    const { done } = await loginWithBrowser(auth);
    await done;
    assert.equal(new QtCredentialStorage(file).loadSettings(), true);
  });

  it('takes the account email from the ID token or the userinfo endpoint', async () => {
    const cases: {
      name: string;
      emailInIdToken: boolean;
      idTokenWithoutSub: boolean;
      userInfoStatus: number;
      userInfoSub: string;
      expectEmail: boolean;
      userInfoRequests: number;
    }[] = [
      {
        name: 'from ID token',
        emailInIdToken: true,
        idTokenWithoutSub: false,
        userInfoStatus: 200,
        userInfoSub: 'user-1',
        expectEmail: true,
        userInfoRequests: 0
      },
      {
        name: 'from userinfo',
        emailInIdToken: false,
        idTokenWithoutSub: false,
        userInfoStatus: 200,
        userInfoSub: 'user-1',
        expectEmail: true,
        userInfoRequests: 1
      },
      {
        name: 'userinfo fails',
        emailInIdToken: false,
        idTokenWithoutSub: false,
        userInfoStatus: 500,
        userInfoSub: 'user-1',
        expectEmail: false,
        userInfoRequests: 1
      },
      {
        name: 'userinfo names another subject',
        emailInIdToken: false,
        idTokenWithoutSub: false,
        userInfoStatus: 200,
        userInfoSub: 'user-2',
        expectEmail: false,
        userInfoRequests: 1
      },
      {
        name: 'no subject anywhere',
        emailInIdToken: false,
        idTokenWithoutSub: true,
        userInfoStatus: 200,
        userInfoSub: '',
        expectEmail: false,
        userInfoRequests: 1
      }
    ];
    for (const c of cases) {
      server.requests.length = 0;
      server.emailInIdToken = c.emailInIdToken;
      server.idTokenWithoutSub = c.idTokenWithoutSub;
      server.userInfoStatus = c.userInfoStatus;
      server.userInfoSub = c.userInfoSub;
      fs.rmSync(file, { force: true });
      storage = new QtCredentialStorage(file);
      const { done } = await loginWithBrowser(authenticator());
      await done;
      assert.equal(
        server.requestsTo('/v1/oidc/userinfo').length,
        c.userInfoRequests,
        c.name
      );
      const reader = new QtCredentialStorage(file);
      reader.loadSettings();
      assert.equal(reader.oidcTokens().accessToken, server.accessToken, c.name);
      assert.equal(
        reader.accountEmail,
        c.expectEmail ? server.email : '',
        c.name
      );
    }
  });

  it('rejects a second login while one is active', async () => {
    const auth = authenticator();
    const urlPromise = new Promise<string>((resolve) => {
      auth.onAuthorizationUrl = resolve;
    });
    const first = auth.login();
    const url = await urlPromise;
    await rejectsWith(auth.login(), OidcError.Busy);
    await browse(url);
    await first;
  });

  it('caches the discovery document between operations', async () => {
    const auth = authenticator();
    const a = await loginWithBrowser(auth);
    await a.done;
    const b = await loginWithBrowser(auth);
    await b.done;
    assert.equal(
      server.requestsTo('/v1/oidc/.well-known/openid-configuration').length,
      1
    );
  });

  it('rejects an oversized discovery document', async () => {
    server.discoveryBody = `{"issuer":"${server.issuer}","pad":"${'x'.repeat(70_000)}"}`;
    await rejectsWith(
      authenticator().login(),
      OidcError.InvalidResponse,
      'parse'
    );
  });

  it('omits empty prompt and resource parameters', async () => {
    config.prompt = '';
    config.resource = '';
    const { done, url } = await loginWithBrowser(authenticator());
    await done;
    const params = new URL(url).searchParams;
    assert.equal(params.has('prompt'), false);
    assert.equal(params.has('resource'), false);
    const form = new URLSearchParams(
      server.requestsTo('/v1/oidc/token')[0]!.body
    );
    assert.equal(form.has('resource'), false);
  });

  // ── Refresh ────────────────────────────────────────────────────────────

  it('renews an expired access token with the refresh token', async () => {
    storage.accountEmail = 'user@example.com';
    assert.equal(
      storage.storeOidcTokens(storedTokens({}, server.issuer)),
      true
    );
    server.accessToken = 'mock-access-token-2';
    server.refreshToken = 'mock-refresh-token-2';
    await authenticator().refresh();

    const form = new URLSearchParams(
      server.requestsTo('/v1/oidc/token')[0]!.body
    );
    assert.equal(form.get('grant_type'), 'refresh_token');
    assert.equal(form.get('refresh_token'), 'old-refresh');
    assert.equal(form.get('client_id'), 'qt-pif-sms');
    assert.equal(form.get('resource'), 'urn:qt:oidc:ropc:generic');

    const reader = new QtCredentialStorage(file);
    reader.loadSettings();
    const tokens = reader.oidcTokens();
    assert.equal(tokens.accessToken, 'mock-access-token-2');
    assert.equal(tokens.refreshToken, 'mock-refresh-token-2');
    assert.equal(tokens.sub, 'user-1');
    assert.equal(tokens.issuer, server.issuer);
    assert.equal(reader.isOidcAccessTokenExpired(), false);
    assert.equal(reader.accountEmail, 'user@example.com');
  });

  it('clears the tokens when the server rejects the refresh token', async () => {
    storage.storeOidcTokens(storedTokens({}, server.issuer));
    server.failTokenRequest = true;
    await rejectsWith(
      authenticator().refresh(),
      OidcError.InvalidGrant,
      'Log in again'
    );
    const reader = new QtCredentialStorage(file);
    reader.loadSettings();
    assert.equal(reader.oidcTokens().accessToken, '');
    assert.equal(reader.oidcTokens().refreshToken, '');
    assert.equal(reader.oidcTokens().sub, 'user-1');
  });

  it('rejects a refreshed ID token with another sub or an expired one', async () => {
    for (const flag of ['wrongRefreshSub', 'expiredIdToken'] as const) {
      fs.rmSync(file, { force: true });
      storage = new QtCredentialStorage(file);
      storage.storeOidcTokens(storedTokens({}, server.issuer));
      server.wrongRefreshSub = flag === 'wrongRefreshSub';
      server.expiredIdToken = flag === 'expiredIdToken';
      await rejectsWith(
        authenticator().refresh(),
        OidcError.InvalidResponse,
        'validation'
      );
      const reader = new QtCredentialStorage(file);
      reader.loadSettings();
      assert.equal(reader.oidcTokens().accessToken, 'old-access', flag);
    }
  });

  it('fails with Network when the token endpoint stalls past the transfer timeout', async () => {
    storage.storeOidcTokens(storedTokens({}, server.issuer));
    server.stallTokenRequest = true;
    const started = Date.now();
    await rejectsWith(
      authenticator({ transferTimeoutMs: 300 }).refresh(),
      OidcError.Network
    );
    assert.ok(Date.now() - started < 5000);
    const reader = new QtCredentialStorage(file);
    reader.loadSettings();
    assert.equal(reader.oidcTokens().refreshToken, 'old-refresh');
  });

  it('reuses tokens renewed by another process during the request', async () => {
    storage.storeOidcTokens(storedTokens({}, server.issuer));
    server.failTokenRequest = true;
    server.onTokenRequest = () => {
      const other = new QtCredentialStorage(file);
      other.loadSettings();
      other.storeRenewedOidcTokens(
        storedTokens(
          {
            accessToken: 'elsewhere-access',
            refreshToken: 'elsewhere-refresh',
            expiresAt: new Date(Date.now() + 3600_000)
          },
          server.issuer
        ),
        'old-refresh'
      );
    };
    await authenticator().refresh();
    assert.equal(storage.oidcTokens().accessToken, 'elsewhere-access');
    assert.equal(storage.oidcTokens().refreshToken, 'elsewhere-refresh');
  });

  it('does not contact the server when the file already holds a fresh token', async () => {
    storage.storeOidcTokens(
      storedTokens(
        { expiresAt: new Date(Date.now() + 3600_000) },
        server.issuer
      )
    );
    await authenticator().refresh();
    assert.equal(server.requests.length, 0);
  });

  it('refuses to renew tokens of another issuer', async () => {
    storage.storeOidcTokens(storedTokens({}, 'https://other.example/oidc'));
    await rejectsWith(authenticator().refresh(), OidcError.IssuerMismatch);
    assert.equal(server.requests.length, 0);
    const reader = new QtCredentialStorage(file);
    reader.loadSettings();
    assert.equal(reader.oidcTokens().accessToken, 'old-access');
  });

  it('accepts tokens stored without an issuer', async () => {
    storage.storeOidcTokens(storedTokens({ issuer: '' }, server.issuer));
    await authenticator().refresh();
    assert.equal(server.requestsTo('/v1/oidc/token').length, 1);
  });

  it('fails with Storage when no refresh token is stored', async () => {
    storage.storeOidcTokens(storedTokens({ refreshToken: '' }, server.issuer));
    await rejectsWith(
      authenticator().refresh(),
      OidcError.Storage,
      'refresh token'
    );
    assert.equal(server.requests.length, 0);
  });

  it('fails with Storage when the settings file is missing', async () => {
    await rejectsWith(authenticator().refresh(), OidcError.Storage);
  });

  // ── Helpers and config ─────────────────────────────────────────────────

  it('acceptsIssuer ignores trailing slashes and accepts an empty issuer', () => {
    const auth = authenticator();
    assert.equal(auth.acceptsIssuer(`${server.issuer}/`), true);
    assert.equal(auth.acceptsIssuer(''), true);
    assert.equal(auth.acceptsIssuer('https://other.example'), false);
  });

  it('isAllowedEndpoint accepts https and loopback http only', () => {
    assert.equal(
      OidcAuthenticator.isAllowedEndpoint('https://login.qt.io/v1/oidc'),
      true
    );
    assert.equal(
      OidcAuthenticator.isAllowedEndpoint('http://127.0.0.1:8080/x'),
      true
    );
    assert.equal(
      OidcAuthenticator.isAllowedEndpoint('http://[::1]:8080/x'),
      true
    );
    assert.equal(
      OidcAuthenticator.isAllowedEndpoint('http://localhost:8080/x'),
      false
    );
    assert.equal(
      OidcAuthenticator.isAllowedEndpoint('http://example.com/x'),
      false
    );
    assert.equal(OidcAuthenticator.isAllowedEndpoint('not a url'), false);
    assert.equal(
      OidcAuthenticator.isAllowedEndpoint('file:///etc/passwd'),
      false
    );
  });

  it('decodeJwtPayload returns the payload object or {}', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u', exp: 1 })).toString(
      'base64url'
    );
    assert.deepEqual(decodeJwtPayload(`h.${payload}.s`), { sub: 'u', exp: 1 });
    assert.deepEqual(decodeJwtPayload('garbage'), {});
    assert.deepEqual(decodeJwtPayload('a.!!.c'), {});
  });

  it('defaultOidcClientConfig applies environment overrides', () => {
    const saved = Object.fromEntries(
      Object.values(OIDC_ENV).map((name) => [name, process.env[name]])
    );
    try {
      for (const name of Object.values(OIDC_ENV)) {
        delete process.env[name];
      }
      assert.deepEqual(defaultOidcClientConfig(), OIDC_DEFAULTS);
      process.env[OIDC_ENV.issuerUrl] = 'http://127.0.0.1:1/oidc';
      process.env[OIDC_ENV.clientId] = 'staging-client';
      process.env[OIDC_ENV.scopes] = 'openid';
      process.env[OIDC_ENV.redirectPort] = '54867';
      const c = defaultOidcClientConfig();
      assert.equal(c.issuerUrl, 'http://127.0.0.1:1/oidc');
      assert.equal(c.clientId, 'staging-client');
      assert.equal(c.scopes, 'openid');
      assert.equal(c.redirectPort, 54867);
      assert.equal(c.prompt, OIDC_DEFAULTS.prompt);
      process.env[OIDC_ENV.redirectPort] = 'nope';
      assert.equal(applyOidcEnvOverrides({ ...OIDC_DEFAULTS }).redirectPort, 0);
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });
});
