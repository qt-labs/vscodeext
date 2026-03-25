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

const logger = createLogger('qml-profiler-client');

// ─────────────────────────────────── enums ───────────────────────────────────
// From qmlprofilereventtypes.h

export const enum ProfileMessage {
  Event = 0,
  RangeStart = 1,
  RangeData = 2,
  RangeLocation = 3,
  RangeEnd = 4,
  Complete = 5,
  PixmapCacheEvent = 6,
  SceneGraphFrame = 7,
  MemoryAllocation = 8,
  DebugMessage = 9,
  Quick3DEvent = 10
}

export const enum ProfileEventType {
  FramePaint = 0,
  Mouse = 1,
  Key = 2,
  AnimationFrame = 3,
  EndTrace = 4,
  StartTrace = 5
}

export const enum ProfileRangeType {
  Painting = 0,
  Compiling = 1,
  Creating = 2,
  Binding = 3,
  HandlingSignal = 4,
  Javascript = 5
}

/** All non-undefined feature bits from ProfileFeature enum */
export const ALL_PROFILE_FEATURES: bigint =
  (BigInt(1) << BigInt(13)) - BigInt(1);

// ──────────────────────────────── interfaces ─────────────────────────────────

/** A decoded profiler event as received on the wire */
export interface ProfileEvent {
  timestamp: bigint;
  message: ProfileMessage;
  subtype: number; // EventType, RangeType, or SceneGraphFrameType etc.
  /** Optional extra numbers (engine IDs, animation params, memory delta …) */
  numbers: bigint[];
  /** Optional string payload (file name, data, category …) */
  str?: string;
  /** Additional location data from RangeLocation messages */
  location?: { filename: string; line: number; column: number };
  /** Server-assigned type ID (for deduplication when supportsTypeIds=true) */
  serverTypeId?: bigint;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * QML Profiler Trace Client
 *
 * TypeScript port of Qt Creator's QmlProfilerTraceClient.
 * Service name: "CanvasFrameRate"
 *
 * Wire protocol:
 *   Outbound: bool enabled | int32 engineId | [uint64 features | uint32 flushInterval | bool supportsTypeIds]
 *   Inbound:  int64 timestamp | int32 message | int32 subtype | <extra-data>
 */
export class QmlProfilerClient
  extends QmlDebugClient
  implements IQmlDebugClient
{
  private _recording = false;
  private _requestedFeatures: bigint = ALL_PROFILE_FEATURES;
  private _flushInterval = 0;

  /** Fired when the first StartTrace event arrives (recording truly began). */
  private readonly _onTraceStarted = new vscode.EventEmitter<{
    timestamp: bigint;
    engineIds: number[];
  }>();
  /** Fired when the EndTrace event arrives (per-engine). */
  private readonly _onTraceFinished = new vscode.EventEmitter<{
    timestamp: bigint;
    engineIds: number[];
  }>();
  /** Fired when the Complete message arrives (all data sent). */
  private readonly _onComplete = new vscode.EventEmitter<bigint>(); // maximumTime
  /** Fired for every decoded event (for callers that want to buffer them). */
  private readonly _onEvent = new vscode.EventEmitter<ProfileEvent>();
  /** Fired when recording state changes. */
  private readonly _onRecordingChanged = new vscode.EventEmitter<boolean>();
  /** Fired when the service becomes unavailable. */
  private readonly _onServiceUnavailable = new vscode.EventEmitter<void>();

  constructor(connection: QmlDebugConnection) {
    super('CanvasFrameRate', connection);
    logger.info('QmlProfilerClient created');
  }

  // ─── public accessors ────────────────────────────────────────────────────
  get onTraceStarted() {
    return this._onTraceStarted.event;
  }
  get onTraceFinished() {
    return this._onTraceFinished.event;
  }
  get onComplete() {
    return this._onComplete.event;
  }
  get onEvent() {
    return this._onEvent.event;
  }
  get onRecordingChanged() {
    return this._onRecordingChanged.event;
  }
  get onServiceUnavailable() {
    return this._onServiceUnavailable.event;
  }

  get isRecording() {
    return this._recording;
  }

  set requestedFeatures(features: bigint) {
    this._requestedFeatures = features;
  }

  set flushInterval(ms: number) {
    this._flushInterval = ms;
  }

  // ─── recording control ───────────────────────────────────────────────────

  /**
   * Start or stop recording.
   * Sends the recording status message to the server.
   * Maps to QmlProfilerTraceClient::setRecording().
   */
  setRecording(recording: boolean) {
    if (recording === this._recording) {
      return;
    }
    this._recording = recording;
    this.sendRecordingStatus();
    this._onRecordingChanged.fire(recording);
  }

  /**
   * Send the current recording status to a specific engine.
   * Called automatically on connection and when setRecording() is called.
   * Maps to QmlProfilerTraceClientPrivate::sendRecordingStatus().
   */
  sendRecordingStatus(engineId = -1) {
    logger.info(
      `Sending recording status: recording=${String(this._recording)}, engineId=${String(engineId)}`
    );
    const packet = new Packet();
    packet.writeBoolean(this._recording);
    packet.writeInt32BE(engineId);
    if (this._recording) {
      packet.writeInt64BE(this._requestedFeatures);
      packet.writeUInt32BE(this._flushInterval);
      packet.writeBoolean(true); // supportsTypeIds
    }
    void this.sendMessage(packet);
  }

  // ─── incoming message decoding ───────────────────────────────────────────

  /**
   * Decode an incoming profiler event packet.
   * Maps to QmlProfilerTraceClient::messageReceived() / operator>>(QmlTypedEvent).
   *
   * Packet layout (QDataStream big-endian):
   *   qint64  timestamp
   *   qint32  messageType  (ProfileMessage enum)
   *   qint32  subtype      (EventType / RangeType / SceneGraphFrameType / …)
   *   <optional extra data depending on messageType>
   */
  override messageReceived(packet: Packet) {
    if (packet.atEnd()) {
      return;
    }

    const timestamp = packet.readInt64BE();
    if (packet.atEnd()) {
      return;
    }
    const messageType = packet.readInt32BE() as ProfileMessage;
    let subtype = -1;
    if (!packet.atEnd()) {
      subtype = packet.readInt32BE();
    }
    const eventSubtype = subtype as ProfileEventType;

    const event: ProfileEvent = {
      timestamp: timestamp > BigInt(0) ? timestamp : BigInt(0),
      message: messageType,
      subtype,
      numbers: []
    };

    switch (messageType) {
      case ProfileMessage.Complete: {
        logger.info('Received Complete, maximumTime =', String(timestamp));
        this._onComplete.fire(event.timestamp);
        this._onEvent.fire(event);
        return;
      }

      case ProfileMessage.Event: {
        // StartTrace / EndTrace carry a list of int32 engine IDs
        if (
          eventSubtype === ProfileEventType.StartTrace ||
          eventSubtype === ProfileEventType.EndTrace
        ) {
          const engineIds: number[] = [];
          while (!packet.atEnd()) {
            const id = packet.readInt32BE();
            engineIds.push(id);
            event.numbers.push(BigInt(id));
          }
          if (eventSubtype === ProfileEventType.StartTrace) {
            logger.info(
              'Received StartTrace, engines:',
              engineIds.join(','),
              'ts:',
              String(timestamp)
            );
            this._onTraceStarted.fire({ timestamp, engineIds });
          } else {
            logger.info(
              'Received EndTrace, engines:',
              engineIds.join(','),
              'ts:',
              String(timestamp)
            );
            this._onTraceFinished.fire({ timestamp, engineIds });
          }
        } else if (eventSubtype === ProfileEventType.AnimationFrame) {
          // frameRate, animationCount, threadId
          if (!packet.atEnd()) {
            event.numbers.push(BigInt(packet.readInt32BE()));
          }
          if (!packet.atEnd()) {
            event.numbers.push(BigInt(packet.readInt32BE()));
          }
          if (!packet.atEnd()) {
            event.numbers.push(BigInt(packet.readInt32BE()));
          }
        } else {
          // Mouse / Key events
          while (!packet.atEnd()) {
            event.numbers.push(BigInt(packet.readInt32BE()));
          }
        }
        break;
      }

      case ProfileMessage.RangeStart: {
        if (!packet.atEnd()) {
          event.serverTypeId = packet.readInt64BE();
        }
        break;
      }

      case ProfileMessage.RangeData: {
        if (!packet.atEnd()) {
          event.str = this.readQString(packet);
        }
        if (!packet.atEnd()) {
          event.serverTypeId = packet.readInt64BE();
        }
        break;
      }

      case ProfileMessage.RangeLocation: {
        const filename = this.readQString(packet);
        let line = 0;
        let column = 0;
        if (!packet.atEnd()) {
          line = packet.readInt32BE();
        }
        if (!packet.atEnd()) {
          column = packet.readInt32BE();
        }
        event.location = { filename, line, column };
        if (!packet.atEnd()) {
          event.serverTypeId = packet.readInt64BE();
        }
        break;
      }

      case ProfileMessage.RangeEnd: {
        // No extra data
        break;
      }

      case ProfileMessage.PixmapCacheEvent: {
        if (!packet.atEnd()) {
          event.str = this.readQString(packet); // filename
        }
        while (!packet.atEnd()) {
          event.numbers.push(BigInt(packet.readInt32BE()));
        }
        break;
      }

      case ProfileMessage.MemoryAllocation: {
        if (!packet.atEnd()) {
          event.numbers.push(packet.readInt64BE());
        }
        break;
      }

      case ProfileMessage.SceneGraphFrame: {
        while (!packet.atEnd()) {
          event.numbers.push(packet.readInt64BE());
        }
        break;
      }

      case ProfileMessage.DebugMessage: {
        // type(int32) text(QString) category(QString) timestamp(int64)
        // already consumed messageType; subtype is the QtMsgType
        if (!packet.atEnd()) {
          event.str = this.readQString(packet); // text
        }
        break;
      }

      case ProfileMessage.Quick3DEvent: {
        while (!packet.atEnd()) {
          event.numbers.push(packet.readInt64BE());
        }
        break;
      }

      default:
        break;
    }

    this._onEvent.fire(event);
  }

  /**
   * Handle state changes for the profiler service.
   * When the service becomes available after connection, send our recording state.
   */
  override stateChanged(state: QmlDebugConnectionState) {
    logger.info(
      'QmlProfilerClient state changed:',
      QmlDebugConnectionState[state]
    );
    if (state === QmlDebugConnectionState.Enabled) {
      // Send current recording status when service becomes available
      this.sendRecordingStatus();
    } else if (state === QmlDebugConnectionState.Unavailable) {
      this._onServiceUnavailable.fire();
    }
  }

  dispose() {
    logger.info('Disposing QmlProfilerClient');
    this._onTraceStarted.dispose();
    this._onTraceFinished.dispose();
    this._onComplete.dispose();
    this._onEvent.dispose();
    this._onRecordingChanged.dispose();
    this._onServiceUnavailable.dispose();
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  /**
   * Read a Qt QString from the packet.
   * Qt encodes QString in QDataStream as:  uint32 byteLength | UTF-16BE bytes
   * This matches the existing readStringUTF16LE() method in DataStream
   * (which reads big-endian length then swaps bytes to get the string).
   */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readQString(packet: Packet): string {
    return packet.readStringUTF16LE();
  }
}
