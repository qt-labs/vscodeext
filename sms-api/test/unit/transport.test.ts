/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Unit tests for the packet framing layer (encodePacket / PacketReader).
 * Mirrors the codec aspects of tst_ipc.cpp and tst_jsonrpcmessage.cpp.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PacketReader,
  encodeJsonPacket,
  encodePacket
} from '../../src/transport';

describe('encodePacket / PacketReader', () => {
  it('encodes and decodes a single JSON packet', () => {
    const reader = new PacketReader();
    const packets: Array<{ command: string; data: string }> = [];
    reader.on('packet', (pkt: { command: string; data: string }) =>
      packets.push(pkt)
    );

    reader.feed(encodeJsonPacket('{"hello":"world"}'));

    assert.equal(packets.length, 1);
    assert.equal(packets[0].command, 'JSON');
    assert.equal(packets[0].data, '{"hello":"world"}');
  });

  it('encodes and decodes a packet with a custom command', () => {
    const reader = new PacketReader();
    const packets: Array<{ command: string; data: string }> = [];
    reader.on('packet', (pkt: { command: string; data: string }) =>
      packets.push(pkt)
    );

    reader.feed(encodePacket('MYCMD', 'some payload'));

    assert.equal(packets.length, 1);
    assert.equal(packets[0].command, 'MYCMD');
    assert.equal(packets[0].data, 'some payload');
  });

  it('decodes multiple packets from a single buffer', () => {
    const reader = new PacketReader();
    const packets: Array<{ command: string; data: string }> = [];
    reader.on('packet', (pkt: { command: string; data: string }) =>
      packets.push(pkt)
    );

    reader.feed(
      Buffer.concat([
        encodeJsonPacket('{"id":"1"}'),
        encodeJsonPacket('{"id":"2"}'),
        encodeJsonPacket('{"id":"3"}')
      ])
    );

    assert.equal(packets.length, 3);
    assert.equal(packets[0].data, '{"id":"1"}');
    assert.equal(packets[1].data, '{"id":"2"}');
    assert.equal(packets[2].data, '{"id":"3"}');
  });

  it('reassembles fragmented packets fed byte-by-byte', () => {
    const reader = new PacketReader();
    const packets: Array<{ command: string; data: string }> = [];
    reader.on('packet', (pkt: { command: string; data: string }) =>
      packets.push(pkt)
    );

    const full = encodeJsonPacket('{"fragmented":true}');
    for (let i = 0; i < full.length - 1; i++) {
      reader.feed(full.subarray(i, i + 1));
      assert.equal(
        packets.length,
        0,
        `Expected 0 packets after feeding ${i + 1} byte(s)`
      );
    }
    reader.feed(full.subarray(full.length - 1));
    assert.equal(packets.length, 1);
    assert.equal(packets[0].data, '{"fragmented":true}');
  });

  it('handles a large payload (100k characters)', () => {
    const reader = new PacketReader();
    const packets: Array<{ command: string; data: string }> = [];
    reader.on('packet', (pkt: { command: string; data: string }) =>
      packets.push(pkt)
    );

    const largeData = 'x'.repeat(100_000);
    reader.feed(encodeJsonPacket(largeData));

    assert.equal(packets.length, 1);
    assert.equal(packets[0].data, largeData);
  });

  it('handles special characters — unicode, escape sequences', () => {
    const reader = new PacketReader();
    const packets: Array<{ command: string; data: string }> = [];
    reader.on('packet', (pkt: { command: string; data: string }) =>
      packets.push(pkt)
    );

    const special = 'Special: \n \t " \\ / ü ñ 漢字';
    reader.feed(encodeJsonPacket(special));

    assert.equal(packets.length, 1);
    assert.equal(packets[0].data, special);
  });

  it('reset() discards buffered partial data so next feed starts fresh', () => {
    const reader = new PacketReader();
    const packets: Array<{ command: string; data: string }> = [];
    reader.on('packet', (pkt: { command: string; data: string }) =>
      packets.push(pkt)
    );

    const full = encodeJsonPacket('{"after":"reset"}');
    // Feed a partial packet to pollute the buffer
    reader.feed(full.subarray(0, 3));
    assert.equal(packets.length, 0);

    reader.reset(); // discard the partial bytes

    // Now feed the complete packet — should decode correctly
    reader.feed(full);
    assert.equal(packets.length, 1);
    assert.equal(packets[0].data, '{"after":"reset"}');
  });
});
