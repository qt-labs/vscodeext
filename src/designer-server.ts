// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as net from 'net';
import { IsWindows } from './util/os';

class DesignerServer {
  private server: net.Server;
  private client: net.Socket | undefined;
  private port: number;
  private static readonly newLine = IsWindows ? '\r\n' : '\n';

  constructor(port = 0) {
    this.port = port;
    this.server = net.createServer((socket) => {
      socket.pipe(socket);
    });
    this.client = undefined;
  }

  public start() {
    this.server
      .listen(this.port, () => {
        console.log(`Designer server is listening on ${this.port}`);
        const myport = this.getPort();
        void myport;
      })
      .on('connection', (socket) => {
        this.onConnection(socket);
      })
      .on('error', (err) => {
        throw err;
      });
  }

  private onConnection(socket: net.Socket) {
    console.log('Designer server is connected');
    // print the address of the client
    console.log(socket.remoteAddress);
    this.client = socket;
  }

  public stop() {
    this.server.close();
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
      throw new Error('No client connected');
    }
    this.client.write(filePath.toString() + DesignerServer.newLine);
  }
}

export const designerServer = new DesignerServer();
