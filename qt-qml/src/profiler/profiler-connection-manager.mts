// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  QmlDebugConnection,
  QmlDebugConnectionManager
} from '@debug/debug-connection.mjs';
import { QmlProfilerClient } from './profiler-client.mjs';
import { QmlTraceWriter } from './profiler-trace-writer.mjs';
import { createLogger } from 'qt-lib';

const logger = createLogger('qml-profiler-manager');

/**
 * Manages the lifecycle of a QML Profiler debug connection.
 *
 * Responsibility:
 *  - Creates the QmlProfilerClient when the connection is established
 *  - Starts and stops recording on demand
 *  - Writes the collected trace data to a .qtd file when recording stops
 *
 * Maps to QmlProfilerClientManager in Qt Creator.
 */
export class QmlProfilerConnectionManager extends QmlDebugConnectionManager {
  private _profilerClient: QmlProfilerClient | undefined;
  private readonly _traceWriter = new QmlTraceWriter();

  // Signals
  private readonly _onRecordingStateChanged =
    new vscode.EventEmitter<boolean>();
  private readonly _onRecordingCompleted = new vscode.EventEmitter<void>();
  private readonly _onServiceUnavailable = new vscode.EventEmitter<void>();

  constructor() {
    super();
    logger.info('QmlProfilerConnectionManager created');
  }

  // ─── events ──────────────────────────────────────────────────────────────

  get onRecordingStateChanged() {
    return this._onRecordingStateChanged.event;
  }

  /** Fired once the Complete message arrives and the trace file has been written. */
  get onRecordingCompleted() {
    return this._onRecordingCompleted.event;
  }

  get onServiceUnavailable() {
    return this._onServiceUnavailable.event;
  }

  // ─── recording control ───────────────────────────────────────────────────

  get isRecording(): boolean {
    return this._profilerClient?.isRecording ?? false;
  }

  startRecording() {
    logger.info('Starting recording');
    this._traceWriter.reset();
    this._profilerClient?.setRecording(true);
  }

  stopRecording() {
    logger.info('Stopping recording');
    this._profilerClient?.setRecording(false);
  }

  // ─── connection lifecycle ────────────────────────────────────────────────

  /**
   * Override to create the profiler client after the connection is established.
   * Maps to QmlProfilerClientManager::createClients()
   */
  override createConnection() {
    logger.info('Creating connection and profiler client');
    super.createConnection();
    if (this.connection) {
      this.createProfilerClient(this.connection);
    }
  }

  private createProfilerClient(connection: QmlDebugConnection) {
    logger.info('Creating QmlProfilerClient');
    this._profilerClient = new QmlProfilerClient(connection);

    // Forward recording state changes
    this._profilerClient.onRecordingChanged((recording) => {
      logger.info('Recording changed:', String(recording));
      this._onRecordingStateChanged.fire(recording);
    });

    // Accumulate events
    this._profilerClient.onEvent((event) => {
      this._traceWriter.feed(event);
    });

    // When trace starts, notify
    this._profilerClient.onTraceStarted(({ timestamp, engineIds }) => {
      logger.info(
        `Trace started at ${String(timestamp)}, engines: [${engineIds.join(', ')}]`
      );
    });

    // When trace ends per-engine (may be called multiple times)
    this._profilerClient.onTraceFinished(({ timestamp, engineIds }) => {
      logger.info(
        `Trace finished at ${String(timestamp)}, engines: [${engineIds.join(', ')}]`
      );
    });

    // Complete: all data received – fire the completed event
    this._profilerClient.onComplete((maximumTime) => {
      logger.info(`Trace complete, maximumTime=${String(maximumTime)}`);
      this._traceWriter.onCompleted(maximumTime);
      this._onRecordingCompleted.fire();
    });

    // Service unavailable
    this._profilerClient.onServiceUnavailable(() => {
      logger.warn('QML Profiler service unavailable');
      this._onServiceUnavailable.fire();
    });

    // When connection is established, fire connectionOpened
    connection.onConnected(() => {
      logger.info('QML Profiler connection established');
      this._connectionOpened.fire();
    });

    logger.info('QmlProfilerClient created and connected');
  }

  // ─── trace data ──────────────────────────────────────────────────────────

  /**
   * Write the accumulated trace to a .qtd file.
   * Call this after onRecordingCompleted has fired.
   */
  writeTrace(filePath: string) {
    logger.info(`Writing trace to: ${filePath}`);
    this._traceWriter.writeToFile(filePath);
  }

  get hasTraceData(): boolean {
    return this._traceWriter.hasData;
  }

  // ─── dispose ─────────────────────────────────────────────────────────────

  override dispose() {
    logger.info('Disposing QmlProfilerConnectionManager');
    super.dispose();

    this._profilerClient?.dispose();
    this._profilerClient = undefined;

    this._onRecordingStateChanged.dispose();
    this._onRecordingCompleted.dispose();
    this._onServiceUnavailable.dispose();
  }
}
