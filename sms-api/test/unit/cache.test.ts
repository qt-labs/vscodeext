/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Unit tests for the Cache API.
 * Tests cache/update and cache/clear IPC methods.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { Cache, Session } from '../../src/client';
import { ProgressType } from '../../src/types';
import { MockServer, deferred } from './mockserver';

describe('Cache', () => {
  let server: MockServer;
  let session: Session;
  let cache: Cache;

  beforeEach(async () => {
    server = new MockServer();
    await server.listen();
    session = new Session('test', server.socketPath);
    session.on('error', () => {});
    await session.connectToService();
    cache = new Cache(session);
  });

  afterEach(() => {
    session.disconnectFromService();
    server.close();
  });

  // ── updateCache ────────────────────────────────────────────────────────────

  describe('updateCache', () => {
    it('sends cache/update method and resolves with result message', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = cache.updateCache();

      const { payload, conn } = await msgPromise;
      assert.equal(payload.jsonrpc, '2.0');
      assert.equal(payload.method, 'cache/update');
      assert.ok(typeof payload.id === 'string' && payload.id.length > 0);

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { message: 'Cache updated successfully' }
      });

      const result = await resultPromise;
      assert.equal(result, 'Cache updated successfully');
    });

    it('rejects with error when server responds with error', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = cache.updateCache();

      const { payload, conn } = await msgPromise;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        error: {
          code: 7000,
          category: 7,
          message: 'Invalid or corrupted cache'
        }
      });

      const err = await resultPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'Invalid or corrupted cache');
    });

    it('calls onProgress callback from service/progress notification', async () => {
      const progressD = deferred<{ progress: number; type: string }>();

      const msgPromise = server.nextMessage();
      const resultPromise = cache.updateCache({
        onProgress: (info) =>
          progressD.resolve({ progress: info.progress, type: info.type })
      });

      const { payload, conn } = await msgPromise;
      const reqId = payload.id as string;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        method: 'service/progress',
        params: {
          id: reqId,
          progress: 0.75,
          type: 'query',
          message: 'Fetching metadata'
        }
      });

      const result = await progressD.promise;
      assert.equal(result.progress, 0.75);
      assert.equal(result.type, ProgressType.Query);

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: reqId,
        result: { message: 'Done' }
      });
      await resultPromise;
    });

    it('rejects when server drops the connection', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = cache.updateCache();

      await msgPromise;
      server.dropConnections();

      const err = await resultPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
    });
  });

  // ── clearCache ─────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('sends cache/clear method and resolves with result message', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = cache.clearCache();

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'cache/clear');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { message: 'Cache cleared successfully' }
      });

      const result = await resultPromise;
      assert.equal(result, 'Cache cleared successfully');
    });

    it('rejects with error when server responds with error', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = cache.clearCache();

      const { payload, conn } = await msgPromise;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        error: {
          code: 7000,
          category: 7,
          message: 'Invalid or corrupted cache'
        }
      });

      const err = await resultPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'Invalid or corrupted cache');
    });
  });
});
