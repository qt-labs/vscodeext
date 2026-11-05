/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BearerTokenProvider } from '../../src/bearer-token';
import {
  QtCredentialStorage,
  type OidcTokens
} from '../../src/credential-storage';
import { OidcAuthenticator, type OidcClientConfig } from '../../src/oidc';
import { MockOidcServer } from './mock-oidc-server';

describe('BearerTokenProvider', () => {
  let server: MockOidcServer;
  let dir: string;
  let file: string;
  let config: OidcClientConfig;

  beforeEach(async () => {
    server = new MockOidcServer();
    await server.listen();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-bearer-'));
    file = path.join(dir, 'Qt.ini');
    config = {
      issuerUrl: server.issuer,
      clientId: 'qt-pif-sms',
      scopes: 'openid offline_access',
      prompt: 'consent',
      resource: '',
      redirectPort: 0
    };
  });

  afterEach(async () => {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function tokens(overrides: Partial<OidcTokens> = {}): OidcTokens {
    return {
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      idToken: 'id',
      expiresAt: new Date(Date.now() + 3600_000),
      tokenType: 'bearer',
      sub: 'user-1',
      issuer: server.issuer,
      ...overrides
    };
  }

  function provider() {
    const storage = new QtCredentialStorage(file);
    const auth = new OidcAuthenticator(storage, { config });
    return new BearerTokenProvider(storage, auth);
  }

  it('returns a non expired OIDC access token without contacting the server', async () => {
    new QtCredentialStorage(file).storeOidcTokens(tokens());
    assert.equal(await provider().acquire(), 'stored-access');
    assert.equal(server.requests.length, 0);
  });

  it('renews an expired access token before returning it', async () => {
    new QtCredentialStorage(file).storeOidcTokens(
      tokens({ expiresAt: new Date(Date.now() - 1000) })
    );
    server.accessToken = 'renewed-access';
    assert.equal(await provider().acquire(), 'renewed-access');
    assert.equal(server.requestsTo('/v1/oidc/token').length, 1);
    const reader = new QtCredentialStorage(file);
    reader.loadSettings();
    assert.equal(reader.oidcTokens().accessToken, 'renewed-access');
  });

  it('shares one renewal between concurrent callers', async () => {
    new QtCredentialStorage(file).storeOidcTokens(
      tokens({ expiresAt: new Date(Date.now() - 1000) })
    );
    server.accessToken = 'renewed-access';
    const p = provider();
    const results = await Promise.all([p.acquire(), p.acquire(), p.acquire()]);
    assert.deepEqual(results, [
      'renewed-access',
      'renewed-access',
      'renewed-access'
    ]);
    assert.equal(server.requestsTo('/v1/oidc/token').length, 1);
  });

  it('falls back to the personal access token when the renewal is rejected', async () => {
    const storage = new QtCredentialStorage(file);
    storage.storeOidcTokens(tokens({ expiresAt: new Date(Date.now() - 1000) }));
    storage.personalAccessToken = 'pat-1';
    storage.savePersonalAccessToken();
    server.failTokenRequest = true;
    assert.equal(await provider().acquire(), 'pat-1');
  });

  it('rejects when the renewal fails and nothing else is stored', async () => {
    new QtCredentialStorage(file).storeOidcTokens(
      tokens({ expiresAt: new Date(Date.now() - 1000) })
    );
    server.failTokenRequest = true;
    await assert.rejects(provider().acquire(), /Log in again/);
  });

  it('returns the personal access token when no OIDC tokens are stored', async () => {
    const storage = new QtCredentialStorage(file);
    storage.personalAccessToken = 'pat-only';
    storage.savePersonalAccessToken();
    assert.equal(await provider().acquire(), 'pat-only');
    assert.equal(server.requests.length, 0);
  });

  it('returns an empty token when nothing is stored', async () => {
    assert.equal(await provider().acquire(), '');
  });

  it('ignores tokens of another issuer', async () => {
    const storage = new QtCredentialStorage(file);
    storage.storeOidcTokens(tokens({ issuer: 'https://other.example/oidc' }));
    assert.equal(await provider().acquire(), '');
    storage.personalAccessToken = 'pat-2';
    storage.savePersonalAccessToken();
    assert.equal(await provider().acquire(), 'pat-2');
    assert.equal(server.requests.length, 0);
  });
});
