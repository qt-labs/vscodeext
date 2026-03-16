/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Unit tests for the Settings API.
 * Tests settings/set and settings/get IPC methods.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { Settings, Session } from '../../src/client';
import { MockServer, deferred } from './mockserver';

describe('Settings', () => {
  let server: MockServer;
  let session: Session;
  let settings: Settings;

  beforeEach(async () => {
    server = new MockServer();
    await server.listen();
    session = new Session(server.socketPath);
    session.on('error', () => {});
    await session.connectToService();
    settings = new Settings(session);
  });

  afterEach(() => {
    session.disconnectFromService();
    server.close();
  });

  // ── setSetting ─────────────────────────────────────────────────────────────

  describe('setSetting', () => {
    it('sends settings/set method with key-value params and resolves with message', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = settings.setSetting(
        'proxy_url',
        'http://proxy:8080'
      );

      const { payload, conn } = await msgPromise;
      assert.equal(payload.jsonrpc, '2.0');
      assert.equal(payload.method, 'settings/set');
      assert.ok(typeof payload.id === 'string' && payload.id.length > 0);

      // Verify the params contain the key-value pair
      const params = payload.params as Record<string, string>[];
      assert.ok(Array.isArray(params));
      assert.equal(params.length, 1);
      assert.equal(params[0].proxy_url, 'http://proxy:8080');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { message: 'Setting for key proxy_url updated successfully' }
      });

      const result = await resultPromise;
      assert.equal(result, 'Setting for key proxy_url updated successfully');
    });

    it('rejects with error when setting is not permitted', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = settings.setSetting('restricted_key', 'value');

      const { payload, conn } = await msgPromise;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        error: {
          code: 9000,
          category: 9,
          message: 'Setting operation not permitted for key restricted_key'
        }
      });

      const err = await resultPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
      assert.ok(err.message.includes('not permitted'));
    });

    it('rejects when server drops the connection', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = settings.setSetting('key', 'value');

      await msgPromise;
      server.dropConnections();

      const err = await resultPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
    });
  });

  // ── getSetting ─────────────────────────────────────────────────────────────

  describe('getSetting', () => {
    it('sends settings/get method with key and resolves with value', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = settings.getSetting('proxy_url');

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'settings/get');

      const params = payload.params as Record<string, string>;
      assert.equal(params.key, 'proxy_url');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { proxy_url: 'http://proxy:8080' }
      });

      const result = await resultPromise;
      assert.equal(result, 'http://proxy:8080');
    });

    it('rejects with error when key does not exist', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = settings.getSetting('nonexistent_key');

      const { payload, conn } = await msgPromise;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        error: {
          code: 9001,
          category: 9,
          message: 'No such setting key exists'
        }
      });

      const err = await resultPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'No such setting key exists');
    });
  });
});
