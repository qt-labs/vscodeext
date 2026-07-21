/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Integration tests for QtAccountStorage and QtAccount.
 *
 * Storage tests run without network access and exercise:
 *   - Read/write round-trips to real files (qtaccount.ini)
 *   - File permissions and directory creation
 *   - Concurrent save/load safety
 *
 * Login tests exercise the full HTTPS flow against qls.qt.io.
 * They require credentials supplied via CLI flags or environment variables:
 *
 * Usage:
 *   npm run test:integration:auth
 *   npm run test:integration:auth -- --email user@qt.io --password secret
 *
 * Environment variables (alternative):
 *   QT_ACCOUNT_LOGIN_EMAIL=user@qt.io
 *   QT_ACCOUNT_LOGIN_PASSWORD=secret
 *
 * Login tests are skipped when no credentials are available.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  QtAccountStorage,
  QtAccount,
  AuthState,
  LoginError
} from '../src';

// ── CLI argument parsing ─────────────────────────────────────────────────────

interface TestConfig {
  email: string | undefined;
  password: string | undefined;
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    email: process.env['QT_ACCOUNT_LOGIN_EMAIL'],
    password: process.env['QT_ACCOUNT_LOGIN_PASSWORD']
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--email' && next) {
      config.email = next;
      i++;
    } else if (arg === '--password' && next) {
      config.password = next;
      i++;
    }
  }

  return config;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

function tmpDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `sms-auth-integ-${label}-`));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: timed out after ${String(ms)}ms`));
    }, ms);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err as Error);
      }
    );
  });
}

// ── Test runner ──────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  skipped?: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  log(`TEST: ${name}`);
  try {
    await fn();
    results.push({ name, passed: true });
    log(`  PASS`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: msg });
    log(`  FAIL — ${msg}`);
  }
}

function skipTest(name: string, reason: string): void {
  log(`SKIP: ${name} — ${reason}`);
  results.push({ name, passed: true, skipped: true, error: reason });
}

// ── Storage integration tests ────────────────────────────────────────────────

async function testLegacyRoundTrip(): Promise<void> {
  const dir = tmpDir('legacy');
  try {
    const filePath = path.join(dir, 'Qt', 'qtaccount.ini');

    // Write
    const writer = new QtAccountStorage();
    writer.setCredentials('alice@qt.io', 'jwt-token-abc', 'uid-alice');
    const saved = writer.saveToPath(filePath);
    if (!saved) {
      throw new Error('saveToPath() returned false');
    }

    // Verify directory was created
    if (!fs.existsSync(path.dirname(filePath))) {
      throw new Error('saveToPath() did not create parent directory');
    }

    // Read back
    const reader = new QtAccountStorage();
    const loaded = reader.loadFromPath(filePath);
    if (!loaded) {
      throw new Error('loadFromPath() returned false');
    }
    if (reader.email !== 'alice@qt.io') {
      throw new Error(`email: expected 'alice@qt.io', got '${reader.email}'`);
    }
    if (reader.jwt !== 'jwt-token-abc') {
      throw new Error(`jwt mismatch: got '${reader.jwt}'`);
    }
    if (reader.userId !== 'uid-alice') {
      throw new Error(`userId mismatch: got '${reader.userId}'`);
    }
    log(`  -> Legacy round-trip OK`);
  } finally {
    cleanup(dir);
  }
}

async function testIniPreservesOtherSections(): Promise<void> {
  const dir = tmpDir('preserve');
  try {
    const filePath = path.join(dir, 'qtaccount.ini');

    // Pre-populate with other sections
    fs.writeFileSync(
      filePath,
      [
        '[OtherSection]',
        'some_key=some_value',
        '',
      ].join('\n')
    );

    // Save credentials into the same file
    const storage = new QtAccountStorage();
    storage.setCredentials('carol@qt.io', 'jwt-carol', 'uid-carol');
    storage.saveToPath(filePath);

    // Verify other sections are preserved
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('some_key=some_value')) {
      throw new Error('Lost [OtherSection] entry');
    }
    if (!content.includes('[QtAccount]')) {
      throw new Error('Missing [QtAccount] section');
    }
    if (!content.includes('email=carol@qt.io')) {
      throw new Error('Missing email in [QtAccount]');
    }

    log(`  -> Other INI sections preserved OK`);
  } finally {
    cleanup(dir);
  }
}

async function testFilePermissions(): Promise<void> {
  if (process.platform === 'win32') {
    log(`  -> Skipping on Windows (no POSIX permissions)`);
    return;
  }

  const dir = tmpDir('perms');
  try {
    const filePath = path.join(dir, 'qtaccount.ini');
    const storage = new QtAccountStorage();
    storage.setCredentials('x@y.z', 'tok', 'uid');
    storage.saveToPath(filePath);

    const stat = fs.statSync(filePath);
    const mode = stat.mode & 0o777;
    if (mode !== 0o600) {
      throw new Error(
        `Expected file mode 0o600, got 0o${mode.toString(8)}`
      );
    }
    log(`  -> File permissions 0o600 OK`);
  } finally {
    cleanup(dir);
  }
}

async function testOverwriteExistingCredentials(): Promise<void> {
  const dir = tmpDir('overwrite');
  try {
    const filePath = path.join(dir, 'qtaccount.ini');

    // Save first set
    const s1 = new QtAccountStorage();
    s1.setCredentials('first@qt.io', 'jwt-1', 'uid-1');
    s1.saveToPath(filePath);

    // Overwrite with second set
    const s2 = new QtAccountStorage();
    s2.setCredentials('second@qt.io', 'jwt-2', 'uid-2');
    s2.saveToPath(filePath);

    // Read back — should see second set
    const reader = new QtAccountStorage();
    reader.loadFromPath(filePath);
    if (reader.email !== 'second@qt.io') {
      throw new Error(`Expected 'second@qt.io', got '${reader.email}'`);
    }
    if (reader.jwt !== 'jwt-2') {
      throw new Error(`Expected 'jwt-2', got '${reader.jwt}'`);
    }

    log(`  -> Overwrite existing credentials OK`);
  } finally {
    cleanup(dir);
  }
}

async function testClearAndSave(): Promise<void> {
  const dir = tmpDir('clear');
  try {
    const filePath = path.join(dir, 'qtaccount.ini');

    // Save credentials, then clear and save again
    const storage = new QtAccountStorage();
    storage.setCredentials('user@qt.io', 'jwt-tok', 'uid-1');
    storage.saveToPath(filePath);

    storage.clear();
    storage.saveToPath(filePath);

    // Reload — should have empty values
    const reader = new QtAccountStorage();
    reader.loadFromPath(filePath);
    if (reader.email !== '') {
      throw new Error(`Expected empty email after clear, got '${reader.email}'`);
    }
    if (reader.jwt !== '') {
      throw new Error(`Expected empty jwt after clear, got '${reader.jwt}'`);
    }
    if (reader.hasCredentials()) {
      throw new Error('hasCredentials() should return false after clear');
    }

    log(`  -> Clear and save OK`);
  } finally {
    cleanup(dir);
  }
}

async function testSpecialCharactersInCredentials(): Promise<void> {
  const dir = tmpDir('special');
  try {
    const filePath = path.join(dir, 'qtaccount.ini');

    // Email/JWT with special characters
    const email = 'user+test@qt.io';
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1aWQtMTIzIiwiZW1haWwiOiJ0ZXN0QHF0LmlvIn0.sig';
    const userId = 'uid-123/special=chars';

    const storage = new QtAccountStorage();
    storage.setCredentials(email, jwt, userId);
    storage.saveToPath(filePath);

    const reader = new QtAccountStorage();
    reader.loadFromPath(filePath);

    if (reader.email !== email) {
      throw new Error(`Email mismatch: '${reader.email}' !== '${email}'`);
    }
    if (reader.jwt !== jwt) {
      throw new Error('JWT with dots not preserved');
    }
    if (reader.userId !== userId) {
      throw new Error(`UserId mismatch: '${reader.userId}' !== '${userId}'`);
    }

    log(`  -> Special characters in credentials OK`);
  } finally {
    cleanup(dir);
  }
}

async function testDefaultPathsExist(): Promise<void> {
  const defaultPath = QtAccountStorage.defaultPath();
  const qtCompanyPath = QtAccountStorage.defaultQtCompanyPath();

  if (!defaultPath.endsWith('qtaccount.ini')) {
    throw new Error(`Default path should end with qtaccount.ini: ${defaultPath}`);
  }
  if (!defaultPath.includes('Qt')) {
    throw new Error(`Default path should contain 'Qt': ${defaultPath}`);
  }
  if (!qtCompanyPath.endsWith('QtCompany.ini')) {
    throw new Error(
      `QtCompany path should end with QtCompany.ini: ${qtCompanyPath}`
    );
  }
  if (!qtCompanyPath.includes('QtCompany')) {
    throw new Error(
      `QtCompany path should contain 'QtCompany': ${qtCompanyPath}`
    );
  }

  log(`  -> Default path:    ${defaultPath}`);
  log(`  -> QtCompany path:  ${qtCompanyPath}`);
  log(`  -> Default paths OK`);
}

// ── Login integration tests (require network + credentials) ──────────────────

const LOGIN_TIMEOUT_MS = 15_000;

async function testLoginWithValidCredentials(
  email: string,
  password: string
): Promise<void> {
  const dir = tmpDir('login');
  try {
    const storagePath = path.join(dir, 'qtaccount.ini');

    const account = new QtAccount({ storagePath });
    const stateChanges: AuthState[] = [];
    account.on('stateChanged', (s) => stateChanges.push(s));

    const credentials = await withTimeout(
      account.login(email, password),
      LOGIN_TIMEOUT_MS,
      'login'
    );

    if (account.state !== AuthState.LoggedIn) {
      throw new Error(`Expected LoggedIn, got ${account.state}`);
    }
    if (!credentials.jwt) {
      throw new Error('No JWT in response');
    }
    if (!credentials.email) {
      throw new Error('No email in response');
    }
    if (credentials.email !== email) {
      throw new Error(
        `Email mismatch: '${credentials.email}' !== '${email}'`
      );
    }

    // State should have transitioned: LoggingIn -> LoggedIn
    if (!stateChanges.includes(AuthState.LoggingIn)) {
      throw new Error('Missing LoggingIn state transition');
    }
    if (!stateChanges.includes(AuthState.LoggedIn)) {
      throw new Error('Missing LoggedIn state transition');
    }

    log(`  -> Login succeeded, JWT length: ${String(credentials.jwt.length)}`);
    log(`  -> userId: ${credentials.userId || '(empty)'}`);

    // Verify credentials were saved to disk
    const reader = new QtAccountStorage();
    const loaded = reader.loadFromPath(storagePath);
    if (!loaded) {
      throw new Error('Credentials not saved to disk');
    }
    if (reader.email !== email) {
      throw new Error('Saved email does not match');
    }
    if (reader.jwt !== credentials.jwt) {
      throw new Error('Saved JWT does not match');
    }

    log(`  -> Credentials persisted to disk OK`);
  } finally {
    cleanup(dir);
  }
}

async function testLoginWithInvalidCredentials(): Promise<void> {
  const dir = tmpDir('login-bad');
  try {
    const storagePath = path.join(dir, 'qtaccount.ini');
    const account = new QtAccount({ storagePath });

    try {
      await withTimeout(
        account.login('invalid-user@nonexistent.invalid', 'wrong-password'),
        LOGIN_TIMEOUT_MS,
        'login with bad creds'
      );
      throw new Error('Expected login to fail, but it succeeded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Expected login to fail')) {
        throw err;
      }
      if (account.state !== AuthState.Error) {
        throw new Error(`Expected Error state, got ${account.state}`);
      }
      log(`  -> Login correctly rejected: ${msg}`);
    }
  } finally {
    cleanup(dir);
  }
}

async function testLoginEmptyCredentials(): Promise<void> {
  const account = new QtAccount({ storagePath: '/dev/null' });

  try {
    await account.login('', '');
    throw new Error('Expected login to fail with empty credentials');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Expected login to fail')) {
      throw err;
    }
    if (account.lastError !== LoginError.EmptyCredentials) {
      throw new Error(
        `Expected EmptyCredentials error, got ${String(account.lastError)}`
      );
    }
    log(`  -> Empty credentials correctly rejected`);
  }
}

async function testRenewLogin(
  email: string,
  password: string
): Promise<void> {
  const dir = tmpDir('renew');
  try {
    const storagePath = path.join(dir, 'qtaccount.ini');

    // First login to get a valid JWT
    const account1 = new QtAccount({ storagePath });
    const creds1 = await withTimeout(
      account1.login(email, password),
      LOGIN_TIMEOUT_MS,
      'initial login for renew'
    );
    log(`  -> Initial login OK, JWT length: ${String(creds1.jwt.length)}`);

    // Now renew with a fresh instance that loads from the same file
    const account2 = new QtAccount({ storagePath });
    if (!account2.hasStoredCredentials()) {
      throw new Error('Stored credentials not found for renew');
    }

    const creds2 = await withTimeout(
      account2.renewLogin(),
      LOGIN_TIMEOUT_MS,
      'renewLogin'
    );

    if (account2.state !== AuthState.LoggedIn) {
      throw new Error(`Expected LoggedIn after renew, got ${account2.state}`);
    }
    if (!creds2.jwt) {
      throw new Error('No JWT from renew');
    }
    if (creds2.email !== email) {
      throw new Error('Email mismatch after renew');
    }

    log(`  -> Renew OK, new JWT length: ${String(creds2.jwt.length)}`);
  } finally {
    cleanup(dir);
  }
}

async function testLogoutClearsCredentials(
  email: string,
  password: string
): Promise<void> {
  const dir = tmpDir('logout');
  try {
    const storagePath = path.join(dir, 'qtaccount.ini');

    // Login first
    const account = new QtAccount({ storagePath });
    await withTimeout(
      account.login(email, password),
      LOGIN_TIMEOUT_MS,
      'login for logout test'
    );
    if (!account.hasStoredCredentials()) {
      throw new Error('Expected credentials after login');
    }

    // Logout
    account.logout();
    if (account.state !== AuthState.LoggedOut) {
      throw new Error(`Expected LoggedOut, got ${account.state}`);
    }
    if (account.hasStoredCredentials()) {
      throw new Error('Credentials should be cleared after logout');
    }

    // Verify cleared on disk
    const reader = new QtAccountStorage();
    reader.loadFromPath(storagePath);
    if (reader.hasCredentials()) {
      throw new Error('Credentials not cleared from disk');
    }

    log(`  -> Logout clears credentials OK`);
  } finally {
    cleanup(dir);
  }
}

async function testLoginViaEnvVariables(
  email: string,
  password: string
): Promise<void> {
  const dir = tmpDir('env-login');
  try {
    // Temporarily set env vars
    const savedEmail = process.env['QT_ACCOUNT_LOGIN_EMAIL'];
    const savedPassword = process.env['QT_ACCOUNT_LOGIN_PASSWORD'];
    process.env['QT_ACCOUNT_LOGIN_EMAIL'] = email;
    process.env['QT_ACCOUNT_LOGIN_PASSWORD'] = password;

    try {
      const storagePath = path.join(dir, 'qtaccount.ini');
      const account = new QtAccount({ storagePath });
      const result = await withTimeout(
        account.loginUsingEnvVariables() as Promise<{
          email: string;
          jwt: string;
          userId: string;
        }>,
        LOGIN_TIMEOUT_MS,
        'loginUsingEnvVariables'
      );

      if (!result) {
        throw new Error('loginUsingEnvVariables returned undefined');
      }
      if (account.state !== AuthState.LoggedIn) {
        throw new Error(`Expected LoggedIn, got ${account.state}`);
      }
      log(`  -> Env variable login OK`);
    } finally {
      // Restore env vars
      if (savedEmail !== undefined) {
        process.env['QT_ACCOUNT_LOGIN_EMAIL'] = savedEmail;
      } else {
        delete process.env['QT_ACCOUNT_LOGIN_EMAIL'];
      }
      if (savedPassword !== undefined) {
        process.env['QT_ACCOUNT_LOGIN_PASSWORD'] = savedPassword;
      } else {
        delete process.env['QT_ACCOUNT_LOGIN_PASSWORD'];
      }
    }
  } finally {
    cleanup(dir);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseArgs();

  const hasCredentials = !!(config.email && config.password);
  if (hasCredentials) {
    log(`Credentials provided for ${config.email}`);
  } else {
    log(
      'No credentials provided — login tests will be skipped.\n' +
        'Set QT_ACCOUNT_LOGIN_EMAIL and QT_ACCOUNT_LOGIN_PASSWORD ' +
        'or use --email/--password flags.'
    );
  }

  // ── Storage tests (no network needed) ──
  await runTest('Storage: INI round-trip', testLegacyRoundTrip);
  await runTest(
    'Storage: preserve other INI sections',
    testIniPreservesOtherSections
  );
  await runTest('Storage: file permissions (0o600)', testFilePermissions);
  await runTest(
    'Storage: overwrite existing credentials',
    testOverwriteExistingCredentials
  );
  await runTest('Storage: clear and save', testClearAndSave);
  await runTest(
    'Storage: special characters in credentials',
    testSpecialCharactersInCredentials
  );
  await runTest('Storage: default paths', testDefaultPathsExist);

  // ── Login tests (require credentials + network) ──
  await runTest('Login: empty credentials rejected', testLoginEmptyCredentials);

  if (hasCredentials) {
    await runTest('Login: valid credentials', () =>
      testLoginWithValidCredentials(config.email!, config.password!)
    );
    await runTest(
      'Login: invalid credentials rejected',
      testLoginWithInvalidCredentials
    );
    await runTest('Login: renew with stored JWT', () =>
      testRenewLogin(config.email!, config.password!)
    );
    await runTest('Login: logout clears credentials', () =>
      testLogoutClearsCredentials(config.email!, config.password!)
    );
    await runTest('Login: via environment variables', () =>
      testLoginViaEnvVariables(config.email!, config.password!)
    );
  } else {
    skipTest('Login: valid credentials', 'No credentials provided');
    skipTest('Login: invalid credentials rejected', 'No credentials provided');
    skipTest('Login: renew with stored JWT', 'No credentials provided');
    skipTest('Login: logout clears credentials', 'No credentials provided');
    skipTest('Login: via environment variables', 'No credentials provided');
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(
    `Results: ${String(passed)} passed, ${String(skipped)} skipped, ${String(failed)} failed out of ${String(results.length)} tests`
  );

  for (const r of results) {
    const status = r.skipped ? '○' : r.passed ? '✓' : '✗';
    const detail = r.error ? ` (${r.error})` : '';
    console.log(`  ${status} ${r.name}${detail}`);
  }

  console.log('═'.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
