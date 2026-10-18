/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Unit tests for QtAccountStorage and QtAccount auth helpers.
 * Tests INI read/write, JWT decoding, and credential lifecycle.
 */

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { QtAccountStorage, QtAccount } from '../../src/qt-account';
import { AuthState, LoginError } from '../../src/types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sms-auth-test-'));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// A minimal but valid JWT (header.payload.signature) with sub="user-42"
// payload: {"sub":"user-42","email":"test@qt.io","iat":1700000000}
const TEST_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  Buffer.from(
    JSON.stringify({ sub: 'user-42', email: 'test@qt.io', iat: 1700000000 })
  ).toString('base64url'),
  'fake-signature'
].join('.');

// ── QtAccountStorage: legacy format ──────────────────────────────────────────

describe('QtAccountStorage (legacy INI)', () => {
  let dir: string;

  afterEach(() => {
    if (dir) {
      cleanup(dir);
    }
  });

  it('saves and loads credentials round-trip', () => {
    dir = tmpDir();
    const filePath = path.join(dir, 'qtaccount.ini');

    const storage = new QtAccountStorage();
    storage.setCredentials('user@qt.io', 'jwt-token-123', 'uid-1');
    const saved = storage.saveToPath(filePath);
    assert.equal(saved, true);

    const storage2 = new QtAccountStorage();
    const loaded = storage2.loadFromPath(filePath);
    assert.equal(loaded, true);
    assert.equal(storage2.email, 'user@qt.io');
    assert.equal(storage2.jwt, 'jwt-token-123');
    assert.equal(storage2.userId, 'uid-1');
  });

  it('produces QSettings-compatible INI format', () => {
    dir = tmpDir();
    const filePath = path.join(dir, 'qtaccount.ini');

    const storage = new QtAccountStorage();
    storage.setCredentials('a@b.c', 'tok', 'u1');
    storage.saveToPath(filePath);

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('[QtAccount]'));
    assert.ok(content.includes('email=a@b.c'));
    assert.ok(content.includes('jwt=tok'));
    assert.ok(content.includes('u=u1'));
  });

  it('returns false when loading nonexistent file', () => {
    const storage = new QtAccountStorage();
    const loaded = storage.loadFromPath('/nonexistent/qtaccount.ini');
    assert.equal(loaded, false);
  });

  it('clear() wipes credentials', () => {
    const storage = new QtAccountStorage();
    storage.setCredentials('a@b.c', 'tok', 'u1');
    assert.equal(storage.hasCredentials(), true);
    storage.clear();
    assert.equal(storage.hasCredentials(), false);
    assert.equal(storage.email, '');
  });

  it('hasCredentials() requires both email and jwt', () => {
    const storage = new QtAccountStorage();
    storage.setCredentials('a@b.c', '', '');
    assert.equal(storage.hasCredentials(), false);
    storage.setCredentials('', 'tok', '');
    assert.equal(storage.hasCredentials(), false);
    storage.setCredentials('a@b.c', 'tok', '');
    assert.equal(storage.hasCredentials(), true);
  });

  it('toCredentials() returns frozen snapshot', () => {
    const storage = new QtAccountStorage();
    storage.setCredentials('e@m.c', 'jwt1', 'uid1');
    const creds = storage.toCredentials();
    assert.deepStrictEqual(creds, {
      email: 'e@m.c',
      jwt: 'jwt1',
      userId: 'uid1'
    });
  });
});

// ── QtAccount ────────────────────────────────────────────────────────────────

describe('QtAccount', () => {
  it('rejects empty credentials', async () => {
    const account = new QtAccount({ storagePath: '/dev/null' });
    await assert.rejects(
      () => account.login('', ''),
      (err: Error) => {
        assert.ok(err.message.includes('empty'));
        return true;
      }
    );
    assert.equal(account.state, AuthState.Error);
    assert.equal(account.lastError, LoginError.EmptyCredentials);
  });

  it('rejects renew without stored credentials', async () => {
    dir = tmpDir();
    const filePath = path.join(dir, 'empty.ini');
    fs.writeFileSync(filePath, '');

    const account = new QtAccount({ storagePath: filePath });
    await assert.rejects(
      () => account.renewLogin(),
      (err: Error) => {
        assert.ok(err.message.includes('stored credentials'));
        return true;
      }
    );
    assert.equal(account.lastError, LoginError.EmptyCredentials);
    cleanup(dir);
  });

  it('fires stateChanged events', async () => {
    const states: AuthState[] = [];
    const account = new QtAccount({ storagePath: '/dev/null' });
    account.on('stateChanged', (s) => states.push(s));

    try {
      await account.login('', '');
    } catch {
      // expected
    }

    assert.ok(states.includes(AuthState.Error));
  });

  it('loginUsingEnvVariables returns undefined when env not set', async () => {
    // Save and clear env vars
    const savedEmail = process.env['QT_ACCOUNT_LOGIN_EMAIL'];
    const savedPassword = process.env['QT_ACCOUNT_LOGIN_PASSWORD'];
    delete process.env['QT_ACCOUNT_LOGIN_EMAIL'];
    delete process.env['QT_ACCOUNT_LOGIN_PASSWORD'];

    try {
      const account = new QtAccount({ storagePath: '/dev/null' });
      const result = await account.loginUsingEnvVariables();
      assert.equal(result, undefined);
    } finally {
      // Restore env vars
      if (savedEmail !== undefined) {
        process.env['QT_ACCOUNT_LOGIN_EMAIL'] = savedEmail;
      }
      if (savedPassword !== undefined) {
        process.env['QT_ACCOUNT_LOGIN_PASSWORD'] = savedPassword;
      }
    }
  });

  let dir: string;

  it('logout clears stored credentials', () => {
    dir = tmpDir();
    const filePath = path.join(dir, 'qtaccount.ini');

    // Set up credentials
    const storage = new QtAccountStorage();
    storage.setCredentials('a@b.c', 'tok', 'u1');
    storage.saveToPath(filePath);

    const account = new QtAccount({ storagePath: filePath });
    assert.equal(account.hasStoredCredentials(), true);

    account.logout();
    assert.equal(account.state, AuthState.LoggedOut);
    assert.equal(account.hasStoredCredentials(), false);
    cleanup(dir);
  });
});

// ── Static path helpers ──────────────────────────────────────────────────────

describe('QtAccountStorage paths', () => {
  it('defaultPath returns a path ending with qtaccount.ini', () => {
    const p = QtAccountStorage.defaultPath();
    assert.ok(p.endsWith('qtaccount.ini'), `Expected qtaccount.ini, got: ${p}`);
    assert.ok(p.includes('Qt'), `Expected Qt in path, got: ${p}`);
  });

  it('defaultQtCompanyPath returns a path ending with QtCompany.ini', () => {
    const p = QtAccountStorage.defaultQtCompanyPath();
    assert.ok(p.endsWith('QtCompany.ini'), `Expected QtCompany.ini, got: ${p}`);
    assert.ok(p.includes('QtCompany'), `Expected QtCompany in path, got: ${p}`);
  });
});
