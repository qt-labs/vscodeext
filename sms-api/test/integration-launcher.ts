/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Integration tests for ServiceLauncher against a real
 * QtSoftwareManagementService binary.
 *
 * Usage:
 *   npm run test:integration -- --service-bin /path/to/QtSoftwareManagementService
 *
 * The --service-bin flag is required. The tests will:
 *   1. Verify startService() can launch and connect to the service
 *   2. Verify isServiceRunning() returns true after launch
 *   3. Verify stopService() terminates the process
 *   4. Verify startService() with an invalid binary returns false
 *   5. Verify startService() detects an already-running service
 *   6. Verify errorOccurred events fire on failures
 *   7. Verify a Session can connect through a launcher-started service
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import {
  ServiceLauncher,
  Session,
  Packages,
  SessionState,
  ErrorCode,
  type SmsError
} from '../src';

// ── CLI argument parsing ─────────────────────────────────────────────────────

interface TestConfig {
  serviceBin: string;
  socketPath: string;
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  let serviceBin: string | undefined;
  let socketPath = path.join(os.tmpdir(), 'qtclient_socket');

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--service-bin' && next) {
      serviceBin = path.resolve(next);
      i++;
    } else if (arg === '--socket' && next) {
      socketPath = next;
      i++;
    }
  }

  if (!serviceBin) {
    console.error(
      'Error: --service-bin <path> is required.\n' +
        'Usage:\n' +
        '  npm run test:integration:launcher -- --service-bin /path/to/QtSoftwareManagementService'
    );
    process.exit(1);
  }

  return { serviceBin, socketPath };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
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

/** Wait until the socket file disappears or connections are refused. */
async function waitForServiceStop(
  socketPath: string,
  timeoutMs: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const running = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ path: socketPath });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (!running) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/** Kill any lingering service on the socket path. */
async function ensureServiceStopped(socketPath: string): Promise<void> {
  // Try connecting to see if something is alive
  const running = await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ path: socketPath });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });

  if (running) {
    log(`  Service is running on ${socketPath}`);
  }

  // Also check for a leftover lock file — the service may have crashed
  // but still hold /tmp/QtSoftwareManagementService.lock
  const lockPath = '/tmp/QtSoftwareManagementService.lock';
  if (fs.existsSync(lockPath)) {
    log(`  Lock file found: ${lockPath}`);
  }

  // Kill any QtSoftwareManagementService processes (exclude our own PID)
  try {
    const ourPid = String(process.pid);
    const allPids = execSync('pgrep -x QtSoftwareManagementService', {
      encoding: 'utf-8'
    }).trim();
    if (allPids.length > 0) {
      const pidsToKill = allPids.split('\n').filter((pid) => pid !== ourPid);
      if (pidsToKill.length > 0) {
        log(`  Killing leftover service PIDs: ${pidsToKill.join(', ')}`);
        execSync(`kill ${pidsToKill.join(' ')}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } catch {
    // pgrep returns exit code 1 if no processes found — that's fine
  }

  // Clean up the socket and lock files
  for (const filePath of [socketPath, lockPath]) {
    try {
      fs.unlinkSync(filePath);
      log(`  Removed: ${filePath}`);
    } catch {
      // Ignore — file may not exist
    }
  }

  await new Promise((r) => setTimeout(r, 500));
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

// ── Tests ────────────────────────────────────────────────────────────────────

async function testStartService(config: TestConfig): Promise<ServiceLauncher> {
  const launcher = new ServiceLauncher({
    serviceBin: config.serviceBin,
    socketPath: config.socketPath,
    startupTimeoutMs: 30_000,
    pollIntervalMs: 200,
    onStderr: (line) => log(`  [service stderr] ${line}`)
  });

  const errors: SmsError[] = [];
  launcher.on('errorOccurred', (err: SmsError) => {
    errors.push(err);
    log(`  [errorOccurred] ${err.message}`);
  });

  log(`  -> Starting service from: ${config.serviceBin}`);
  log(`  -> Socket path: ${config.socketPath}`);
  const started = await launcher.startService();

  if (!started) {
    const lastErr = launcher.lastError;
    throw new Error(
      `startService() returned false: ${lastErr?.message ?? 'unknown error'}`
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Unexpected errors during startService(): ${errors.map((e) => e.message).join(', ')}`
    );
  }

  log(`  -> Service started successfully`);
  return launcher;
}

async function testIsServiceRunning(config: TestConfig): Promise<void> {
  const launcher = new ServiceLauncher({
    socketPath: config.socketPath
  });

  const running = await launcher.isServiceRunning();
  if (!running) {
    throw new Error('isServiceRunning() returned false for a running service');
  }
  log(`  -> isServiceRunning() correctly returned true`);
}

async function testStopService(launcher: ServiceLauncher): Promise<void> {
  const stopped = launcher.stopService();
  if (!stopped) {
    throw new Error('stopService() returned false');
  }
  log(`  -> stopService() returned true`);
}

async function testIsServiceStoppedAfterStop(
  config: TestConfig
): Promise<void> {
  // Wait for the socket to become unavailable
  const stopped = await waitForServiceStop(config.socketPath, 10_000);
  if (!stopped) {
    throw new Error('Service still responding on socket after stopService()');
  }
  log(`  -> Service is no longer running on socket`);
}

async function testStartWithInvalidBinary(config: TestConfig): Promise<void> {
  const launcher = new ServiceLauncher({
    serviceBin: '/nonexistent/path/to/QtSoftwareManagementService',
    socketPath: config.socketPath,
    startupTimeoutMs: 5_000
  });

  const errors: SmsError[] = [];
  launcher.on('errorOccurred', (err: SmsError) => errors.push(err));

  const started = await launcher.startService();
  if (started) {
    launcher.stopService();
    throw new Error(
      'startService() should return false for a non-existent binary'
    );
  }

  const lastErr = launcher.lastError;
  if (!lastErr) {
    throw new Error('Expected lastError to be set after failure');
  }

  log(`  -> startService() correctly returned false`);
  log(`  -> lastError: [${String(lastErr.code)}] ${lastErr.message}`);

  if (
    lastErr.code !== ErrorCode.ServiceNotFound &&
    lastErr.code !== ErrorCode.ServiceStartFailed
  ) {
    throw new Error(
      `Expected ServiceNotFound or ServiceStartFailed, got ${String(lastErr.code)}`
    );
  }

  if (errors.length === 0) {
    throw new Error('Expected errorOccurred event to fire');
  }
  log(`  -> errorOccurred event fired ${String(errors.length)} time(s)`);
}

async function testStartDetectsAlreadyRunning(
  config: TestConfig
): Promise<ServiceLauncher> {
  // Start the service first
  const launcher1 = new ServiceLauncher({
    serviceBin: config.serviceBin,
    socketPath: config.socketPath,
    startupTimeoutMs: 30_000,
    pollIntervalMs: 200,
    onStderr: (line) => log(`  [service1 stderr] ${line}`)
  });

  const started1 = await launcher1.startService();
  if (!started1) {
    throw new Error('First startService() failed');
  }

  // Now create a second launcher and call startService()
  // It should detect the existing service and return true without launching
  const launcher2 = new ServiceLauncher({
    serviceBin: config.serviceBin,
    socketPath: config.socketPath
  });

  const started2 = await launcher2.startService();
  if (!started2) {
    launcher1.stopService();
    throw new Error(
      'Second startService() should return true (service already running)'
    );
  }

  log(`  -> Second startService() correctly detected running service`);
  return launcher1; // Return so caller can stop it
}

async function testSessionThroughLauncher(config: TestConfig): Promise<void> {
  const launcher = new ServiceLauncher({
    serviceBin: config.serviceBin,
    socketPath: config.socketPath,
    startupTimeoutMs: 30_000,
    pollIntervalMs: 200,
    onStderr: (line) => log(`  [service stderr] ${line}`)
  });

  const started = await launcher.startService();
  if (!started) {
    throw new Error(
      `startService() failed: ${launcher.lastError?.message ?? 'unknown'}`
    );
  }

  const session = new Session('integration-test', config.socketPath, 10_000);
  try {
    await session.connectToService();
    if (session.state !== SessionState.Connected) {
      throw new Error(`Expected Connected, got ${session.state}`);
    }
    log(`  -> Session connected through launcher-started service`);

    // Quick smoke test: try a search
    const packages = new Packages(session);
    const result = await withTimeout(
      packages.searchAvailablePackages({}),
      10_000,
      'search packages'
    );
    log(`  -> Search returned ${String(result.length)} package(s)`);
  } finally {
    session.disconnectFromService();
    launcher.stopService();
    await waitForServiceStop(config.socketPath, 5_000);
  }
}

async function testStopWhenNotRunning(): Promise<void> {
  const launcher = new ServiceLauncher({
    socketPath: '/tmp/sms-test-nonexistent-socket'
  });

  const stopped = launcher.stopService();
  if (stopped) {
    throw new Error(
      'stopService() should return false when no process was launched'
    );
  }
  log(`  -> stopService() correctly returned false (no process)`);
}

async function testStartStopStart(config: TestConfig): Promise<void> {
  // Start -> stop -> start cycle
  const launcher = new ServiceLauncher({
    serviceBin: config.serviceBin,
    socketPath: config.socketPath,
    startupTimeoutMs: 30_000,
    pollIntervalMs: 200
  });

  log(`  -> First start...`);
  const started1 = await launcher.startService();
  if (!started1) {
    throw new Error(
      `First start failed: ${launcher.lastError?.message ?? 'unknown'}`
    );
  }

  log(`  -> Stopping...`);
  launcher.stopService();
  await waitForServiceStop(config.socketPath, 10_000);

  log(`  -> Second start...`);
  const launcher2 = new ServiceLauncher({
    serviceBin: config.serviceBin,
    socketPath: config.socketPath,
    startupTimeoutMs: 30_000,
    pollIntervalMs: 200,
    onStderr: (line) => log(`  [service stderr] ${line}`)
  });

  const started2 = await launcher2.startService();
  if (!started2) {
    throw new Error(
      `Second start failed: ${launcher2.lastError?.message ?? 'unknown'}`
    );
  }
  log(`  -> Start-stop-start cycle completed`);

  launcher2.stopService();
  await waitForServiceStop(config.socketPath, 10_000);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseArgs();

  if (!fs.existsSync(config.serviceBin)) {
    console.error(`Service binary not found: ${config.serviceBin}`);
    process.exit(1);
  }

  log(`Service binary: ${config.serviceBin}`);
  log(`Socket path: ${config.socketPath}`);

  // Ensure no leftover service is running
  await ensureServiceStopped(config.socketPath);

  let activeLauncher: ServiceLauncher | undefined;

  try {
    // ── Basic lifecycle ──
    await runTest('ServiceLauncher: startService()', async () => {
      activeLauncher = await testStartService(config);
    });

    await runTest('ServiceLauncher: isServiceRunning() after start', () =>
      testIsServiceRunning(config)
    );

    await runTest('ServiceLauncher: stopService()', async () => {
      if (activeLauncher) {
        await testStopService(activeLauncher);
        activeLauncher = undefined;
      } else {
        throw new Error('No active launcher from previous test');
      }
    });

    await runTest('ServiceLauncher: service stopped after stopService()', () =>
      testIsServiceStoppedAfterStop(config)
    );

    // Clean up lock and socket before next group
    await ensureServiceStopped(config.socketPath);

    // ── Error cases ──
    await runTest('ServiceLauncher: startService() with invalid binary', () =>
      testStartWithInvalidBinary(config)
    );

    await runTest('ServiceLauncher: stopService() when not running', () =>
      testStopWhenNotRunning()
    );

    // ── Already-running detection ──
    await runTest(
      'ServiceLauncher: startService() detects already running',
      async () => {
        activeLauncher = await testStartDetectsAlreadyRunning(config);
      }
    );

    // Clean up for next test
    if (activeLauncher) {
      activeLauncher.stopService();
      await waitForServiceStop(config.socketPath, 10_000);
      activeLauncher = undefined;
    }
    await ensureServiceStopped(config.socketPath);

    // ── Session integration ──
    await runTest(
      'ServiceLauncher: Session connects through launched service',
      () => testSessionThroughLauncher(config)
    );

    // Clean up for next test
    await ensureServiceStopped(config.socketPath);

    // ── Start-stop-start cycle ──
    await runTest('ServiceLauncher: start-stop-start cycle', () =>
      testStartStopStart(config)
    );
  } finally {
    // Ensure cleanup
    if (activeLauncher) {
      activeLauncher.stopService();
      await waitForServiceStop(config.socketPath, 5_000);
    }
    await ensureServiceStopped(config.socketPath);
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
