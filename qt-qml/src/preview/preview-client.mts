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
import { Timer } from '@debug/timer.js';
import {
  InputEventType,
  ProfileEvent,
  ProfileEventType,
  ProfileFeature,
  ProfileMessage,
  QmlProfilerClient
} from '@/profiler/profiler-client.mjs';
import {
  QmlPreviewEventReplayClient,
  RecordedInputEvent
} from '@preview/preview-event-replay-client.mjs';
import { createLogger } from 'qt-lib';

const logger = createLogger('qml-preview-client');

/**
 * QML Preview protocol commands
 * Maps to QmlPreview::QmlPreviewClient::Command from Qt Creator
 */
export enum QmlPreviewCommand {
  File = 0,
  Load = 1,
  Request = 2,
  Error = 3,
  // Deprecated. Qt 6.12+ ignores it when hot reload (in-place updates)
  // is active.
  Rerun = 4,
  Directory = 5,
  ClearCache = 6,
  Zoom = 7,
  Fps = 8,
  AnimationSpeed = 9,
  Configuration = 10,
  Confirmation = 11,
  HotReloadFailure = 12
}

/**
 * QML Preview settings negotiated with the debug service
 * Maps to QmlPreview::QmlPreviewClient::Settings from Qt Creator
 */
export interface QmlPreviewSettings {
  enableInPlaceUpdates: boolean;
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
  private readonly _confirmationReported =
    new vscode.EventEmitter<QmlPreviewSettings>();
  private readonly _hotReloadFailureReported =
    new vscode.EventEmitter<string>();

  private readonly _requestInPlaceUpdates: boolean;
  private _confirmedSettings: QmlPreviewSettings | undefined;

  // Event replay infrastructure (Qt 6.12+). Created lazily when the
  // service confirms our configuration, like Qt Creator's
  // QmlPreviewClient::configureEventReplay().
  private _recordClient: QmlProfilerClient | undefined;
  private _recordSubscription: vscode.Disposable | undefined;
  private _replayClient: QmlPreviewEventReplayClient | undefined;
  private _replayTimer: Timer | undefined;
  private _events: RecordedInputEvent[] = [];
  private _numExpectedEvents = 0;
  // The animation speed chosen by the user. The replay temporarily speeds
  // animations up and returns to this value afterwards.
  private _animationSpeed = 1;

  constructor(connection: QmlDebugConnection, requestInPlaceUpdates = true) {
    super('QmlPreview', connection);
    this._requestInPlaceUpdates = requestInPlaceUpdates;
    logger.info(
      'QmlPreviewClient created',
      `(in-place updates ${requestInPlaceUpdates ? 'requested' : 'not requested'})`
    );
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

  get onConfirmationReported() {
    return this._confirmationReported.event;
  }

  get onHotReloadFailureReported() {
    return this._hotReloadFailureReported.event;
  }

  /**
   * The settings confirmed by the debug service, or undefined if the
   * service has not confirmed anything (yet). Qt versions without hot
   * reload support never send a confirmation.
   */
  get confirmedSettings() {
    return this._confirmedSettings;
  }

  /**
   * Input events recorded since the last replay (or seeded via
   * setRecordedEvents). Used to preserve the events across a preview
   * restart, like QmlPreviewPlugin::events() in Qt Creator.
   */
  get recordedEvents(): RecordedInputEvent[] {
    return [...this._events];
  }

  /**
   * Seed recorded input events, e.g. the ones preserved from the session
   * that ended with a hot reload failure. They are replayed as soon as the
   * service confirms the configuration.
   * Maps to QmlPreview::QmlPreviewClient::setEvents() from Qt Creator.
   */
  setRecordedEvents(events: RecordedInputEvent[]) {
    this._events = [...events];
  }

  /**
   * Load a QML file URL, replaying recorded input events afterwards to
   * restore the UI state when possible.
   * Maps to QmlPreview::QmlPreviewClient::loadUrl()
   */
  loadUrl(url: string) {
    if (
      this._events.length > 0 &&
      this._replayClient?.getState() === QmlDebugConnectionState.Enabled
    ) {
      this.replayEventsForUrl(url);
      return;
    }
    if (this._replayClient) {
      // Recording is active but the events cannot be replayed. Drop them so
      // they don't pile up and don't get replayed out of context later.
      this._events = [];
    }
    // Otherwise keep the events: they can only be seeded ones, waiting for
    // the configuration to be confirmed after a restart.
    this.doLoad(url);
  }

  /**
   * Send the Load command for the given URL. An undefined URL asks the
   * service to reload the last loaded URL.
   * Maps to QmlPreview::QmlPreviewClient::doLoad()
   *
   * Note: Qt serializes QUrl as QByteArray (via url.toEncoded()), NOT QString!
   * See Qt's qurl.cpp: operator<<(QDataStream &out, const QUrl &url)
   * Also, local file paths must be converted to file:// URL format.
   */
  private doLoad(url?: string) {
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.Load);

    if (url === undefined) {
      logger.info('Sending Load command for the last loaded URL');
      // An empty QByteArray deserializes into an empty QUrl.
      packet.writeUInt32BE(0);
      void this.sendMessage(packet);
      return;
    }

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
   * Ask the debug service to enable hot reload (in-place updates).
   * Maps to QmlPreview::QmlPreviewClient::announceConfiguration()
   *
   * We always request in-place updates but the service has to confirm them
   * with a Confirmation message. This allows the service to refuse if it
   * does not support them: Qt versions before 6.12 reply with an
   * "Invalid command: 10" error instead.
   */
  announceConfiguration() {
    logger.info('Sending Configuration command (requesting in-place updates)');
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.Configuration);
    packet.writeBoolean(true);
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
   * The animation speed chosen by the user (1 is normal speed).
   */
  get animationSpeed() {
    return this._animationSpeed;
  }

  /**
   * Set animation speed factor
   * Maps to QmlPreview::QmlPreviewClient::setAnimationSpeed()
   */
  setAnimationSpeed(factor: number) {
    this._animationSpeed = factor;
    this.sendAnimationSpeed(factor);
  }

  /**
   * Remember an animation speed chosen in a previous session, without
   * sending it. It is applied once the service is ready, see
   * applyAnimationSpeed().
   */
  presetAnimationSpeed(factor: number) {
    this._animationSpeed = factor;
  }

  /**
   * Send the chosen animation speed if it differs from the default, e.g.
   * to keep the speed across a restart of the preview application.
   */
  private applyAnimationSpeed() {
    if (this._animationSpeed !== 1) {
      this.sendAnimationSpeed(this._animationSpeed);
    }
  }

  /**
   * QDataStream serializes float with double precision (big-endian) for
   * the stream versions negotiated by the debug connection.
   */
  private sendAnimationSpeed(factor: number) {
    logger.info('Sending AnimationSpeed command:', String(factor));
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.AnimationSpeed);
    packet.writeDoubleBE(factor);
    void this.sendMessage(packet);
  }

  /**
   * Configure the event replay infrastructure. Called when the debug
   * service confirms the requested configuration (Qt 6.12+).
   * Maps to QmlPreview::QmlPreviewClient::configureEventReplay()
   *
   * Input events are recorded through the QML Profiler service and can be
   * re-injected through the EventReplay service to restore the UI state
   * after a reload or an application restart.
   */
  private configureEventReplay() {
    if (!this._recordClient) {
      this._recordClient = new QmlProfilerClient(this.connection);
      this._recordClient.requestedFeatures =
        BigInt(1) << BigInt(ProfileFeature.InputEvents);
      this._recordClient.flushInterval = 1;
      this._recordSubscription = this._recordClient.onEvent((event) => {
        this.recordInputEvent(event);
      });
      this._recordClient.setRecording(true);

      this._replayClient = new QmlPreviewEventReplayClient(this.connection);

      this._replayTimer = new Timer(100);
      this._replayTimer.onTimeout(() => {
        // Wait until all replayed events have been re-recorded, then let
        // the animations run at normal speed again.
        if (this._events.length < this._numExpectedEvents) {
          return;
        }
        this.sendAnimationSpeed(this._animationSpeed);
        this._replayTimer?.stop();
      });
    }

    // We want to start the replay as soon as possible after the
    // configuration is confirmed, e.g. to restore the UI state after a
    // restart caused by a hot reload failure.
    if (
      this._events.length > 0 &&
      this._replayClient?.getState() === QmlDebugConnectionState.Enabled
    ) {
      this.replayEventsForUrl(undefined);
    }
  }

  /**
   * Reload the given URL (or the last loaded one) and replay the recorded
   * input events to restore the UI state. Animations are sped up during
   * the replay so the UI settles immediately.
   * Maps to QmlPreview::QmlPreviewClient::replayEventsForUrl()
   */
  private replayEventsForUrl(url?: string) {
    const recorded = this._events;
    this._events = [];
    this._numExpectedEvents = recorded.length;
    logger.info(
      'Replaying',
      String(recorded.length),
      'recorded input events for URL:',
      `"${url ?? '<last loaded>'}"`
    );
    this.sendAnimationSpeed(1000);
    this.doLoad(url);
    for (const event of recorded) {
      this._replayClient?.sendEvent(event);
    }
    this._replayTimer?.start();
  }

  /**
   * Record an input event reported by the QML Profiler service.
   * Maps to QmlPreview::QmlPreviewClient::appendEvent()
   */
  private recordInputEvent(event: ProfileEvent) {
    if (event.message !== ProfileMessage.Event) {
      return;
    }
    const subtype = event.subtype as ProfileEventType;
    if (
      subtype !== ProfileEventType.Mouse &&
      subtype !== ProfileEventType.Key
    ) {
      return;
    }
    const fallbackInputType =
      subtype === ProfileEventType.Key
        ? InputEventType.InputKeyUnknown
        : InputEventType.InputMouseUnknown;
    this._events.push({
      // Compress the time stamps so that the events are replayed in quick
      // succession.
      timestamp: BigInt(this._events.length),
      detailType: subtype,
      inputType: Number(event.numbers[0] ?? fallbackInputType),
      a: Number(event.numbers[1] ?? -1),
      b: Number(event.numbers[2] ?? -1)
    });
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
      case QmlPreviewCommand.Confirmation: {
        const settings: QmlPreviewSettings = {
          enableInPlaceUpdates: packet.readInt8() !== 0
        };
        logger.info(
          '<=== Confirmation received, in-place updates:',
          settings.enableInPlaceUpdates ? 'enabled' : 'disabled'
        );
        this._confirmedSettings = settings;
        // Before the replay, which speeds animations up temporarily.
        this.applyAnimationSpeed();
        this.configureEventReplay();
        this._confirmationReported.fire(settings);
        break;
      }
      case QmlPreviewCommand.HotReloadFailure: {
        const reason = packet.readStringUTF16LE();
        logger.info('<=== Hot reload failure received:', `"${reason}"`);
        this._hotReloadFailureReported.fire(reason);
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
    } else if (state === QmlDebugConnectionState.Enabled) {
      if (this._requestInPlaceUpdates) {
        this.announceConfiguration();
      } else {
        this.applyAnimationSpeed();
      }
    }
  }

  dispose() {
    logger.info('Disposing QmlPreviewClient');
    this._replayTimer?.dispose();
    this._recordSubscription?.dispose();
    if (this._recordClient) {
      // Best effort: the message is dropped if the connection is gone.
      this._recordClient.setRecording(false);
      this._recordClient.dispose();
    }
    this._pathRequested.dispose();
    this._errorReported.dispose();
    this._fpsReported.dispose();
    this._debugServiceUnavailable.dispose();
    this._confirmationReported.dispose();
    this._hotReloadFailureReported.dispose();
  }
}
