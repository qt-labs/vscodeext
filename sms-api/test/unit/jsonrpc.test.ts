/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Unit tests for JsonRpcDispatcher.
 * Mirrors tst_ipc.cpp — tests request structure, response/error dispatch,
 * progress notifications, user-prompt round-trips, and socket-close behaviour.
 */

import assert from 'node:assert/strict';
import * as net from 'net';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { JsonRpcDispatcher } from '../../src/jsonrpc';
import {
  ErrorCategory,
  ErrorCode,
  type SmsError,
  type UserPrompt,
  UserPromptType
} from '../../src/types';
import { MockServer, deferred } from './mockserver';

// ── Test fixture ──────────────────────────────────────────────────────────────

describe('JsonRpcDispatcher', () => {
  let server: MockServer;
  let clientSocket: net.Socket;
  let dispatcher: JsonRpcDispatcher;

  beforeEach(async () => {
    server = new MockServer();
    await server.listen();
    clientSocket = await new Promise<net.Socket>((resolve) => {
      const s = net.createConnection({ path: server.socketPath });
      s.once('connect', () => resolve(s));
    });
    dispatcher = new JsonRpcDispatcher(clientSocket);
  });

  afterEach(() => {
    dispatcher.dispose();
    if (!clientSocket.destroyed) clientSocket.destroy();
    server.close();
  });

  // ── Request structure ───────────────────────────────────────────────────────

  it('call() sends a JSON-RPC 2.0 request with correct structure', async () => {
    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      { packages: [] },
      () => {},
      () => {}
    );

    const { payload } = await msgPromise;

    assert.equal(payload.jsonrpc, '2.0');
    assert.equal(payload.method, 'packages/install');
    assert.ok(
      typeof payload.id === 'string' && payload.id.length > 0,
      'id must be a non-empty string'
    );
    assert.deepEqual((payload.params as Record<string, unknown>).packages, []);
  });

  it('call() stamps userAgent on outbound requests when provided', async () => {
    // Create a dispatcher with a user-agent
    const uaDispatcher = new JsonRpcDispatcher(clientSocket, 'qt-sms');
    const msgPromise = server.nextMessage();
    uaDispatcher.call(
      'packages/install',
      { packages: [] },
      () => {},
      () => {}
    );
    const { payload } = await msgPromise;
    assert.equal(payload.userAgent, 'qt-sms');
    uaDispatcher.dispose();
  });

  it('call() returns the generated request id', async () => {
    const msgPromise = server.nextMessage();
    const id = dispatcher.call(
      'packages/list',
      {},
      () => {},
      () => {}
    );

    assert.ok(typeof id === 'string' && id.length > 0);

    const { payload } = await msgPromise;
    assert.equal(payload.id, id);
  });

  // ── Success response ────────────────────────────────────────────────────────

  it('onSuccess is called when server sends a success response', async () => {
    const successD = deferred<unknown>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/list',
      {},
      (result) => successD.resolve(result),
      () => {}
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      id: payload.id,
      result: { packages: [{ id: 'qt6-base' }] }
    });

    const result = await successD.promise;
    assert.deepEqual(result, { packages: [{ id: 'qt6-base' }] });
  });

  // ── Error response ──────────────────────────────────────────────────────────

  it('onError is called when server sends an error response', async () => {
    const errorD = deferred<SmsError>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      (err) => errorD.resolve(err)
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      id: payload.id,
      error: { code: 5000, category: 5, message: 'No such package found' }
    });

    const err = await errorD.promise;
    assert.equal(err.code, ErrorCode.NoSuchPackage);
    assert.equal(err.category, ErrorCategory.Package);
    assert.equal(err.message, 'No such package found');
  });

  // ── Progress notification ───────────────────────────────────────────────────

  it('onProgress is called when server sends a service/progress notification', async () => {
    const progressD = deferred<number>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      (params) => progressD.resolve(params.progress as number)
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/progress',
      params: { id: payload.id, progress: 0.5, details: 'Extracting' }
    });

    const progress = await progressD.promise;
    assert.equal(progress, 0.5);
  });

  // ── User prompt: choice answer ──────────────────────────────────────────────

  it('onPrompt is called for service/question and reply is sent back', async () => {
    const promptD = deferred<UserPrompt>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      undefined,
      async (prompt) => {
        promptD.resolve(prompt);
        return { kind: 'choice', choice: 'Yes' };
      }
    );

    const { payload, conn } = await msgPromise;
    const reqId = payload.id as string;

    // Server sends a user-prompt request (same id as the install request)
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/question',
      id: reqId,
      params: {
        type: 'Choice',
        id: 'license_agreement_gplv3',
        title: 'GPLv3 License Agreement',
        message: 'Do you accept?',
        defaultAnswer: 'No',
        choices: 'Yes,No'
      }
    });

    const prompt = await promptD.promise;
    assert.equal(prompt.id, 'license_agreement_gplv3');
    assert.equal(prompt.type, UserPromptType.Choice);
    assert.deepEqual(prompt.choices, ['Yes', 'No']);
    assert.equal(prompt.title, 'GPLv3 License Agreement');

    // Dispatcher sends the prompt reply back — server receives it next
    const { payload: reply } = await server.nextMessage();
    assert.equal(reply.id, reqId); // original request id is preserved
    const result = reply.result as Record<string, string>;
    assert.equal(result.id, 'license_agreement_gplv3');
    assert.equal(result.replyChoice, 'Yes');
  });

  // ── User prompt: cancel ─────────────────────────────────────────────────────

  it('canceling a prompt sends a JSON-RPC error response back to the server', async () => {
    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      undefined,
      async (_prompt) => ({ kind: 'cancel' })
    );

    const { payload, conn } = await msgPromise;
    const reqId = payload.id as string;

    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/question',
      id: reqId,
      params: {
        type: 'Choice',
        id: 'license',
        title: 'License',
        message: 'Accept?',
        defaultAnswer: 'No',
        choices: 'Yes,No'
      }
    });

    // Dispatcher sends an error response back to server
    const { payload: cancelResponse } = await server.nextMessage();
    assert.equal(cancelResponse.id, reqId);
    const error = cancelResponse.error as Record<string, unknown>;
    assert.equal(error.code, ErrorCode.UserCancelled);
  });

  // ── Socket close ────────────────────────────────────────────────────────────

  it('all pending calls are rejected with SocketError when the socket closes', async () => {
    const errors: SmsError[] = [];
    const allRejected = new Promise<void>((resolve) => {
      let count = 0;
      const onError = (err: SmsError) => {
        errors.push(err);
        if (++count === 3) resolve();
      };

      // Set up message listeners BEFORE making calls to avoid losing
      // events when all packets arrive in a single data chunk.
      const msg1 = server.nextMessage();
      const msg2 = server.nextMessage();
      const msg3 = server.nextMessage();

      dispatcher.call('packages/install', {}, () => {}, onError);
      dispatcher.call('packages/list', {}, () => {}, onError);
      dispatcher.call('packages/search', {}, () => {}, onError);

      // Wait for all requests to arrive at the server
      void Promise.all([msg1, msg2, msg3]);
    });

    // Allow messages to be delivered before dropping
    await new Promise((r) => setImmediate(r));

    server.dropConnections();

    await allRejected;
    assert.equal(errors.length, 3);
    assert.ok(errors.every((e) => e.code === ErrorCode.SocketError));
  });

  // ── Multiple concurrent calls ───────────────────────────────────────────────

  it('routes each response to the correct pending call by id', async () => {
    const result1D = deferred<unknown>();
    const result2D = deferred<unknown>();

    // Await each message right after sending to avoid races with
    // multiple packets arriving in a single data chunk.
    const msg1Promise = server.nextMessage();
    dispatcher.call(
      'packages/list',
      { tag: 'first' },
      (r) => result1D.resolve(r),
      () => {}
    );
    const { payload: req1, conn } = await msg1Promise;

    const msg2Promise = server.nextMessage();
    dispatcher.call(
      'packages/search',
      { tag: 'second' },
      (r) => result2D.resolve(r),
      () => {}
    );
    const { payload: req2 } = await msg2Promise;

    // Reply to second request first, then first
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      id: req2.id,
      result: { answer: 'two' }
    });
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      id: req1.id,
      result: { answer: 'one' }
    });

    assert.deepEqual(await result1D.promise, { answer: 'one' });
    assert.deepEqual(await result2D.promise, { answer: 'two' });
  });

  // ── Service message notification ────────────────────────────────────────────

  it('onMessage is called when server sends a service/message notification', async () => {
    const messageD = deferred<string>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      undefined,
      undefined,
      (params) => messageD.resolve(params.message as string)
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/message',
      params: { id: payload.id, message: 'Starting download phase' }
    });

    const message = await messageD.promise;
    assert.equal(message, 'Starting download phase');
  });

  // ── Case-insensitive prompt types ───────────────────────────────────────────

  it('handles lowercase prompt type "choice" from server', async () => {
    const promptD = deferred<UserPrompt>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      undefined,
      async (prompt) => {
        promptD.resolve(prompt);
        return { kind: 'choice', choice: 'Yes' };
      }
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/question',
      id: payload.id as string,
      params: {
        type: 'choice',
        id: 'test_prompt',
        title: 'Test',
        message: 'Accept?',
        defaultAnswer: 'No',
        choices: 'Yes,No'
      }
    });

    const prompt = await promptD.promise;
    assert.equal(prompt.type, UserPromptType.Choice);
    assert.equal(prompt.id, 'test_prompt');
  });

  it('handles lowercase prompt type "file" as FilePath', async () => {
    const promptD = deferred<UserPrompt>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      undefined,
      async (prompt) => {
        promptD.resolve(prompt);
        return { kind: 'text', text: '/tmp/myfile' };
      }
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/question',
      id: payload.id as string,
      params: {
        type: 'file',
        id: 'file_prompt',
        title: 'Select file',
        message: 'Pick a file',
        defaultAnswer: '',
        choices: ''
      }
    });

    const prompt = await promptD.promise;
    assert.equal(prompt.type, UserPromptType.FilePath);
  });

  it('handles lowercase prompt type "directory" as DirectoryPath', async () => {
    const promptD = deferred<UserPrompt>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      undefined,
      async (prompt) => {
        promptD.resolve(prompt);
        return { kind: 'text', text: '/tmp' };
      }
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/question',
      id: payload.id as string,
      params: {
        type: 'directory',
        id: 'dir_prompt',
        title: 'Select directory',
        message: 'Pick a directory',
        defaultAnswer: '',
        choices: ''
      }
    });

    const prompt = await promptD.promise;
    assert.equal(prompt.type, UserPromptType.DirectoryPath);
  });

  // ── Placeholder text ────────────────────────────────────────────────────────

  it('parses placeHolderText from prompt params', async () => {
    const promptD = deferred<UserPrompt>();

    const msgPromise = server.nextMessage();
    dispatcher.call(
      'packages/install',
      {},
      () => {},
      () => {},
      undefined,
      async (prompt) => {
        promptD.resolve(prompt);
        return { kind: 'text', text: 'my answer' };
      }
    );

    const { payload, conn } = await msgPromise;
    server.sendJsonRpc(conn, {
      jsonrpc: '2.0',
      method: 'service/question',
      id: payload.id as string,
      params: {
        type: 'text',
        id: 'text_prompt',
        title: 'Enter value',
        message: 'Provide a value',
        defaultAnswer: '',
        choices: '',
        placeHolderText: 'Type here...'
      }
    });

    const prompt = await promptD.promise;
    assert.equal(prompt.placeholderText, 'Type here...');
    assert.equal(prompt.type, UserPromptType.Text);
  });
});
