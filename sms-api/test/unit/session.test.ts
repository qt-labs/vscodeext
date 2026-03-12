/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Unit tests for Session.
 * Mirrors tst_clientsession.cpp — connect/disconnect success and failure.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Session } from '../../src/client';
import { SessionState } from '../../src/types';
import { MockServer } from './mockserver';

describe('Session', () => {
  // ── testConnectDisconnectSuccess ───────────────────────────────────────────

  it('connect transitions state through Connecting → Connected', async () => {
    const server = new MockServer();
    await server.listen();

    const session = new Session(server.socketPath);
    const stateChanges: SessionState[] = [];
    session.on('stateChanged', (s: SessionState) => stateChanges.push(s));

    await session.connectToService();

    assert.equal(session.state, SessionState.Connected);
    assert.ok(session.isConnected);
    assert.deepEqual(stateChanges, [
      SessionState.Connecting,
      SessionState.Connected
    ]);

    // Verify the server accepted exactly one connection
    assert.equal(server.connections.length, 1);

    session.disconnectFromService();
    server.close();
  });

  it('disconnect transitions state to Disconnected and server sees close', async () => {
    const server = new MockServer();
    await server.listen();

    const session = new Session(server.socketPath);
    await session.connectToService();

    const disconnectedPromise = new Promise<void>((resolve) =>
      server.once('clientDisconnected', resolve)
    );

    session.disconnectFromService();
    assert.equal(session.state, SessionState.Disconnected);
    assert.ok(!session.isConnected);

    await disconnectedPromise; // server confirms the socket was closed
    assert.equal(server.connections.length, 0);

    server.close();
  });

  // ── testConnectFailure ─────────────────────────────────────────────────────

  it('connect failure sets state to Error and emits error event', async () => {
    const session = new Session('/tmp/sms-nonexistent-socket-zzz');
    const stateChanges: SessionState[] = [];
    const errors: unknown[] = [];

    session.on('stateChanged', (s: SessionState) => stateChanges.push(s));
    session.on('error', (e: unknown) => errors.push(e));

    await assert.rejects(() => session.connectToService());

    assert.equal(session.state, SessionState.Error);
    assert.ok(!session.isConnected);
    assert.ok(stateChanges.includes(SessionState.Error));
    assert.equal(errors.length, 1);
  });

  // ── connect is idempotent ──────────────────────────────────────────────────

  it('calling connectToService() again when already connected is a no-op', async () => {
    const server = new MockServer();
    await server.listen();

    const session = new Session(server.socketPath);
    await session.connectToService();
    assert.equal(server.connections.length, 1);

    // Second call must not open an additional connection
    await session.connectToService();
    assert.equal(server.connections.length, 1);

    session.disconnectFromService();
    server.close();
  });

  // ── connection loss ────────────────────────────────────────────────────────

  it('state changes to Error when the server drops the connection', async () => {
    const server = new MockServer();
    await server.listen();

    const session = new Session(server.socketPath);
    await session.connectToService();
    assert.equal(session.state, SessionState.Connected);

    const errorPromise = new Promise<void>((resolve) =>
      session.once('error', resolve)
    );

    server.dropConnections();
    await errorPromise;

    assert.equal(session.state, SessionState.Error);

    server.close();
  });
});
