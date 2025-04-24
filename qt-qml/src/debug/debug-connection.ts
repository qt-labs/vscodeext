// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { Socket } from 'net';

import { createLogger } from 'qt-lib';
import { Packet, PacketProtocol } from '@debug/packet';
import { Timer } from '@debug/timer';

const logger = createLogger('debug-connection');

export enum ServerScheme {
  Tcp = 'tcp',
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Socket = 'unix'
}

export enum SocketState {
  UnconnectedState = 0,
  HostLookupState = 1,
  ConnectingState = 2,
  ConnectedState = 3,
  BoundState = 4,
  ListeningState = 5,
  ClosingState = 6
}

export enum QmlDebugConnectionState {
  NotConnected,
  Unavailable,
  Enabled,
  Connected
}

export interface Server {
  host: string;
  port: number;
  scheme: ServerScheme;
}

const serverId = 'QDeclarativeDebugServer';
const clientId = 'QDeclarativeDebugClient';
const protocolVersion = 1;

export class QmlDebugConnectionManager {
  private readonly _connectionTimer: Timer = new Timer();
  private _server: Server | undefined;
  private _connection: QmlDebugConnection | undefined;
  private _retryInterval = 400; // 200ms??
  private _maximumRetries = 50; // 10??
  private _numRetries = 0;
  private readonly _connectionClosed = new vscode.EventEmitter<void>();
  private readonly _connectionFailed = new vscode.EventEmitter<void>();

  get connection() {
    return this._connection;
  }
  get retryInterval() {
    return this._retryInterval;
  }
  set retryInterval(value: number) {
    this._retryInterval = value;
  }
  set maximumRetries(value: number) {
    this._maximumRetries = value;
  }
  get maximumRetries() {
    return this._maximumRetries;
  }
  dispose() {
    if (this._connection) {
      this._connection.dispose();
    }
  }
  disconnectToConnection() {
    if (this._connection) {
      this._connection.disconnect();
    }
  }
  isConnected() {
    if (!this._connection) {
      return false;
    }
    return this._connection.isConnected();
  }

  connectToServer(server: Server) {
    if (this._server !== server) {
      this._server = server;
      // destroyConnection(); // TODO: Implement
      // stopConnectionTimer(); // TODO: Implement
    }
    if (this._server.scheme === ServerScheme.Tcp) {
      this.connectToTcpServer();
    } else {
      throw new Error('Not implemented');
    }
  }
  connectToTcpServer() {
    if (!this._server) {
      throw new Error('Server not set');
    }
    if (!this._connection) {
      this.createConnection();
    }
    const onTimeout = () => {
      if (this.isConnected()) {
        return;
      }
      if (++this._numRetries < this.maximumRetries) {
        if (!this._connection) {
          // If the previous connection failed, recreate it.

          // Assign _connection explicitly to avoid TS error
          // TODO: Remove the below line and find a better way to handle this
          // Because _connection is already assigned in createConnection()
          this._connection = new QmlDebugConnection();
          this.createConnection();
          if (!this._server) {
            throw new Error('Server not set');
          }
          this._connection.connectToHost(this._server.host, this._server.port);
        } else if (
          this._numRetries < this._maximumRetries &&
          this._connection.socketState() !== SocketState.ConnectedState
        ) {
          // If we don't get connected in the first retry interval, drop the socket and try
          // with a new one. On some operating systems (macOS) the very first connection to a
          // TCP server takes a very long time to get established and this helps.
          // On other operating systems (windows) every connection takes forever to get
          // established. So, after tearing down and rebuilding the socket twice, just
          // keep trying with the same one.
          if (!this._server) {
            throw new Error('Server not set');
          }
          this._connection.connectToHost(this._server.host, this._server.port);
        } // Else leave it alone and wait for hello.
      } else {
        // On final timeout, clear the connection.
        this.stopConnectionTimer();
        this.destroyConnection();
        this._connectionFailed.fire();
      }
    };
    this._connectionTimer.onTimeout(() => {
      onTimeout();
    });
    this._connectionTimer.start(this._retryInterval);

    if (this._connection) {
      this._connection.connectToHost(this._server.host, this._server.port);
    }
  }
  stopConnectionTimer() {
    this._connectionTimer.stop();
  }
  destroyConnection() {
    if (this._connection) {
      this._connection.disconnect();
      this._connection = undefined;
      this._connectionTimer.stop();
      this._connectionTimer.disconnect();
      // destroyClients(); TODO: Needs this?
      this._numRetries = 0;
    }
  }
  createConnection() {
    this._connection = new QmlDebugConnection();
    this.createClients();
    this.connectConnectionSignals();
  }
  createClients() {
    void this;
  }
  connectConnectionSignals() {
    if (!this._connection) {
      throw new Error('Connection not set');
    }
    this._connection.onConnected(() => {
      this.qmlDebugConnectionOpened();
    });
    this._connection.onDisconnected(() => {
      this.qmlDebugConnectionClosed();
    });
  }
  qmlDebugConnectionOpened() {
    if (this._connection?.isConnected()) {
      return;
    }
    logger.info('Connection opened');
    this.stopConnectionTimer();
  }
  qmlDebugConnectionClosed() {
    if (!this._connection?.isConnected()) {
      return;
    }
    logger.info('Connection closed');
    // this.destroyConnection(); // TODO: Implement
    this._connectionClosed.fire();
  }
  qmlDebugConnectionFailed() {
    if (this._connection) {
      return;
    }
    logger.error('Connection failed');
    this._connectionFailed.fire();
  }
}

export class QmlDebugConnection {
  private readonly _serverPlugins = new Map<string, number>();
  private _device: Socket | undefined;
  private _protocol: PacketProtocol | undefined;
  private static readonly minStreamVersion = 12;
  private _currentDataStreamVersion = QmlDebugConnection.minStreamVersion;
  private readonly _maximumDataStreamVersion = 23; // Qt_DefaultCompiledVersion??
  private readonly _connected = new vscode.EventEmitter<void>();
  private readonly _disconnected = new vscode.EventEmitter<void>();
  private readonly _connectionFailed = new vscode.EventEmitter<void>();
  private _gotHello = false;
  private readonly _plugins = new Map<string, QmlDebugClient>();
  get gotHello() {
    return this._gotHello;
  }
  disconnect() {
    this._disconnected.dispose();
    this._connectionFailed.dispose();
  }
  get onConnected() {
    return this._connected.event;
  }
  get onDisconnected() {
    return this._disconnected.event;
  }
  get onConnectionFailed() {
    return this._connectionFailed.event;
  }
  serviceVersion(serviceName: string) {
    const version = this._serverPlugins.get(serviceName);
    if (version) {
      return version;
    }
    return -1;
  }
  socketState() {
    if (!this._device) {
      return SocketState.UnconnectedState;
    }
    if (this._device.readyState === 'open') {
      return SocketState.ConnectedState;
    }
    if (
      this._device.connecting ||
      this._device.readyState === 'opening' ||
      this._device.pending
    ) {
      return SocketState.ConnectingState;
    }
    if (this._device.destroyed || this._device.closed) {
      return SocketState.UnconnectedState;
    }
    throw new Error('Unknown socket state');
  }
  socketDisconnected() {
    if (this.gotHello) {
      this._gotHello = false;
      for (const p of this._plugins.values()) {
        p.stateChanged(QmlDebugConnectionState.Unavailable);
      }
      this._disconnected.fire();
    } else if (this._device) {
      this._connectionFailed.fire();
    }

    if (this._protocol) {
      this._protocol.disconnect();
      // d->protocol->deleteLater(); // Do we need this?
      this._protocol = undefined;
    }
    if (this._device) {
      // TODO: Do we need this?
      // Don't allow any "connected()" or "disconnected()" signals to be triggered anymore.
      // As the protocol is gone this would lead to crashes.
      // d->device->disconnect();
      this._device.destroy();
      // Don't immediately delete it as it may do some cleanup on returning from a signal.
      // d->device->deleteLater();
      this._device = undefined;
    }
  }
  close() {
    if (this._device && this._device.readyState === 'open') {
      this._device.destroy();
    }
  }
  dispose() {
    this.socketDisconnected();
    this.disconnect();
  }
  isConnected() {
    return this.gotHello;
  }
  isConnecting() {
    return !this.gotHello && this._device;
  }

  connectToHost(host: string | undefined, port: number) {
    this.socketDisconnected();
    this._device = new Socket();
    this._protocol = new PacketProtocol(this._device);
    this._protocol.onReadyRead(() => {
      this.protocolReadyRead();
    });
    this._device.on('error', (error: Error) => {
      logger.error('Cannot connect to host:' + error.stack);
      this.socketDisconnected();
    });
    this._device.on('connect', () => {
      logger.info('Connected to host');
      void this.socketConnected();
    });
    this._device.on('close', () => {
      logger.info('Socket closed');
      this.socketDisconnected();
    });
    this._device.connect(port, host ? host : 'localhost');
  }
  async socketConnected() {
    const packet = new Packet();
    packet.writeStringUTF16(serverId);
    packet.writeInt32BE(0); // OP
    packet.writeInt32BE(1); // Version
    const plugins = Array.from(this._plugins.keys());
    packet.writeArray(plugins, (plugin) => {
      packet.writeStringUTF16(plugin);
    });
    packet.writeInt32BE(QmlDebugConnection.minStreamVersion);
    packet.writeBoolean(true); // We accept multiple messages per packet
    if (!this._protocol) {
      throw new Error('Protocol not set');
    }
    await this._protocol.send(packet.data);
  }
  protocolReadyRead() {
    if (!this._protocol) {
      throw new Error('Protocol not set');
    }
    if (!this._gotHello) {
      const pack = this._protocol.read();
      const name = pack.readStringUTF16LE();
      let validHello = false;
      if (name === clientId) {
        const op = pack.readInt32BE();
        if (op == 0) {
          const version = pack.readInt32BE();
          if (version == protocolVersion) {
            const pluginNames = pack.readArrayString();
            const pluginNamesSize = pluginNames.length;
            const pluginVersions = pack.readArrayDouble();
            const pluginVersionsSize = pluginVersions.length;
            for (let i = 0; i < pluginNamesSize; i++) {
              let pluginVersion = 1.0;
              if (i < pluginVersionsSize) {
                const temp = pluginVersions[i];
                if (!temp) {
                  throw new Error('Plugin version is not a number');
                }
                pluginVersion = temp;
              }
              const tempPluginName = pluginNames[i];
              if (!tempPluginName) {
                throw new Error('Plugin name is not a string');
              }
              this._serverPlugins.set(tempPluginName, pluginVersion);
            }
            if (!pack.atEnd()) {
              this._currentDataStreamVersion = pack.readInt32BE();
              if (
                this._currentDataStreamVersion > this._maximumDataStreamVersion
              ) {
                logger.warn('Server returned invalid data stream version!');
              }
              validHello = true;
            }
          }
        }
      }

      if (!validHello) {
        logger.warn('QML Debug Client: Invalid hello message');
        this.close();
        return;
      }
      this._gotHello = true;
      for (const [key, value] of this._plugins) {
        let newState = QmlDebugConnectionState.Unavailable;
        if (this._serverPlugins.has(key)) {
          newState = QmlDebugConnectionState.Enabled;
        }
        value.stateChanged(newState);
      }
      this._connected.fire();
    }
    while (this._protocol.packetsAvailable()) {
      const pack = this._protocol.read();
      const name = pack.readStringUTF16LE();

      if (name === clientId) {
        const op = pack.readInt32BE();
        if (op === 1) {
          // Service Discovery
          const oldServerPlugins = new Map(this._serverPlugins);
          this._serverPlugins.clear();

          const pluginNames = pack.readArrayString();
          let pluginVersions: number[] | undefined;
          if (!pack.atEnd()) {
            pluginVersions = pack.readArrayDouble();
          }
          const pluginNamesSize = pluginNames.length;
          const pluginVersionsSize = pluginVersions ? pluginVersions.length : 0;
          for (let i = 0; i < pluginNamesSize; i++) {
            let pluginVersion = 1.0;
            if (pluginVersions && i < pluginVersionsSize) {
              const temp = pluginVersions[i];
              if (!temp) {
                throw new Error('Plugin version is not a number');
              }
              pluginVersion = temp;
            }
            const tempPluginName = pluginNames[i];
            if (!tempPluginName) {
              throw new Error('Plugin name is not a string');
            }
            this._serverPlugins.set(tempPluginName, pluginVersion);
          }
          for (const [pluginName, plugin] of this._plugins) {
            let newState = QmlDebugConnectionState.Unavailable;
            if (this._serverPlugins.has(pluginName)) {
              newState = QmlDebugConnectionState.Enabled;
            }

            if (
              oldServerPlugins.has(pluginName) !=
              this._serverPlugins.has(pluginName)
            ) {
              plugin.stateChanged(newState);
            }
          }
        } else {
          logger.warn('QML Debug Client: Unknown control message id' + op);
        }
      } else {
        const client = this._plugins.get(name);
        if (!client) {
          logger.warn(
            'QML Debug Client: Message received for missing plugin' + name
          );
        } else {
          while (!pack.atEnd()) {
            const subPacket = pack.readSubDataStream();
            client.messageReceived(subPacket);
          }
        }
      }
    }
  }
  async sendMessage(name: string, message: Packet) {
    if (!this.gotHello || !this._plugins.has(name)) {
      return false;
    }
    const packet = new Packet();
    packet.writeStringUTF16(name);
    packet.writeSubDataStream(message);
    await this._protocol?.send(packet.data);
    // TODO: Needs to flush the data?
    return true;
  }
  async addClient(name: string, client: QmlDebugClient) {
    if (this._plugins.has(name)) {
      return false;
    }
    this._plugins.set(name, client);
    await this.advertisePlugins();
    return true;
  }
  async removeClient(name: string) {
    if (!this._plugins.has(name)) {
      return false;
    }
    this._plugins.delete(name);
    await this.advertisePlugins();
    return true;
  }
  async advertisePlugins() {
    if (!this.gotHello) {
      return;
    }
    const packet = new Packet();
    packet.writeStringUTF16(serverId);
    packet.writeInt32BE(1); // Version
    const plugins = Array.from(this._plugins.keys());
    for (const plugin of plugins) {
      packet.writeStringUTF16(plugin);
    }
    packet.writeInt32BE(QmlDebugConnection.minStreamVersion);
    packet.writeBoolean(true);
    await this._protocol?.send(packet.data);
  }
  getClient(name: string) {
    return this._plugins.get(name);
  }
}

export interface IQmlDebugClient {
  messageReceived(packet: Packet): void;
  stateChanged(state: QmlDebugConnectionState): void;
}
export class QmlDebugClient {
  constructor(
    private readonly _name: string,
    private readonly _connection: QmlDebugConnection
  ) {
    void this._connection.addClient(this._name, this);
  }
  serviceVersion() {
    return this._connection.serviceVersion(this.name);
  }
  get name() {
    return this._name;
  }
  get connection() {
    return this._connection;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  messageReceived(_packet: Packet): void {
    void this;
    throw new Error('Method not implemented.');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stateChanged(_state: QmlDebugConnectionState) {
    void this;
    throw new Error('Method not implemented.');
  }
  getState(): QmlDebugConnectionState {
    if (!this.connection.isConnected()) {
      return QmlDebugConnectionState.NotConnected;
    }
    if (this.connection.serviceVersion(this.name) !== -1) {
      return QmlDebugConnectionState.Enabled;
    }
    return QmlDebugConnectionState.Unavailable;
  }
  async sendMessage(message: Packet) {
    if (this.getState() !== QmlDebugConnectionState.Enabled) {
      return;
    }
    await this.connection.sendMessage(this.name, message);
  }
}

interface DebugContextInfo {
  line: number;
  file: string;
  function: string;
  category?: string;
  timestamp: bigint;
}

export interface IMessageType {
  type: number;
  message: string;
  info: DebugContextInfo;
}

export class DebugMessageClient
  extends QmlDebugClient
  implements IQmlDebugClient
{
  // signals:
  private readonly _newState =
    new vscode.EventEmitter<QmlDebugConnectionState>();
  private readonly _message = new vscode.EventEmitter<IMessageType>();

  constructor(connection: QmlDebugConnection) {
    super('DebugMessages', connection);
  }
  get newState() {
    return this._newState.event;
  }
  get message() {
    return this._message.event;
  }
  override messageReceived(ds: Packet): void {
    const command = ds.readStringUTF8();
    if (command !== 'MESSAGE') {
      return;
    }
    const type = ds.readInt32BE();
    const debugMessage = ds.readStringUTF8();
    const file = ds.readStringUTF8();
    const line = ds.readInt32BE();
    const functionName = ds.readStringUTF8();
    const info: DebugContextInfo = {
      line: line,
      file: file,
      function: functionName,
      timestamp: BigInt(-1)
    };
    if (!ds.atEnd()) {
      info.category = ds.readStringUTF8();
      if (!ds.atEnd()) {
        info.timestamp = ds.readInt64BE();
      }
    }
    this._message.fire({
      type: type,
      message: debugMessage,
      info: info
    });
  }
  override stateChanged(_state: QmlDebugConnectionState) {
    void this;
    logger.info('DebugMessages: stateChanged:' + _state);
  }
}
