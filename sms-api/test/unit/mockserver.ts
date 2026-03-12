/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Shared helpers for sms-api unit tests.
 *
 * MockServer: listens on a unique temporary Unix-domain socket, decodes
 * incoming JSON-RPC packets, and lets tests inject responses.
 */

import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import { PacketReader, encodeJsonPacket } from '../../src/transport';

// ── ServerMessage ─────────────────────────────────────────────────────────────

export interface ServerMessage {
  payload: Record<string, unknown>;
  conn: net.Socket;
}

// ── MockServer ────────────────────────────────────────────────────────────────

/**
 * In-process mock socket server for unit tests.
 *
 * Usage:
 *   const server = new MockServer();
 *   await server.listen();
 *   // ... connect a client to server.socketPath ...
 *   const { payload, conn } = await server.nextMessage();
 *   server.sendJsonRpc(conn, { jsonrpc: '2.0', id: payload.id, result: {} });
 *   server.close();
 */
export class MockServer extends EventEmitter {
  readonly socketPath: string;
  private readonly server: net.Server;
  readonly connections: net.Socket[] = [];

  constructor() {
    super();
    this.socketPath = path.join(os.tmpdir(), `sms-test-${randomUUID()}`);
    this.server = net.createServer((conn) => {
      this.connections.push(conn);
      const reader = new PacketReader();
      conn.on('data', (chunk: Buffer) => reader.feed(chunk));
      reader.on('packet', (pkt: { command: string; data: string }) => {
        if (pkt.command !== 'JSON') return;
        try {
          const payload = JSON.parse(pkt.data) as Record<string, unknown>;
          this.emit('message', { payload, conn } satisfies ServerMessage);
        } catch {
          // ignore unparseable JSON
        }
      });
      conn.once('close', () => {
        const idx = this.connections.indexOf(conn);
        if (idx >= 0) this.connections.splice(idx, 1);
        this.emit('clientDisconnected');
      });
    });
  }

  listen(): Promise<void> {
    return new Promise((resolve) =>
      this.server.listen(this.socketPath, resolve)
    );
  }

  /** Send a JSON-RPC message to the given client connection. */
  sendJsonRpc(conn: net.Socket, msg: unknown): void {
    conn.write(encodeJsonPacket(JSON.stringify(msg)));
  }

  /** Resolves with the next JSON-RPC message received from any client. */
  nextMessage(): Promise<ServerMessage> {
    return new Promise((resolve) => this.once('message', resolve));
  }

  /** Drop all open connections (simulates the server going away). */
  dropConnections(): void {
    for (const conn of [...this.connections]) conn.destroy();
  }

  close(): void {
    this.dropConnections();
    this.server.close();
    try {
      fs.unlinkSync(this.socketPath);
    } catch {
      // ignore if already gone
    }
  }
}

// ── Deferred ──────────────────────────────────────────────────────────────────

export interface Deferred<T> {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<T>;
}

/** Creates a Promise whose resolve/reject functions are exposed externally. */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}
