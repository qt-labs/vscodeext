/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  QtCredentialStorage,
  emptyOidcTokens,
  settingsLockPath,
  type OidcTokens
} from '../../src/credential-storage';

const EOL = process.platform === 'win32' ? '\r\n' : '\n';

function sampleTokens(overrides: Partial<OidcTokens> = {}): OidcTokens {
  return {
    accessToken: 'at-1',
    refreshToken: 'rt-1',
    idToken: 'id-1',
    expiresAt: new Date('2026-09-24T12:00:00.000Z'),
    tokenType: 'bearer',
    sub: 'user-1',
    issuer: 'https://login.qt.io/v1/oidc',
    ...overrides
  };
}

describe('QtCredentialStorage', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-cred-'));
    file = path.join(dir, 'Qt', 'Qt.ini');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stores login tokens and reads them back with a fresh instance', () => {
    const writer = new QtCredentialStorage(file);
    writer.accountEmail = 'user@example.com';
    assert.equal(
      writer.storeOidcTokens(sampleTokens()),
      true,
      writer.errorString
    );

    const text = fs.readFileSync(file, 'utf-8');
    assert.ok(text.includes(`[auth]${EOL}`), text);
    assert.ok(text.includes(`oidc_pkce\\access_token=at-1${EOL}`), text);
    assert.ok(
      text.includes('oidc_pkce\\expires_at=2026-09-24T12:00:00Z'),
      text
    );
    assert.ok(text.includes('oidc_pkce\\token_type=bearer'), text);
    assert.ok(text.includes('oidc_pkce\\sub=user-1'), text);
    assert.ok(text.includes('qtaccount\\email=user@example.com'), text);

    const reader = new QtCredentialStorage(file);
    assert.equal(reader.loadSettings(), true, reader.errorString);
    assert.deepEqual(reader.oidcTokens(), sampleTokens());
    assert.equal(reader.accountEmail, 'user@example.com');
    assert.equal(reader.personalAccessToken, '');
  });

  it('writes an empty expires_at for an unknown expiry', () => {
    const s = new QtCredentialStorage(file);
    s.storeOidcTokens(sampleTokens({ expiresAt: undefined }));
    assert.ok(
      fs.readFileSync(file, 'utf-8').includes(`oidc_pkce\\expires_at=${EOL}`)
    );
    const r = new QtCredentialStorage(file);
    r.loadSettings();
    assert.equal(r.oidcTokens().expiresAt, undefined);
    assert.equal(r.isOidcAccessTokenExpired(), true);
  });

  it('preserves other sections and the other auth groups', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      [
        '[auth]',
        'pat\\access_token=pat-1',
        '',
        '[telemetry]',
        'organization\\enabled=yes',
        ''
      ].join(EOL)
    );
    const s = new QtCredentialStorage(file);
    s.storeOidcTokens(sampleTokens());
    const text = fs.readFileSync(file, 'utf-8');
    assert.ok(text.includes('pat\\access_token=pat-1'), text);
    assert.ok(
      text.includes(`[telemetry]${EOL}organization\\enabled=yes`),
      text
    );

    const r = new QtCredentialStorage(file);
    r.loadSettings();
    assert.equal(r.personalAccessToken, 'pat-1');
    assert.equal(r.oidcTokens().accessToken, 'at-1');
  });

  it('reports expiry with a 30 second margin', () => {
    const s = new QtCredentialStorage(file);
    const now = Date.now();
    const cases: [Date | undefined, boolean][] = [
      [undefined, true],
      [new Date(now - 10_000), true],
      [new Date(now + 10_000), true],
      [new Date(now + 3_600_000), false]
    ];
    for (const [expiresAt, expected] of cases) {
      s.storeOidcTokens(sampleTokens({ expiresAt }));
      assert.equal(s.isOidcAccessTokenExpired(), expected, String(expiresAt));
    }
  });

  it('storeRenewedOidcTokens writes when the file still holds the used refresh token', () => {
    const s = new QtCredentialStorage(file);
    s.storeOidcTokens(sampleTokens());
    const renewed = sampleTokens({ accessToken: 'at-2', refreshToken: 'rt-2' });
    assert.equal(s.storeRenewedOidcTokens(renewed, 'rt-1'), true);
    const r = new QtCredentialStorage(file);
    r.loadSettings();
    assert.equal(r.oidcTokens().accessToken, 'at-2');
    assert.equal(r.oidcTokens().refreshToken, 'rt-2');
  });

  it('storeRenewedOidcTokens keeps newer tokens stored meanwhile', () => {
    const s = new QtCredentialStorage(file);
    s.storeOidcTokens(sampleTokens());
    // Another process logs in again.
    const other = new QtCredentialStorage(file);
    other.accountEmail = 'other@example.com';
    other.storeOidcTokens(
      sampleTokens({ accessToken: 'at-new', refreshToken: 'rt-new' })
    );

    const renewed = sampleTokens({ accessToken: 'at-2', refreshToken: 'rt-2' });
    assert.equal(s.storeRenewedOidcTokens(renewed, 'rt-1'), true);
    assert.equal(s.oidcTokens().accessToken, 'at-new');
    assert.equal(s.oidcTokens().refreshToken, 'rt-new');
    assert.equal(s.accountEmail, 'other@example.com');
    const r = new QtCredentialStorage(file);
    r.loadSettings();
    assert.equal(r.oidcTokens().accessToken, 'at-new');
  });

  it('clearOidcTokens removes oidc and email but keeps the PAT, and vice versa', () => {
    const s = new QtCredentialStorage(file);
    s.accountEmail = 'user@example.com';
    s.storeOidcTokens(sampleTokens());
    s.personalAccessToken = 'pat-1';
    assert.equal(s.savePersonalAccessToken(), true);

    assert.equal(s.clearOidcTokens(), true);
    assert.deepEqual(s.oidcTokens(), emptyOidcTokens());
    assert.equal(s.accountEmail, '');
    let text = fs.readFileSync(file, 'utf-8');
    assert.ok(!text.includes('oidc_pkce'), text);
    assert.ok(!text.includes('qtaccount'), text);
    assert.ok(text.includes('pat\\access_token=pat-1'), text);

    s.storeOidcTokens(sampleTokens());
    assert.equal(s.clearPersonalAccessToken(), true);
    assert.equal(s.personalAccessToken, '');
    text = fs.readFileSync(file, 'utf-8');
    assert.ok(!text.includes('pat\\'), text);
    assert.ok(text.includes('oidc_pkce\\access_token=at-1'), text);
  });

  it('loadSettings fails on a missing file and names the path', () => {
    const s = new QtCredentialStorage(file);
    assert.equal(s.loadSettings(), false);
    assert.ok(s.errorString.includes(file));
  });

  it('reloadOidcGroup leaves the PAT in memory alone', () => {
    const s = new QtCredentialStorage(file);
    s.storeOidcTokens(sampleTokens());
    s.personalAccessToken = 'memory-only';
    const other = new QtCredentialStorage(file);
    other.storeOidcTokens(sampleTokens({ accessToken: 'at-3' }));
    assert.equal(s.reloadOidcGroup(), true);
    assert.equal(s.oidcTokens().accessToken, 'at-3');
    assert.equal(s.personalAccessToken, 'memory-only');
  });

  it(
    'restricts the file to the owner on POSIX',
    { skip: process.platform === 'win32' },
    () => {
      const s = new QtCredentialStorage(file);
      s.storeOidcTokens(sampleTokens());
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    }
  );

  it('removes a lock left behind by a dead process', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      settingsLockPath(file),
      `999999\nQtSoftwareManagementService\n${os.hostname()}\n`
    );
    const s = new QtCredentialStorage(file, { lockTimeoutMs: 500 });
    assert.equal(s.storeOidcTokens(sampleTokens()), true, s.errorString);
    assert.equal(fs.existsSync(settingsLockPath(file)), false);
  });

  it('gives up on a live lock after the timeout', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      settingsLockPath(file),
      `${String(process.pid)}\nnode\n${os.hostname()}\n`
    );
    const s = new QtCredentialStorage(file, { lockTimeoutMs: 300 });
    const started = Date.now();
    assert.equal(s.storeOidcTokens(sampleTokens()), false);
    assert.ok(Date.now() - started >= 250);
    assert.ok(/lock/i.test(s.errorString), s.errorString);
    assert.equal(fs.existsSync(file), false);
    assert.deepEqual(s.oidcTokens(), emptyOidcTokens());
  });

  it('treats an old lock of a live process as stale after staleLockMs', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lock = settingsLockPath(file);
    fs.writeFileSync(lock, `${String(process.pid)}\nnode\n${os.hostname()}\n`);
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, old, old);
    const s = new QtCredentialStorage(file, {
      lockTimeoutMs: 500,
      staleLockMs: 30_000
    });
    assert.equal(s.storeOidcTokens(sampleTokens()), true, s.errorString);
  });
});
