// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as net from 'net';

import { createWrappedLogger, IsWindows } from 'qt-lib';

interface WriteOption {
  addNewLine: boolean;
}
const DefaultWriteOption: WriteOption = { addNewLine: false };
const logger = createWrappedLogger('ui-designer-tcp-server');

export class UiDesignerTcpServer {
  private _server: net.Server | undefined;
  private _clientSocket: net.Socket | undefined;

  constructor(private readonly _name: string) {}

  public dispose() {
    if (this._clientSocket) {
      this._clientSocket.destroy();
      this._clientSocket = undefined;
    }

    if (this._server) {
      this._server.close();
    }
  }

  get port(): number | undefined {
    const addr = this._server?.address();
    return addr ? (addr as net.AddressInfo).port : undefined;
  }

  get portAsString(): string {
    return this.port?.toString() ?? '';
  }

  public ensureListening() {
    if (!this._server) {
      this._server = net.createServer((socket) => {
        socket.pipe(socket);
      });
    }

    this._listen();
  }

  public hasConnection() {
    return this._clientSocket !== undefined && !this._clientSocket.destroyed;
  }

  public writeToClient(text: string, option = DefaultWriteOption) {
    if (!this._clientSocket) {
      logger
        .text('Cannot write to client, socket is not ready')
        .data('name', this._name)
        .data('content', text)
        .data('length', text.length.toString())
        .data('port', this.portAsString)
        .error();
      return;
    }

    logger
      .text('Writing to the client')
      .data('name', this._name)
      .data('content', text)
      .data('length', text.length.toString())
      .data('port', this.portAsString)
      .info();

    this._clientSocket.write(text);

    if (option.addNewLine) {
      this._clientSocket.write(IsWindows ? '\r\n' : '\n');
    }
  }

  // private
  private _listen() {
    if (!this._server || this._server.listening) {
      return;
    }

    logger.text('Server is starting').data('name', this._name).info();

    this._server
      .listen(0, () => {
        logger
          .text('Server is listening')
          .data('name', this._name)
          .data('port', this.portAsString)
          .info();
      })
      .on('connection', (socket: net.Socket) => {
        this._clientSocket = socket;
        logger
          .text('Server is connected')
          .data('name', this._name)
          .data('address', socket.remoteAddress ?? '')
          .data('port', this.portAsString)
          .info();
      })
      .on('error', (err) => {
        logger
          .text('Server error')
          .data('name', this._name)
          .data('error', err.message)
          .error();
      });
  }
}
