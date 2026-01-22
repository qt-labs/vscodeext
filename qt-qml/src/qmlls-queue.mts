// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { Mutex } from 'async-mutex';
import { createLogger } from 'qt-lib';

const logger = createLogger('qmlls-queue');

export enum QmllsOperationType {
  Install = 'install',
  Start = 'start',
  Stop = 'stop',
  Restart = 'restart',
  Update = 'update'
}

/**
 * A mutex-based queue that serializes QMLLS operations to prevent race conditions.
 * Operations like install, update, start, stop, and restart are executed
 * one at a time using async-mutex.
 */
export class QmllsOperationQueue {
  private readonly _mutex = new Mutex();
  private _currentOperation: QmllsOperationType | undefined;

  /**
   * Enqueue an operation to be executed.
   * Operations are serialized using a mutex to prevent race conditions.
   */
  async enqueue<T>(
    type: QmllsOperationType,
    operation: () => Promise<T> | T
  ): Promise<T> {
    logger.info(`Enqueueing ${type} operation`);

    return this._mutex.runExclusive(async () => {
      this._currentOperation = type;
      logger.info(`Processing ${type} operation`);

      try {
        const result = await operation();
        logger.info(`Completed ${type} operation`);
        return result;
      } catch (error) {
        logger.error(`Failed ${type} operation: ${String(error)}`);
        throw error;
      } finally {
        this._currentOperation = undefined;
      }
    });
  }

  /**
   * Check if the queue is currently processing an operation.
   */
  get isProcessing(): boolean {
    return this._mutex.isLocked();
  }

  /**
   * Get the current operation type being processed.
   */
  get currentOperation(): QmllsOperationType | undefined {
    return this._currentOperation;
  }
}
