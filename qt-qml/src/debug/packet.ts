// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { PromiseSocket } from 'promise-socket';
import { Socket } from 'net';

import { DataStream } from '@debug/datastream';
import { createLogger } from 'qt-lib';

type PacketSocket = PromiseSocket<Socket>;

const logger = createLogger('PacketProtocol');

export class Packet extends DataStream {}

export class PacketProtocol {
  private readonly _dev: PacketSocket;
  private readonly _readyRead = new vscode.EventEmitter<void>();
  private readonly _protocolError = new vscode.EventEmitter<void>();
  private readonly _packets = new Array<Packet>();
  private _sendingPackets = new Array<number>();
  private readonly _bytesWritten = new vscode.EventEmitter<number>();
  private static readonly notInProgress = -1;
  private _inProgressSize = PacketProtocol.notInProgress;
  private _inProgress = Buffer.alloc(0);
  constructor(socket: Socket) {
    socket.on('readable', () => {
      this.readyToRead();
    });
    socket.readable;
    socket.on('close', () => {
      this.aboutToClose();
    });
    this.onBytesWritten((bytes) => {
      this.bytesWritten(bytes);
    });
    this._dev = new PromiseSocket(socket);
  }
  packetsAvailable(): boolean {
    return this._packets.length > 0;
  }
  aboutToClose() {
    this._inProgress = Buffer.alloc(0);
    this._sendingPackets = [];
    this._inProgressSize = PacketProtocol.notInProgress;
  }
  readyToRead() {
    const dev = this._dev.socket;
    const int32SIZE = 4;
    // Maybe while (true)??
    while (this._dev.socket.readable) {
      // Need to get trailing data
      if (PacketProtocol.notInProgress == this._inProgressSize) {
        // We need a size header of sizeof(qint32)
        if (int32SIZE > dev.readableLength) {
          return;
        }
        // Read size header
        const inProgressSizeLE: Buffer | null = dev.read(
          int32SIZE
        ) as Buffer | null;
        if (inProgressSizeLE === null) {
          this.fail();
          logger.error('Cannot read size header');
          return;
        }
        this._inProgressSize = inProgressSizeLE.readInt32LE();
        // Check sizing constraints
        if (this._inProgressSize < int32SIZE) {
          logger.error('Packet size is too small');
          return;
        }
        this._inProgressSize -= int32SIZE;
      } else {
        const temp = dev.read(
          this._inProgressSize - this._inProgress.length
        ) as Buffer | null;
        if (temp === null) {
          logger.error('Cannot read packet');
          return;
        }
        this._inProgress = Buffer.concat([this._inProgress, temp]);
        if (this._inProgressSize === this._inProgress.length) {
          // Packet has arrived!
          this._packets.push(new Packet(this._inProgress));
          this._inProgressSize = PacketProtocol.notInProgress;
          this._inProgress = Buffer.alloc(0);

          this.readyRead();
        } else {
          return;
        }
      }
    }
  }
  read() {
    const first = this._packets.shift();
    if (first) {
      return first;
    }
    return new Packet();
  }
  fail() {
    this._dev.socket.removeAllListeners();
    this._bytesWritten.dispose();
    this._protocolError.fire();
  }
  disconnect() {
    this._readyRead.dispose();
    this._protocolError.dispose();
  }
  readyRead() {
    this._readyRead.fire();
  }
  get onReadyRead() {
    return this._readyRead.event;
  }
  async send(buffer: Buffer) {
    // return if the size is more than max int32 - 4
    const maxSendSize = 0x7fffffff - 4;
    if (buffer.length > maxSendSize) {
      throw new Error('Packet is too large');
    }
    if (this._dev.socket.destroyed) {
      return;
    }
    if (buffer.length === 0) {
      return; // We don't send empty packets
    }
    const sendSize = buffer.length + 4;
    this._sendingPackets.push(sendSize);
    let tempBuffer = Buffer.alloc(4);
    tempBuffer.writeInt32LE(sendSize);
    tempBuffer = Buffer.concat([tempBuffer, buffer]);
    await this.waitUntilWritten(tempBuffer);
    this._bytesWritten.fire(sendSize);
  }
  get onBytesWritten() {
    return this._bytesWritten.event;
  }

  bytesWritten(bytes: number) {
    if (this._sendingPackets.length === 0) {
      throw new Error('No packets to send');
    }
    while (bytes) {
      if (!this._sendingPackets[0]) {
        return;
      }
      if (this._sendingPackets[0] > bytes) {
        this._sendingPackets[0] -= bytes;
        bytes = 0;
      } else {
        bytes -= this._sendingPackets[0];
        this._sendingPackets.shift();
      }
    }
  }

  private async waitUntilWritten(buffer: Buffer) {
    let written = 0;
    while (written < buffer.length) {
      written = await this._dev.write(buffer);
      buffer = buffer.subarray(written);
    }
  }
}
