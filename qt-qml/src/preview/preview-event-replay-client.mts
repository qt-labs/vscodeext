// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  QmlDebugClient,
  IQmlDebugClient,
  QmlDebugConnection,
  QmlDebugConnectionState
} from '@debug/debug-connection.mjs';
import { Packet } from '@debug/packet.mjs';
import { ProfileMessage } from '@/profiler/profiler-client.mjs';
import { createLogger } from 'qt-lib';

const logger = createLogger('qml-preview-event-replay');

/**
 * A recorded input event, as captured from the QML Profiler service
 * (feature ProfileInputEvents) and replayable through the EventReplay
 * service.
 *
 * Maps to QmlDebug::QmlEvent with a QmlEventType of
 * (Event, Mouse|Key) in Qt Creator.
 */
export interface RecordedInputEvent {
  timestamp: bigint;
  /** ProfileEventType.Mouse or ProfileEventType.Key */
  detailType: number;
  /** InputEventType (key/mouse press, release, move, wheel, ...) */
  inputType: number;
  a: number;
  b: number;
}

/**
 * Quick Event Replay Client
 * TypeScript implementation of QmlDebug::QuickEventReplayClient from
 * Qt Creator. Sends recorded input events to the "EventReplay" debug
 * service (available since Qt 6.12) which re-injects them into the
 * application to restore the UI state.
 */
export class QmlPreviewEventReplayClient
  extends QmlDebugClient
  implements IQmlDebugClient
{
  constructor(connection: QmlDebugConnection) {
    super('EventReplay', connection);
    logger.info('QmlPreviewEventReplayClient created');
  }

  /**
   * Send one recorded input event to the application.
   * Maps to QmlDebug::QuickEventReplayClient::sendEvent()
   *
   * Wire format (QDataStream big-endian):
   *   qint64 timestamp | qint32 messageType (Event) | qint32 detailType |
   *   qint32 inputType | qint32 a | qint32 b
   */
  sendEvent(event: RecordedInputEvent) {
    const packet = new Packet();
    packet.writeInt64BE(event.timestamp);
    packet.writeInt32BE(ProfileMessage.Event);
    packet.writeInt32BE(event.detailType);
    packet.writeInt32BE(event.inputType);
    packet.writeInt32BE(event.a);
    packet.writeInt32BE(event.b);
    void this.sendMessage(packet);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override messageReceived(_packet: Packet): void {
    // The EventReplay service does not send messages back.
    void this;
  }

  override stateChanged(state: QmlDebugConnectionState) {
    void this;
    logger.info('EventReplay state changed:', QmlDebugConnectionState[state]);
  }
}
