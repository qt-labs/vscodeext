/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import * as net from 'net';
import { EventEmitter } from 'events';

/**
 * Packet framing compatible with QInstaller::Core::PacketIO.
 *
 * Wire format per packet:
 *   [4-byte  int32-LE  payloadSize]
 *   [command bytes]  [\0]  [data bytes]
 *
 * For JSON-RPC the command is always "JSON".
 */

const COMMAND_JSON = 'JSON';
const NULL_BYTE = Buffer.from([0]);

// ── Encoding ─────────────────────────────────────────────────────────────────

export function encodePacket(command: string, data: string): Buffer {
  const cmdBuf = Buffer.from(command, 'utf-8');
  const dataBuf = Buffer.from(data, 'utf-8');
  const payloadSize = cmdBuf.length + 1 /* \0 */ + dataBuf.length;

  const header = Buffer.allocUnsafe(4);
  header.writeInt32LE(payloadSize, 0);

  return Buffer.concat([header, cmdBuf, NULL_BYTE, dataBuf]);
}

export function encodeJsonPacket(json: string): Buffer {
  return encodePacket(COMMAND_JSON, json);
}

// ── Decoding ─────────────────────────────────────────────────────────────────

export interface DecodedPacket {
  command: string;
  data: string;
}

/**
 * Accumulates raw socket chunks and emits complete decoded packets.
 *
 * Usage:
 *   const reader = new PacketReader();
 *   socket.on('data', chunk => reader.feed(chunk));
 *   reader.on('packet', (pkt: DecodedPacket) => { ... });
 */
export class PacketReader extends EventEmitter {
  private buf: Buffer = Buffer.alloc(0);

  feed(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    this.drain();
  }

  private drain(): void {
    while (this.buf.length >= 4) {
      const payloadSize = this.buf.readInt32LE(0);
      if (payloadSize <= 0) {
        // Corrupted stream – discard the 4 header bytes and try again
        this.buf = this.buf.subarray(4);
        continue;
      }
      const totalSize = 4 + payloadSize;
      if (this.buf.length < totalSize) {
        break; // Incomplete packet – wait for more data
      }

      const payload = this.buf.subarray(4, totalSize);
      this.buf = this.buf.subarray(totalSize);

      const sep = payload.indexOf(0);
      if (sep < 0) {
        // Malformed packet – no null separator found, skip
        continue;
      }

      const command = payload.subarray(0, sep).toString('utf-8');
      const data = payload.subarray(sep + 1).toString('utf-8');
      this.emit('packet', { command, data } satisfies DecodedPacket);
    }
  }

  reset(): void {
    this.buf = Buffer.alloc(0);
  }
}

// ── Socket helpers ───────────────────────────────────────────────────────────

export interface TransportOptions {
  socketPath: string;
  connectTimeoutMs?: number;
}

/**
 * Connect to the service's Unix domain socket / Windows named pipe.
 * Returns a connected `net.Socket`.
 */
export async function connectSocket(
  opts: TransportOptions
): Promise<net.Socket> {
  const { socketPath, connectTimeoutMs = 5000 } = opts;

  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath });

    const timer = setTimeout(() => {
      socket.destroy();
      reject(
        new Error(
          `Connection to ${socketPath} timed out after ${String(connectTimeoutMs)}ms`
        )
      );
    }, connectTimeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
