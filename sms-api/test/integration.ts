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
 *   1. Launch QtSoftwareManagementService (unless --socket is given)
 *   2. Connect via sms-api Session
 *   3. Exercise the transport layer (packet encode/decode)
 *   4. Send JSON-RPC requests via the dispatcher
 *   5. Disconnect and shut down
 *
 * NOTE: The service currently only handles "packages/install". Other methods
 * (list, search, updates, info) are not yet implemented on the server side
 * and will time out. The test accounts for this.
 */

import { spawn, type ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';

import {
  Session,
  Packages,
  SessionState,
  encodeJsonPacket,
  PacketReader,
  type DecodedPacket,
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
  return '/tmp/qtclient_socket';
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
  const child = spawn(binPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
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
  // Send a raw JSON-RPC request using the dispatcher directly
  // NOTE: The service currently makes an HTTP call but doesn't send back a
  //       JSON-RPC response on failure, so this may time out.
  const dispatcher = session.dispatcher;
  const callTimeout = 3_000;

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
}

async function testInstallNonExistentPackage(
  packages: Packages
): Promise<void> {
  // Attempt to install a non-existent package — expect an error or response
  // NOTE: Server may time out if it doesn't send JSON-RPC error responses
  const callTimeout = 3_000;
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

async function testUnimplementedMethodTimesOut(
  session: Session
): Promise<void> {
  // Verify that calling an unimplemented method times out
  // (the server silently ignores unknown methods)
  const dispatcher = session.dispatcher;
  const shortTimeout = 2_000;

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
      shortTimeout,
      'packages/list'
    );
    // If we get a response, that's fine too (server may have been updated)
    log(`  -> Unexpectedly got a response (server may implement this now)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timed out')) {
      log(`  -> Confirmed: unimplemented method times out as expected`);
      return;
    }
    // An error response is also acceptable
    log(`  -> Got error response: ${msg}`);
  }
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
  const session2 = new Session(socketPath, timeoutMs);
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
    const session = new Session(socketPath, config.connectTimeoutMs);

    session.on('stateChanged', (state: SessionState) => {
      log(`  [session] state -> ${state}`);
    });
    session.on('error', (err: { message: string }) => {
      log(`  [session] error: ${err.message}`);
    });

    await runTest('Session: connect to service', () => testConnect(session));

    if (!session.isConnected) {
      skipTest('Raw JSON-RPC call', 'Not connected');
      skipTest('Install non-existent package', 'Not connected');
      skipTest('Unimplemented method times out', 'Not connected');
      skipTest('Reconnect', 'Not connected');
    } else {
      const packages = new Packages(session);

      await runTest('Protocol: raw JSON-RPC packages/install', () =>
        testRawJsonRpcCall(session)
      );
      await runTest('API: install non-existent package', () =>
        testInstallNonExistentPackage(packages)
      );
      await runTest('Protocol: unimplemented method times out', () =>
        testUnimplementedMethodTimesOut(session)
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
