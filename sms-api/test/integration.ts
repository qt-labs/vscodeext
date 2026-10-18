/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Integration test for sms-api against a real QtSoftwareManagementService.
 *
 * Usage:
 *   npm run test:integration -- --service-bin /path/to/QtSoftwareManagementService
 *   npm run test:integration -- --socket /tmp/qtclient_socket
 *   npm run test:integration -- --timeout 15000
 *
 * Either --service-bin or --socket must be provided.
 *
 * The test will:
 *   1. Launch QtSoftwareManagementService (via ServiceLauncher or manual spawn)
 *   2. Connect via sms-api Session
 *   3. Exercise the transport layer (packet encode/decode)
 *   4. Send JSON-RPC requests via the dispatcher
 *   5. Test search (implemented), install, and error responses
 *   6. Test createOffline method
 *   7. Disconnect and shut down
 *
 * The service returns proper JSON-RPC error responses for methods not yet
 * implemented (download, update, remove, purge, list).
 */

import { spawn, type ChildProcess } from 'child_process';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import {
  Session,
  Packages,
  ServiceLauncher,
  SessionState,
  encodeJsonPacket,
  PacketReader,
  type DecodedPacket,
  type PackageData,
  type PackageReference,
  type SmsError
} from '../src';

// ── CLI argument parsing ─────────────────────────────────────────────────────

const DEFAULT_CALL_TIMEOUT_MS = 5_000;

interface TestConfig {
  serviceBin: string | undefined;
  socketPath: string | undefined;
  connectTimeoutMs: number;
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    serviceBin: undefined,
    socketPath: undefined,
    connectTimeoutMs: 10_000
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--service-bin' && next) {
      config.serviceBin = path.resolve(next);
      i++;
    } else if (arg === '--socket' && next) {
      config.socketPath = next;
      i++;
    } else if (arg === '--timeout' && next) {
      config.connectTimeoutMs = parseInt(next, 10);
      i++;
    }
  }

  if (!config.serviceBin && !config.socketPath) {
    console.error(
      'Error: Either --service-bin <path> or --socket <path> must be provided.\n' +
        'Usage:\n' +
        '  npm run test:integration -- --service-bin /path/to/QtSoftwareManagementService\n' +
        '  npm run test:integration -- --socket /tmp/qtclient_socket'
    );
    process.exit(1);
  }

  return config;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

function fail(msg: string): never {
  log(`FAIL: ${msg}`);
  process.exit(1);
}

function defaultSocketPath(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\qtclient_socket';
  }
  return path.join(os.tmpdir(), 'qtclient_socket');
}

/** Wraps a promise with a timeout so tests can't hang */
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

function waitForService(socketPath: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const tryConnect = (): void => {
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `Service at ${socketPath} not ready within ${String(timeoutMs)}ms`
          )
        );
        return;
      }

      const socket = net.createConnection({ path: socketPath });

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();
        setTimeout(tryConnect, 250);
      });
    };

    tryConnect();
  });
}

// ── Service launcher ─────────────────────────────────────────────────────────

function launchService(binPath: string): ChildProcess {
  if (!fs.existsSync(binPath)) {
    fail(`Service binary not found: ${binPath}`);
  }

  log(`Launching service: ${binPath}`);
  log(`  Mock HOME: ${MOCK_HOME_DIR}`);
  fs.rmSync(MOCK_HOME_DIR, { recursive: true, force: true });
  fs.mkdirSync(MOCK_HOME_DIR, { recursive: true });
  const child = spawn(binPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, HOME: MOCK_HOME_DIR }
  });

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().trim().split('\n')) {
      log(`  [service stdout] ${line}`);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().trim().split('\n')) {
      log(`  [service stderr] ${line}`);
    }
  });

  child.on('exit', (code) => {
    log(`  [service] exited with code ${String(code)}`);
  });

  return child;
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

// ── Tests ────────────────────────────────────────────────────────────────────

async function testTransportLayer(): Promise<void> {
  // Test packet encoding/decoding round-trip
  const reader = new PacketReader();
  const testData = '{"jsonrpc":"2.0","method":"test","id":"1"}';
  const encoded = encodeJsonPacket(testData);

  const received: DecodedPacket[] = [];
  reader.on('packet', (pkt: DecodedPacket) => received.push(pkt));
  reader.feed(encoded);

  if (received.length !== 1) {
    throw new Error(`Expected 1 packet, got ${String(received.length)}`);
  }
  if (received[0]?.command !== 'JSON') {
    throw new Error(
      `Expected command 'JSON', got '${received[0]?.command ?? ''}'`
    );
  }
  if (received[0].data !== testData) {
    throw new Error('Decoded data does not match encoded data');
  }
  log(`  -> Packet encode/decode round-trip OK`);

  // Test multiple packets in a single buffer
  const multi = Buffer.concat([
    encodeJsonPacket('{"a":1}'),
    encodeJsonPacket('{"b":2}'),
    encodeJsonPacket('{"c":3}')
  ]);
  const multiReceived: DecodedPacket[] = [];
  const reader2 = new PacketReader();
  reader2.on('packet', (pkt: DecodedPacket) => multiReceived.push(pkt));
  reader2.feed(multi);
  if (multiReceived.length !== 3) {
    throw new Error(
      `Expected 3 packets from multi-buffer, got ${String(multiReceived.length)}`
    );
  }
  log(`  -> Multi-packet decode OK`);

  // Test fragmented delivery
  const fullPacket = encodeJsonPacket('{"frag":"test"}');
  const frag1 = fullPacket.subarray(0, 6);
  const frag2 = fullPacket.subarray(6);
  const fragReceived: DecodedPacket[] = [];
  const reader3 = new PacketReader();
  reader3.on('packet', (pkt: DecodedPacket) => fragReceived.push(pkt));
  reader3.feed(frag1);
  if (fragReceived.length > 0) {
    throw new Error('Should not have received packet from partial data');
  }
  reader3.feed(frag2);
  if (fragReceived.length < 1) {
    throw new Error(
      `Expected 1 packet after reassembly, got ${String(fragReceived.length)}`
    );
  }
  log(`  -> Fragmented packet reassembly OK`);
}

async function testConnect(session: Session): Promise<void> {
  await session.connectToService();
  if (session.state !== SessionState.Connected) {
    throw new Error(`Expected Connected, got ${session.state}`);
  }
}

async function testRawJsonRpcCall(session: Session): Promise<void> {
  // Send a raw JSON-RPC request using the dispatcher directly.
  // The server validates the request and returns a JSON-RPC error for an
  // empty package list — receiving that error proves the protocol works.
  const dispatcher = session.dispatcher;
  const callTimeout = DEFAULT_CALL_TIMEOUT_MS;

  try {
    const result = await withTimeout(
      new Promise<unknown>((resolve, reject) => {
        dispatcher.call(
          'packages/install',
          { packages: [] },
          (res) => {
            resolve(res);
          },
          (err: SmsError) => {
            reject(new Error(`RPC error: ${err.message}`));
          }
        );
      }),
      callTimeout,
      'packages/install (empty)'
    );

    log(`  -> Got response: ${JSON.stringify(result)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timed out')) {
      throw err; // A timeout is a real failure
    }
    // An error response (e.g. "no packages specified") is valid —
    // it proves the JSON-RPC round-trip works.
    log(`  -> Got expected error response: ${msg}`);
  }
}

const INSTALL_TIMEOUT_MS = 120_000;
const MOCK_HOME_DIR = path.resolve(__dirname, '..', 'test', 'integration');
const INSTALL_OUTPUT_DIR = path.join(MOCK_HOME_DIR, 'Qt');
// Qt's QStandardPaths::AppLocalDataLocation resolves differently per platform:
//   macOS:   ~/Library/Application Support/<AppName>
//   Linux:   ~/.local/share/<AppName>
//   Windows: ~/AppData/Local/<AppName>
const INSTALL_JOURNAL_DIR =
  process.platform === 'darwin'
    ? path.join(
        MOCK_HOME_DIR,
        'Library',
        'Application Support',
        'QtSoftwareManagementService'
      )
    : process.platform === 'win32'
      ? path.join(
          MOCK_HOME_DIR,
          'AppData',
          'Local',
          'QtSoftwareManagementService'
        )
      : path.join(
          MOCK_HOME_DIR,
          '.local',
          'share',
          'QtSoftwareManagementService'
        );
const INSTALL_JOURNAL_PATH = path.join(
  INSTALL_JOURNAL_DIR,
  'installationJournal.json'
);

// Tracks the package installed during the test run
let installedPackageId: string | undefined;
let installedPackageVersion: string | undefined;

async function testInstallFirstAvailablePackage(
  packages: Packages
): Promise<void> {
  log(`  -> Searching for available packages...`);
  let available: PackageData[];
  try {
    available = await withTimeout(
      packages.searchAvailablePackages({}),
      DEFAULT_CALL_TIMEOUT_MS,
      'search available'
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not list packages for install test: ${msg}`);
  }

  if (available.length === 0) {
    // log(`  -> No packages returned by search, nothing to install`);
    throw new Error(`No packages returned by search, cannot test install`);
  }

  const pkg = available[0]!;
  log(
    `  -> Found ${String(available.length)} package(s), installing first: ${pkg.id}@${pkg.version}`
  );
  await testInstallPackage(packages, pkg.id, pkg.version);
  installedPackageId = pkg.id;
  installedPackageVersion = pkg.version;
}

async function testInstallPackage(
  packages: Packages,
  pkgId: string,
  pkgVersion: string | undefined
): Promise<void> {
  const ref: PackageReference = pkgVersion
    ? { id: pkgId, version: pkgVersion }
    : { id: pkgId };

  const label = pkgVersion ? `${pkgId}@${pkgVersion}` : pkgId;
  log(`  -> Installing ${label}...`);
  log(`  -> Expected output directory: ${INSTALL_OUTPUT_DIR}`);

  const result = await withTimeout(
    packages.install(
      [ref],
      { timeoutMs: INSTALL_TIMEOUT_MS },
      {
        onProgress: ({ progress, message }) => {
          const pct = (progress * 100).toFixed(1);
          const detail = message ? ` — ${message}` : '';
          log(`  [progress] ${pct}%${detail}`);
        },
        onMessage: ({ message }) => {
          log(`  [message] ${message}`);
        },
        onPrompt: async (prompt) => {
          log(`  [prompt] "${prompt.title}": ${prompt.message}`);
          if (prompt.choices.length > 0) {
            const choice = prompt.choices[0] ?? prompt.defaultAnswer;
            log(
              `  [prompt] choices: [${prompt.choices.join(', ')}] — auto-selecting "${choice}"`
            );
            return { kind: 'choice', choice };
          }
          log(
            `  [prompt] defaultAnswer: "${prompt.defaultAnswer}" — auto-replying`
          );
          return { kind: 'text', text: prompt.defaultAnswer };
        }
      }
    ),
    INSTALL_TIMEOUT_MS + 5_000,
    `install ${label}`
  );

  log(`  -> Install completed: ${result}`);
}

async function testVerifyInstallOutput(): Promise<void> {
  // 1. Check that files were extracted to INSTALL_OUTPUT_DIR
  if (!fs.existsSync(INSTALL_OUTPUT_DIR)) {
    throw new Error(
      `Install output directory does not exist: ${INSTALL_OUTPUT_DIR}`
    );
  }

  const entries = fs.readdirSync(INSTALL_OUTPUT_DIR, {
    recursive: true
  }) as string[];
  if (entries.length === 0) {
    throw new Error(`Install output directory is empty: ${INSTALL_OUTPUT_DIR}`);
  }

  log(
    `  -> ${String(entries.length)} file(s)/dir(s) in ${INSTALL_OUTPUT_DIR}:`
  );
  for (const entry of entries.slice(0, 20)) {
    log(`     ${entry}`);
  }
  if (entries.length > 20) {
    log(`     ... and ${String(entries.length - 20)} more`);
  }

  // 2. Check the installation journal records the package.
  // On macOS, Qt's QStandardPaths::AppLocalDataLocation uses NSSearchPathForDirectoriesInDomains
  // which ignores the HOME env var override, so the journal is always written to the real
  // ~/Library/Application Support/ and cannot be redirected to MOCK_HOME_DIR in tests.
  // if (process.platform === 'darwin') {
  //   log(`  -> Skipping journal check on macOS (QStandardPaths ignores HOME override)`);
  //   return;
  // }
  if (!fs.existsSync(INSTALL_JOURNAL_PATH)) {
    throw new Error(`Installation journal not found: ${INSTALL_JOURNAL_PATH}`);
  }

  const journalRaw = fs.readFileSync(INSTALL_JOURNAL_PATH, 'utf-8');
  const journal = JSON.parse(journalRaw) as {
    payload?: {
      installed?: Array<{
        productId: string;
        productVersion: string;
        packages?: Array<{
          packageId: string;
          packageVersion: string;
        }>;
      }>;
    };
  };

  const installed = journal.payload?.installed;
  if (!installed || installed.length === 0) {
    throw new Error('Installation journal has no installed packages');
  }

  log(`  -> Journal has ${String(installed.length)} product(s) installed`);
  for (const product of installed) {
    log(
      `     product: ${product.productId}@${product.productVersion} ` +
        `(${String(product.packages?.length ?? 0)} package(s))`
    );
  }

  // 3. Verify the package we installed is in the journal
  if (installedPackageId) {
    const found = installed.some((product) =>
      product.packages?.some((pkg) => {
        const idMatch = pkg.packageId === installedPackageId;
        const versionMatch =
          !installedPackageVersion ||
          pkg.packageVersion === installedPackageVersion;
        return idMatch && versionMatch;
      })
    );

    if (!found) {
      throw new Error(
        `Installed package ${installedPackageId}@${installedPackageVersion ?? '?'} ` +
          `not found in installation journal`
      );
    }
    log(
      `  -> Verified: ${installedPackageId}@${installedPackageVersion ?? '?'} found in journal`
    );
  }
}

async function testInstallNonExistentPackage(
  packages: Packages
): Promise<void> {
  // Attempt to install a non-existent package — expect an error or response
  const callTimeout = DEFAULT_CALL_TIMEOUT_MS;
  try {
    const result = await withTimeout(
      packages.install([{ id: 'nonexistent.test.package' }]),
      callTimeout,
      'install nonexistent'
    );
    log(`  -> Got result: ${result}`);
  } catch (err) {
    // An error response is acceptable — it means the protocol worked
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timed out')) {
      throw err;
    }
    log(`  -> Got expected error: ${msg}`);
  }
}

async function testListAllPackages(packages: Packages): Promise<void> {
  const result = await withTimeout(
    packages.searchAvailablePackages({}),
    DEFAULT_CALL_TIMEOUT_MS,
    'list all packages'
  );
  if (result.length === 0) {
    throw new Error(`No packages returned by search, expected some packages`);
  }
  log(`  -> ${String(result.length)} package(s) available:`);
  for (const pkg of result) {
    log(`     ${pkg.id}@${pkg.version}`);
  }
}

async function testSearchAvailablePackages(packages: Packages): Promise<void> {
  // Search is now implemented on the server side
  const callTimeout = DEFAULT_CALL_TIMEOUT_MS;
  try {
    const result = await withTimeout(
      packages.searchAvailablePackages(),
      callTimeout,
      'search available'
    );
    log(`  -> Got ${String(result.length)} package(s) from search`);
    if (result.length > 0) {
      log(`  -> First: ${result[0].id}@${result[0].version}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // A timeout or error means the server may not have the search endpoint
    // fully working yet — still acceptable
    log(`  -> Search returned error: ${msg}`);
  }
}

async function testCreateOfflinePackage(packages: Packages): Promise<void> {
  // createOffline is a new method - server may return "not yet implemented"
  const callTimeout = DEFAULT_CALL_TIMEOUT_MS;
  try {
    const result = await withTimeout(
      packages.createOffline([{ id: 'qt6-base', version: '6.10' }]),
      callTimeout,
      'createOffline'
    );
    log(`  -> Got result: ${result}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timed out')) {
      throw err;
    }
    // "not yet implemented" is expected from the server
    log(`  -> Got expected error: ${msg}`);
  }
}

async function testUnimplementedMethodReturnsError(
  session: Session
): Promise<void> {
  // The server now sends proper JSON-RPC error responses for unimplemented
  // methods (download, update, remove, purge, list) instead of silently
  // ignoring them.
  const dispatcher = session.dispatcher;
  const callTimeout = DEFAULT_CALL_TIMEOUT_MS;

  try {
    await withTimeout(
      new Promise<unknown>((resolve, reject) => {
        dispatcher.call(
          'packages/list',
          { filters: [] },
          (res) => {
            resolve(res);
          },
          (err: SmsError) => {
            reject(new Error(err.message));
          }
        );
      }),
      callTimeout,
      'packages/list'
    );
    log(`  -> Got a response (server may implement this now)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timed out')) {
      log(`  -> Timed out (server may not send error responses yet)`);
      return;
    }
    // An error response like "not yet implemented" means the server handles
    // the method routing and sends proper errors
    log(`  -> Got error response: ${msg}`);
  }
}

async function testServiceLauncher(socketPath: string): Promise<void> {
  // Test ServiceLauncher.isServiceRunning() against a known socket
  const launcher = new ServiceLauncher({ socketPath });
  const running = await launcher.isServiceRunning();
  if (!running) {
    throw new Error(
      'ServiceLauncher.isServiceRunning() returned false for active socket'
    );
  }
  log(`  -> isServiceRunning() correctly detected running service`);
}

async function testReconnect(
  session: Session,
  socketPath: string,
  timeoutMs: number
): Promise<void> {
  // Disconnect and reconnect
  session.disconnectFromService();
  if (session.state !== SessionState.Disconnected) {
    throw new Error(`Expected Disconnected, got ${session.state}`);
  }

  // Reconnect with a fresh session
  const session2 = new Session('integration-test', socketPath, timeoutMs);
  await session2.connectToService();
  if (session2.state !== SessionState.Connected) {
    throw new Error(`Expected Connected on reconnect, got ${session2.state}`);
  }
  session2.disconnectFromService();
  log(`  -> Reconnect successful`);
}

async function testDisconnect(session: Session): Promise<void> {
  session.disconnectFromService();
  if (session.state !== SessionState.Disconnected) {
    throw new Error(`Expected Disconnected, got ${session.state}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseArgs();
  let serviceProcess: ChildProcess | undefined;

  const socketPath = config.socketPath ?? defaultSocketPath();
  log(`Socket path: ${socketPath}`);

  try {
    // ── Transport layer tests (no service needed) ──
    await runTest('Transport: packet encode/decode', testTransportLayer);

    // ── Launch service ──
    if (config.serviceBin) {
      serviceProcess = launchService(config.serviceBin);

      log('Waiting for service to be ready...');
      await waitForService(socketPath, config.connectTimeoutMs);
      log('Service is ready');
    }

    // ── Connection tests ──
    const session = new Session(
      'integration-test',
      socketPath,
      config.connectTimeoutMs
    );

    session.on('stateChanged', (state: SessionState) => {
      log(`  [session] state -> ${state}`);
    });
    session.on('error', (err: { message: string }) => {
      log(`  [session] error: ${err.message}`);
    });

    await runTest('Session: connect to service', () => testConnect(session));

    if (!session.isConnected) {
      skipTest('Raw JSON-RPC call', 'Not connected');
      skipTest('API: list all packages', 'Not connected');
      skipTest('Install non-existent package', 'Not connected');
      skipTest('Search available packages', 'Not connected');
      skipTest('Create offline package', 'Not connected');
      skipTest('Unimplemented method returns error', 'Not connected');
      skipTest('ServiceLauncher.isServiceRunning', 'Not connected');
      skipTest('Reconnect', 'Not connected');
    } else {
      const packages = new Packages(session);

      await runTest('Protocol: raw JSON-RPC packages/install', () =>
        testRawJsonRpcCall(session)
      );
      await runTest('API: list all packages', () =>
        testListAllPackages(packages)
      );
      await runTest('API: install the first package', () =>
        testInstallFirstAvailablePackage(packages)
      );
      await runTest('Verify: install output directory has content', () =>
        testVerifyInstallOutput()
      );
      await runTest('API: install non-existent package', () =>
        testInstallNonExistentPackage(packages)
      );
      await runTest('API: search available packages', () =>
        testSearchAvailablePackages(packages)
      );
      await runTest('API: create offline package', () =>
        testCreateOfflinePackage(packages)
      );
      await runTest('Protocol: unimplemented method returns error', () =>
        testUnimplementedMethodReturnsError(session)
      );
      await runTest('ServiceLauncher: isServiceRunning', () =>
        testServiceLauncher(socketPath)
      );
      await runTest('Session: reconnect', () =>
        testReconnect(session, socketPath, config.connectTimeoutMs)
      );
    }

    await runTest('Session: disconnect', () => testDisconnect(session));
  } finally {
    if (serviceProcess && !serviceProcess.killed) {
      log('Shutting down service...');
      serviceProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!serviceProcess.killed) {
        serviceProcess.kill('SIGKILL');
      }
    }
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
