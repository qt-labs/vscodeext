// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as net from 'net';

import { IsWindows } from '@util/os';
import { createLogger } from '@/logger';

const logger = createLogger('designer-server');

export class DesignerServer {
  private readonly server: net.Server;
  private client: net.Socket | undefined;
  private readonly port: number;
  private static readonly newLine = IsWindows ? '\r\n' : '\n';

  constructor(port = 0) {
    this.port = port;
    this.server = net.createServer((socket) => {
      socket.pipe(socket);
    });
    this.client = undefined;
    this.start();
    logger.info('Designer server is created');
  }

  public start() {
    this.server
      .listen(this.port, () => {
        logger.info(`Designer server is listening on ${this.port}`);
      })
      .on('connection', (socket) => {
        this.onConnection(socket);
      })
      .on('error', (err) => {
        logger.error(err.message);
        throw err;
      });
  }

  private onConnection(socket: net.Socket) {
    logger.info('Designer server is connected:' + socket.remoteAddress);
    this.client = socket;
  }

  public stop() {
    logger.verbose('Designer server is stopping');
    this.server.close();
  }

  public dispose() {
    this.stop();
  }

  public getPort() {
    if (this.server.address()) {
      return (this.server.address() as net.AddressInfo).port;
    }
  }
  public isClientConnected() {
    return this.client !== undefined && !this.client.destroyed;
  }

  public sendFile(filePath: string) {
    if (!this.client) {
      const message = 'No client connected';
      logger.error(message);
      throw new Error(message);
    }
    logger.info('Sending file:' + filePath);
    this.client.write(filePath.toString() + DesignerServer.newLine);
  }
}
