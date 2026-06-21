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

  constructor(private readonly _folderName: string) {
    logger.setOutputOptions({ multipleLine: true });
  }

  public dispose() {
    if (this._clientSocket) {
      this._clientSocket.destroy();
      this._clientSocket = undefined;
    }

    if (this._server) {
      this._server.close();
    }
  }

  public ensureListening() {
    if (!this._server) {
      this._server = net.createServer((socket) => {
        socket.pipe(socket);
      });
    }

    this._listen();
    return this._activePort();
  }

  public hasConnection() {
    return this._clientSocket !== undefined && !this._clientSocket.destroyed;
  }

  public writeToClient(text: string, option = DefaultWriteOption) {
    const logData = {
      folder: this._folderName,
      port: this._activePort(),
      content: text,
      addNewLine: option.addNewLine
    };

    if (!this._clientSocket) {
      logger
        .text('Cannot write to client, socket is not ready')
        .data(logData)
        .error();
      return;
    }

    logger.text('Writing to the client').data(logData).info();

    this._clientSocket.write(text);

    if (option.addNewLine) {
      this._clientSocket.write(IsWindows ? '\r\n' : '\n');
    }
  }

  // private
  private _activePort(): number | undefined {
    const addr = this._server?.address();
    return addr ? (addr as net.AddressInfo).port : undefined;
  }

  private _listen() {
    if (!this._server || this._server.listening) {
      return;
    }

    const logData = {
      folder: this._folderName,
      port: this._activePort()
    };

    logger.text('Server is starting').data(logData).info();

    this._server
      .listen(0, () => {
        logger.text('Server is listening').data(logData).info();
      })
      .on('connection', (socket: net.Socket) => {
        this._clientSocket = socket;
        logger
          .text('Server is connected')
          .data(logData)
          .data('address', socket.remoteAddress ?? '')
          .info();
      })
      .on('error', (e) => {
        logger.text('Server error').data(logData).data('error', e).error();
      });
  }
}
