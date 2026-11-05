// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';

import { delay } from 'qt-lib';
import {
  QmlDebugConnection,
  QmlDebugConnectionState
} from '@debug/debug-connection.mjs';
import { Packet } from '@debug/packet.mjs';
import {
  QmlPreviewClient,
  QmlPreviewCommand,
  QmlPreviewSettings
} from '@/preview/preview-client.mjs';
import { RecordedInputEvent } from '@/preview/preview-event-replay-client.mjs';
import {
  InputEventType,
  ProfileEventType,
  ProfileMessage
} from '@/profiler/profiler-client.mjs';

interface SentMessage {
  name: string;
  packet: Packet;
}

/**
 * Test rig around QmlPreviewClient, mirroring Qt Creator's
 * QmlPreviewTestRig. The connection is not backed by a socket; it pretends
 * to be connected with all services enabled and captures every sent packet.
 */
class PreviewTestRig {
  readonly connection: QmlDebugConnection;
  readonly client: QmlPreviewClient;
  private readonly _messages: SentMessage[] = [];

  constructor(requestInPlaceUpdates = true) {
    this.connection = new QmlDebugConnection();
    sinon.stub(this.connection, 'isConnected').returns(true);
    sinon.stub(this.connection, 'serviceVersion').returns(1);
    sinon
      .stub(this.connection, 'sendMessage')
      .callsFake((name: string, message: Packet) => {
        this._messages.push({
          name,
          packet: new Packet(Buffer.from(message.data))
        });
        return Promise.resolve(true);
      });
    this.client = new QmlPreviewClient(this.connection, requestInPlaceUpdates);
  }

  get messageCount() {
    return this._messages.length;
  }

  nextMessage(expectedName: string): Packet {
    const message = this._messages.shift();
    expect(message, `expected a message for "${expectedName}"`).to.not.equal(
      undefined
    );
    expect(message?.name).to.equal(expectedName);
    if (!message) {
      throw new Error('No message available');
    }
    return message.packet;
  }

  /**
   * Make a service unavailable, as if the application did not offer it.
   */
  withoutService(unavailable: string) {
    (this.connection.serviceVersion as unknown as sinon.SinonStub).callsFake(
      (name: string) => (name === unavailable ? -1 : 1)
    );
  }

  /**
   * Simulate the service confirming the requested in-place updates
   * (Qt 6.12+ with hot reload).
   */
  confirmConfiguration(enableInPlaceUpdates = true) {
    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.Confirmation);
    packet.writeBoolean(enableInPlaceUpdates);
    this.client.messageReceived(packet);
  }

  /**
   * Simulate the QML Profiler service reporting a recorded input event,
   * as it does while the user interacts with the application.
   */
  feedInputEventBack(event: RecordedInputEvent) {
    const recordClient = this.connection.getClient('CanvasFrameRate');
    expect(recordClient).to.not.equal(undefined);
    const packet = new Packet();
    packet.writeInt64BE(event.timestamp);
    packet.writeInt32BE(ProfileMessage.Event);
    packet.writeInt32BE(event.detailType);
    packet.writeInt32BE(event.inputType);
    packet.writeInt32BE(event.a);
    packet.writeInt32BE(event.b);
    recordClient?.messageReceived(packet);
  }

  dispose() {
    this.client.dispose();
  }
}

function mouseClickEvents(): RecordedInputEvent[] {
  return [
    {
      timestamp: BigInt(0),
      detailType: ProfileEventType.Mouse,
      inputType: InputEventType.InputMouseMove,
      a: 12,
      b: 13
    },
    {
      timestamp: BigInt(1),
      detailType: ProfileEventType.Mouse,
      inputType: InputEventType.InputMousePress,
      a: 1,
      b: 1
    },
    {
      timestamp: BigInt(2),
      detailType: ProfileEventType.Mouse,
      inputType: InputEventType.InputMouseRelease,
      a: 1,
      b: 0
    }
  ];
}

function expectRecordingRequest(rig: PreviewTestRig) {
  const packet = rig.nextMessage('CanvasFrameRate');
  expect(packet.readInt8()).to.equal(1); // recording enabled
  expect(packet.readInt32BE()).to.equal(-1); // all engines
  expect(packet.readInt64BE()).to.equal(BigInt(1024)); // ProfileInputEvents
  expect(packet.readUInt32BE()).to.equal(1); // flush interval
  expect(packet.readInt8()).to.equal(1); // supports type IDs
}

function expectLoad(rig: PreviewTestRig, expectedUrl?: string) {
  const load = rig.nextMessage('QmlPreview');
  expect(load.readInt8()).to.equal(QmlPreviewCommand.Load);
  if (expectedUrl === undefined) {
    // An empty QByteArray, deserializing into an empty QUrl
    expect(load.readUInt32BE()).to.equal(0);
  } else {
    expect(load.readStringUTF8()).to.equal(expectedUrl);
  }
  expect(load.atEnd()).to.equal(true);
}

function expectAnimationSpeed(rig: PreviewTestRig, expectedFactor: number) {
  const packet = rig.nextMessage('QmlPreview');
  expect(packet.readInt8()).to.equal(QmlPreviewCommand.AnimationSpeed);
  expect(packet.readDoubleBE()).to.equal(expectedFactor);
  expect(packet.atEnd()).to.equal(true);
}

function expectReplaySequence(
  rig: PreviewTestRig,
  expectedEvents: RecordedInputEvent[],
  expectedUrl?: string
) {
  expectAnimationSpeed(rig, 1000);
  expectLoad(rig, expectedUrl);

  for (const expected of expectedEvents) {
    const packet = rig.nextMessage('EventReplay');
    expect(packet.readInt64BE()).to.equal(expected.timestamp);
    expect(packet.readInt32BE()).to.equal(ProfileMessage.Event);
    expect(packet.readInt32BE()).to.equal(expected.detailType);
    expect(packet.readInt32BE()).to.equal(expected.inputType);
    expect(packet.readInt32BE()).to.equal(expected.a);
    expect(packet.readInt32BE()).to.equal(expected.b);
  }
}

/**
 * Simulate the profiler service sending the replayed events back, which
 * makes the preview client finish the replay and reset the animation speed.
 */
async function expectReplayFinished(
  rig: PreviewTestRig,
  replayedEvents: RecordedInputEvent[]
) {
  for (const event of replayedEvents) {
    rig.feedInputEventBack(event);
  }
  await delay(300);
  expectAnimationSpeed(rig, 1);
  expect(rig.messageCount).to.equal(0);
}

describe('QmlPreviewClient', () => {
  let rig: PreviewTestRig;

  afterEach(() => {
    rig.dispose();
    sinon.restore();
  });

  it('sends the Load command for a URL', () => {
    rig = new PreviewTestRig();
    rig.client.loadUrl('/some/file.qml');

    expectLoad(rig, 'file:///some/file.qml');
    expect(rig.messageCount).to.equal(0);
  });

  it('sends the AnimationSpeed command', () => {
    rig = new PreviewTestRig();
    rig.client.setAnimationSpeed(1000);

    expectAnimationSpeed(rig, 1000);
    expect(rig.messageCount).to.equal(0);
  });

  it('requests in-place updates when the service becomes enabled', () => {
    rig = new PreviewTestRig();
    rig.client.stateChanged(QmlDebugConnectionState.Enabled);

    const packet = rig.nextMessage('QmlPreview');
    expect(packet.readInt8()).to.equal(QmlPreviewCommand.Configuration);
    expect(packet.readInt8()).to.equal(1);
    expect(packet.atEnd()).to.equal(true);
    expect(rig.messageCount).to.equal(0);
  });

  it('does not request in-place updates when hot reload is disabled', () => {
    // The classic preview is needed to show a single file in its own window.
    rig = new PreviewTestRig(false);
    rig.client.stateChanged(QmlDebugConnectionState.Enabled);

    expect(rig.messageCount).to.equal(0);
  });

  it('reports the confirmed settings and starts recording input events', () => {
    rig = new PreviewTestRig();
    const confirmations: QmlPreviewSettings[] = [];
    rig.client.onConfirmationReported((settings) => {
      confirmations.push(settings);
    });

    rig.confirmConfiguration();

    expect(confirmations).to.deep.equal([{ enableInPlaceUpdates: true }]);
    expect(rig.client.confirmedSettings).to.deep.equal({
      enableInPlaceUpdates: true
    });

    // The confirmation configures the event replay: the recording request
    // goes out through the QML Profiler service.
    expectRecordingRequest(rig);
    expect(rig.messageCount).to.equal(0);
  });

  it('starts recording input events when hot reload is unavailable', () => {
    rig = new PreviewTestRig();

    // The connection manager calls this when the service rejects the
    // Configuration command (Qt < 6.12, or QMLPREVIEW_HOTRELOAD=0).
    rig.client.configureEventReplay();

    expect(rig.client.confirmedSettings).to.equal(undefined);
    expectRecordingRequest(rig);
    expect(rig.messageCount).to.equal(0);
  });

  it('reports hot reload failures', () => {
    rig = new PreviewTestRig();
    const reasons: string[] = [];
    rig.client.onHotReloadFailureReported((reason) => {
      reasons.push(reason);
    });

    const packet = new Packet();
    packet.writeInt8(QmlPreviewCommand.HotReloadFailure);
    packet.writeStringUTF16('singletons cannot be reloaded');
    rig.client.messageReceived(packet);

    expect(reasons).to.deep.equal(['singletons cannot be reloaded']);
  });

  it('does not replay input events when loading a URL with hot reload', () => {
    rig = new PreviewTestRig();
    rig.confirmConfiguration();
    expectRecordingRequest(rig);

    // Simulate the user interacting with the application.
    const clickEvents = mouseClickEvents();
    for (const event of clickEvents) {
      rig.feedInputEventBack(event);
    }
    expect(rig.client.recordedEvents.length).to.equal(clickEvents.length);
    expect(rig.messageCount).to.equal(0);

    // The application keeps its state across a hot reload. Replaying the
    // events would duplicate the input, so they are dropped instead.
    rig.client.loadUrl('/some/file.qml');

    expectLoad(rig, 'file:///some/file.qml');
    expect(rig.messageCount).to.equal(0);
    expect(rig.client.recordedEvents.length).to.equal(0);
  });

  it('replays recorded input events when loading a URL without hot reload', async () => {
    rig = new PreviewTestRig();
    rig.client.configureEventReplay();
    expectRecordingRequest(rig);

    // Simulate the user interacting with the application.
    const clickEvents = mouseClickEvents();
    for (const event of clickEvents) {
      rig.feedInputEventBack(event);
    }
    expect(rig.messageCount).to.equal(0);

    // Without hot reload the load replaces the whole application, so the
    // events are replayed to restore the UI state.
    rig.client.loadUrl('/some/file.qml');

    expectReplaySequence(rig, clickEvents, 'file:///some/file.qml');
    expect(rig.messageCount).to.equal(0);
    await expectReplayFinished(rig, clickEvents);
  });

  it('drops recorded events on load if they cannot be replayed', () => {
    rig = new PreviewTestRig();
    rig.client.configureEventReplay();
    expectRecordingRequest(rig);
    for (const event of mouseClickEvents()) {
      rig.feedInputEventBack(event);
    }

    // The EventReplay service is not available (Qt < 6.12).
    rig.withoutService('EventReplay');

    rig.client.loadUrl('/some/file.qml');

    expectLoad(rig, 'file:///some/file.qml');
    expect(rig.messageCount).to.equal(0);
    expect(rig.client.recordedEvents.length).to.equal(0);
  });

  it('replays seeded input events when the configuration is confirmed', async () => {
    rig = new PreviewTestRig();
    const clickEvents = mouseClickEvents();
    rig.client.setRecordedEvents(clickEvents);

    rig.confirmConfiguration();

    expectRecordingRequest(rig);
    expectReplaySequence(rig, clickEvents);
    expect(rig.messageCount).to.equal(0);
    await expectReplayFinished(rig, clickEvents);

    // The re-recorded events are kept for the next replay, with compressed
    // time stamps.
    expect(rig.client.recordedEvents.length).to.equal(clickEvents.length);
    expect(
      rig.client.recordedEvents.map((event) => event.timestamp)
    ).to.have.ordered.members([BigInt(0), BigInt(1), BigInt(2)]);
  });

  it('replays seeded input events when hot reload is unavailable', async () => {
    rig = new PreviewTestRig();
    const clickEvents = mouseClickEvents();
    rig.client.setRecordedEvents(clickEvents);

    rig.client.configureEventReplay();

    expectRecordingRequest(rig);
    expectReplaySequence(rig, clickEvents);
    expect(rig.messageCount).to.equal(0);
    await expectReplayFinished(rig, clickEvents);
  });

  it('keeps seeded events on load until the configuration is answered', () => {
    rig = new PreviewTestRig();
    const clickEvents = mouseClickEvents();
    rig.client.setRecordedEvents(clickEvents);

    // The initial file load of a restarted session must not discard the
    // events seeded from the previous session.
    rig.client.loadUrl('/some/file.qml');

    expectLoad(rig, 'file:///some/file.qml');
    expect(rig.client.recordedEvents.length).to.equal(clickEvents.length);

    // Once the configuration is confirmed, the seeded events are replayed.
    rig.confirmConfiguration();
    expectRecordingRequest(rig);
    expectReplaySequence(rig, clickEvents);
    expect(rig.messageCount).to.equal(0);
  });
});
