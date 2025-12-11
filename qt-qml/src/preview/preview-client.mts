// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  QmlDebugClient,
  IQmlDebugClient,
  QmlDebugConnection,
  QmlDebugConnectionState
} from '@debug/debug-connection.mjs';
import { Packet } from '@debug/packet.mjs';
import { createLogger } from 'qt-lib';

const logger = createLogger('qml-preview-client');

/**
 * QML Preview protocol commands
 * Maps to QmlPreview::QmlPreviewClient::Command from Qt Creator
 */
enum QmlPreviewCommand {
  File,
  Load,
  Request,
  Error,
  Rerun,
  Directory,
  ClearCache,
  Zoom,
  Fps,
  AnimationSpeed
}

/**
 * FPS information structure
 * Maps to QmlPreview::QmlPreviewClient::FpsInfo from Qt Creator
 */
export interface FpsInfo {
  numSyncs: number;
  minSync: number;
  maxSync: number;
  totalSync: number;
  numRenders: number;
  minRender: number;
  maxRender: number;
  totalRender: number;
}

/**
 * QML Preview Client
 * TypeScript implementation of QmlPreview::QmlPreviewClient from Qt Creator
 * Implements the QML Preview debug protocol for live preview functionality
 *
 * Signal/Slot pattern using VSCode EventEmitter:
 * - Qt signals → private EventEmitter fields
 * - emit signal() → _emitter.fire()
 * - connect(signal, slot) → emitter.event property
 */
export class QmlPreviewClient
  extends QmlDebugClient
  implements IQmlDebugClient
{
  private readonly _pathRequested = new vscode.EventEmitter<string>();
  private readonly _errorReported = new vscode.EventEmitter<string>();
  private readonly _fpsReported = new vscode.EventEmitter<FpsInfo>();
  private readonly _debugServiceUnavailable = new vscode.EventEmitter<void>();

  constructor(connection: QmlDebugConnection) {
    super('QmlPreview', connection);
    logger.info('QmlPreviewClient created');
  }

  get onPathRequested() {
    return this._pathRequested.event;
  }

  get onErrorReported() {
    return this._errorReported.event;
  }

  get onFpsReported() {
    return this._fpsReported.event;
  }

  get onDebugServiceUnavailable() {
    return this._debugServiceUnavailable.event;
  }

  /**
   * Load a QML file URL
   * Maps to QmlPreview::QmlPreviewClient::loadUrl()
   *
   * Note: Qt serializes QUrl as QByteArray (via url.toEncoded()), NOT QString!
   * See Qt's qurl.cpp: operator<<(QDataStream &out, const QUrl &url)
   * Also, local file paths must be converted to file:// URL format.
   */
  loadUrl(url: string) {
    // Convert local file path to proper file:// URL format
    // Similar to Qt's QUrl::fromLocalFile()
    let fileUrl = url;
    if (!url.startsWith('file://') && !url.startsWith('qrc:')) {
      // Normalize path separators to forward slashes (Windows uses backslashes)
      const normalizedPath = url.replace(/\\/g, '/');
      // On Windows, paths look like "C:/path/file.qml" -> "file:///C:/path/file.qml"
      // On Unix, paths look like "/path/file.qml" -> "file:///path/file.qml"
      // So we always need file:/// prefix regardless of platform
      fileUrl = normalizedPath.startsWith('/')
        ? `file://${normalizedPath}` // Unix: already has leading slash
        : `file:///${normalizedPath}`; // Windows: need to add slash before drive letter
    }

    logger.info('Sending Load command for URL:', `"${fileUrl}"`);
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.Load);
    packet.writeStringUTF8(fileUrl);
    void this.sendMessage(packet);
  }

  /**
   * Rerun the QML application
   * Maps to QmlPreview::QmlPreviewClient::rerun()
   */
  rerun() {
    logger.info('Sending Rerun command');
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.Rerun);
    void this.sendMessage(packet);
  }

  /**
   * Announce a file to the preview client
   * Maps to QmlPreview::QmlPreviewClient::announceFile()
   */
  announceFile(path: string, contents: Buffer) {
    logger.info(
      'Sending File command:',
      `"${path}"`,
      'size:',
      String(contents.length)
    );
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.File);
    packet.writeStringUTF16(path);
    packet.writeUInt32BE(contents.length);
    packet.writeBuffer(contents);

    // Log packet details (similar to Qt Creator implementation)
    const pathLengthInBytes = Buffer.byteLength(path, 'utf16le');
    const totalSize = 1 + 4 + pathLengthInBytes + 4 + contents.length;
    logger.info('==> File packet total size:', String(totalSize), 'bytes');

    void this.sendMessage(packet);
  }

  /**
   * Announce a directory to the preview client
   * Maps to QmlPreview::QmlPreviewClient::announceDirectory()
   */
  announceDirectory(path: string, entries: string[]) {
    logger.info(
      'Sending Directory command:',
      `"${path}"`,
      'entries:',
      String(entries.length),
      '->',
      entries.join(', ')
    );
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.Directory);
    packet.writeStringUTF16(path);
    packet.writeArray(entries, (entry) => {
      packet.writeStringUTF16(entry);
    });
    void this.sendMessage(packet);
  }

  /**
   * Announce an error for a path
   * Maps to QmlPreview::QmlPreviewClient::announceError()
   */
  announceError(path: string) {
    logger.info('Sending Error command for path:', `"${path}"`);
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.Error);
    packet.writeStringUTF16(path);
    void this.sendMessage(packet);
  }

  /**
   * Clear the preview cache
   * Maps to QmlPreview::QmlPreviewClient::clearCache()
   */
  clearCache() {
    logger.info('Sending ClearCache command');
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.ClearCache);
    void this.sendMessage(packet);
  }

  /**
   * Set animation speed factor
   * Maps to QmlPreview::QmlPreviewClient::setAnimationSpeed()
   */
  setAnimationSpeed(factor: number) {
    logger.info('Sending AnimationSpeed command:', String(factor));
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.AnimationSpeed);
    packet.writeFloatLE(factor);
    void this.sendMessage(packet);
  }

  /**
   * Handle incoming messages from the QML Preview service
   * Overrides QmlDebugClient.messageReceived()
   * Maps to QmlPreview::QmlPreviewClient::messageReceived()
   */
  override messageReceived(packet: Packet) {
    const command = packet.readInt8() as QmlPreviewCommand;

    switch (command) {
      case QmlPreviewCommand.Request: {
        const path = packet.readStringUTF16LE();
        logger.info(
          '<=== Path requested from Qt:',
          `"${path}"`,
          'length:',
          String(path.length)
        );
        this._pathRequested.fire(path);
        break;
      }
      case QmlPreviewCommand.Error: {
        const error = packet.readStringUTF16LE();
        logger.info('<=== Error received from Qt:', `"${error}"`);
        this._errorReported.fire(error);
        break;
      }
      case QmlPreviewCommand.Fps: {
        const info: FpsInfo = {
          numSyncs: packet.readInt16BE(),
          minSync: packet.readInt16BE(),
          maxSync: packet.readInt16BE(),
          totalSync: packet.readInt16BE(),
          numRenders: packet.readInt16BE(),
          minRender: packet.readInt16BE(),
          maxRender: packet.readInt16BE(),
          totalRender: packet.readInt16BE()
        };
        this._fpsReported.fire(info);
        break;
      }
      default:
        logger.warn(
          '<=== Invalid command received:',
          String(command),
          'name:',
          QmlPreviewCommand[command]
        );
        break;
    }
  }

  /**
   * Handle state changes of the QML Preview service
   * Overrides QmlDebugClient.stateChanged()
   * Maps to QmlPreview::QmlPreviewClient::stateChanged()
   */
  override stateChanged(state: QmlDebugConnectionState) {
    logger.info('QmlPreview state changed:', QmlDebugConnectionState[state]);
    if (state === QmlDebugConnectionState.Unavailable) {
      this._debugServiceUnavailable.fire();
    }
  }

  dispose() {
    logger.info('Disposing QmlPreviewClient');
    this._pathRequested.dispose();
    this._errorReported.dispose();
    this._fpsReported.dispose();
    this._debugServiceUnavailable.dispose();
  }
}
