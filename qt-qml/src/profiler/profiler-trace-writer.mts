// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import { createLogger } from 'qt-lib';
import {
  ProfileEvent,
  ProfileMessage,
  ProfileEventType,
  ProfileRangeType
} from './profiler-client.mjs';

const logger = createLogger('qml-profiler-trace-writer');

// ─────────────────────────── type string helpers ───────────────────────────

const RANGE_TYPE_NAMES: Record<number, string> = {
  [ProfileRangeType.Painting]: 'Painting',
  [ProfileRangeType.Compiling]: 'Compiling',
  [ProfileRangeType.Creating]: 'Creating',
  [ProfileRangeType.Binding]: 'Binding',
  [ProfileRangeType.HandlingSignal]: 'HandlingSignal',
  [ProfileRangeType.Javascript]: 'Javascript'
};

function rangeTypeName(rangeType: number): string {
  return RANGE_TYPE_NAMES[rangeType] ?? 'Unknown';
}

// ─────────────────────────── EventTypeRecord ──────────────────────────────

interface EventTypeRecord {
  index: number;
  displayName: string;
  typeName: string;
  filename: string;
  line: number;
  column: number;
  details: string;
  memoryEventType?: number;
}

// ─────────────────────────── RangeRecord (completed range) ────────────────

interface RangeRecord {
  startTime: bigint;
  duration: bigint;
  eventTypeIndex: number;
  amount?: bigint; // for memory events
}

// ─────────────────────────── QmlTraceWriter ───────────────────────────────

/**
 * Accumulates profiler events and writes them out in .qtd (XML) format.
 *
 * The .qtd format is the XML-based QML profiler trace format understood by the
 * VS Code qt-core trace viewer (via qt-cli).
 *
 * Format:
 *   <trace version="1.02" traceStart="…" traceEnd="…">
 *     <eventData totalTime="…">
 *       <event index="N">…</event>
 *     </eventData>
 *     <profilerDataModel>
 *       <range startTime="…" duration="…" eventIndex="N"/>
 *       <range startTime="…" eventIndex="N" amount="…"/>
 *     </profilerDataModel>
 *   </trace>
 */
export class QmlTraceWriter {
  private readonly _eventTypes: EventTypeRecord[] = [];
  private readonly _ranges: RangeRecord[] = [];
  /** Map from a type signature to its index in _eventTypes */
  private readonly _typeKeyToIndex = new Map<string, number>();

  /**
   * Per-range-type stack for tracking open ranges.
   * We use a single flat stack (like Qt Creator does), searching from end
   * for the topmost open range of the requested rangeType.
   */
  private readonly _rangeStack: {
    rangeType: number;
    startTime: bigint;
    displayName: string;
    details: string;
    filename: string;
    line: number;
    column: number;
    serverTypeId: bigint;
  }[] = [];

  private _traceStart = BigInt(-1);
  private _traceEnd = BigInt(-1);

  /** Feed an event into the writer. Call this for every received event. */
  feed(event: ProfileEvent) {
    const subtype = event.subtype as ProfileEventType;
    switch (event.message) {
      case ProfileMessage.Event: {
        if (subtype === ProfileEventType.StartTrace) {
          if (this._traceStart < BigInt(0)) {
            this._traceStart = event.timestamp;
          }
        } else if (subtype === ProfileEventType.EndTrace) {
          this._traceEnd = event.timestamp;
        } else if (subtype === ProfileEventType.AnimationFrame) {
          const typeSig = `AnimationFrame#`;
          let typeIdx = this._typeKeyToIndex.get(typeSig);
          if (typeIdx === undefined) {
            typeIdx = this._eventTypes.length;
            this._typeKeyToIndex.set(typeSig, typeIdx);
            this._eventTypes.push({
              index: typeIdx,
              displayName: 'AnimationFrame',
              typeName: 'AnimationFrame',
              filename: '',
              line: 0,
              column: 0,
              details: ''
            });
          }
          this._ranges.push({
            startTime: event.timestamp,
            duration: BigInt(0),
            eventTypeIndex: typeIdx
          });
        }
        break;
      }

      case ProfileMessage.RangeStart: {
        this._rangeStack.push({
          rangeType: event.subtype,
          startTime: event.timestamp,
          displayName: '',
          details: '',
          filename: '',
          line: 0,
          column: 0,
          serverTypeId: event.serverTypeId ?? BigInt(0)
        });
        break;
      }

      case ProfileMessage.RangeData: {
        const top = this.findTopmostRange(event.subtype);
        if (top) {
          top.details = event.str ?? '';
          if (!top.displayName) {
            top.displayName = top.details;
          }
        }
        break;
      }

      case ProfileMessage.RangeLocation: {
        const top = this.findTopmostRange(event.subtype);
        if (top && event.location) {
          top.filename = event.location.filename;
          top.line = event.location.line;
          top.column = event.location.column;
          const basename =
            event.location.filename.split('/').pop() ?? event.location.filename;
          top.displayName = `${basename}:${String(event.location.line)}`;
        }
        break;
      }

      case ProfileMessage.RangeEnd: {
        const stackIdx = this.findTopmostRangeIndex(event.subtype);
        if (stackIdx === -1) {
          break;
        }
        const range = this._rangeStack[stackIdx];
        if (!range) {
          break;
        }
        this._rangeStack.splice(stackIdx, 1);

        const typeSig = `${String(event.subtype)}#${range.filename}#${String(range.line)}#${String(range.column)}#${range.details}`;
        let typeIdx = this._typeKeyToIndex.get(typeSig);
        if (typeIdx === undefined) {
          typeIdx = this._eventTypes.length;
          this._typeKeyToIndex.set(typeSig, typeIdx);
          this._eventTypes.push({
            index: typeIdx,
            displayName:
              range.displayName ||
              `${rangeTypeName(event.subtype)}:${String(range.line)}`,
            typeName: rangeTypeName(event.subtype),
            filename: range.filename,
            line: range.line,
            column: range.column,
            details: range.details
          });
        }

        const duration =
          event.timestamp > range.startTime
            ? event.timestamp - range.startTime
            : BigInt(0);

        this._ranges.push({
          startTime: range.startTime,
          duration,
          eventTypeIndex: typeIdx
        });
        break;
      }

      case ProfileMessage.MemoryAllocation: {
        const delta = event.numbers[0] ?? BigInt(0);
        const typeSig = `MemoryAllocation#${String(event.subtype)}`;
        let typeIdx = this._typeKeyToIndex.get(typeSig);
        if (typeIdx === undefined) {
          typeIdx = this._eventTypes.length;
          this._typeKeyToIndex.set(typeSig, typeIdx);
          this._eventTypes.push({
            index: typeIdx,
            displayName: '<bytecode>',
            typeName: 'MemoryAllocation',
            filename: '',
            line: 0,
            column: 0,
            details: '',
            memoryEventType: event.subtype
          });
        }
        this._ranges.push({
          startTime: event.timestamp,
          duration: BigInt(0),
          eventTypeIndex: typeIdx,
          amount: delta
        });
        break;
      }

      case ProfileMessage.SceneGraphFrame: {
        const typeSig = `SceneGraphFrame#${String(event.subtype)}`;
        let typeIdx = this._typeKeyToIndex.get(typeSig);
        if (typeIdx === undefined) {
          typeIdx = this._eventTypes.length;
          this._typeKeyToIndex.set(typeSig, typeIdx);
          this._eventTypes.push({
            index: typeIdx,
            displayName: `SceneGraph${String(event.subtype)}`,
            typeName: 'SceneGraphFrame',
            filename: '',
            line: 0,
            column: 0,
            details: String(event.subtype)
          });
        }
        const duration = event.numbers[0] ?? BigInt(0);
        this._ranges.push({
          startTime: event.timestamp,
          duration,
          eventTypeIndex: typeIdx
        });
        break;
      }

      case ProfileMessage.PixmapCacheEvent: {
        const filename = event.str ?? '';
        const typeSig = `PixmapCacheEvent#${String(event.subtype)}#${filename}`;
        let typeIdx = this._typeKeyToIndex.get(typeSig);
        if (typeIdx === undefined) {
          typeIdx = this._eventTypes.length;
          this._typeKeyToIndex.set(typeSig, typeIdx);
          const basename = filename.split('/').pop() ?? filename;
          this._eventTypes.push({
            index: typeIdx,
            displayName: basename || `Pixmap${String(event.subtype)}`,
            typeName: 'PixmapCacheEvent',
            filename,
            line: 0,
            column: 0,
            details: String(event.subtype)
          });
        }
        this._ranges.push({
          startTime: event.timestamp,
          duration: BigInt(0),
          eventTypeIndex: typeIdx
        });
        break;
      }

      case ProfileMessage.Complete:
        if (this._traceEnd < BigInt(0)) {
          this._traceEnd = event.timestamp;
        }
        break;

      default:
        break;
    }
  }

  onCompleted(maximumTime: bigint) {
    if (this._traceEnd < BigInt(0)) {
      this._traceEnd = maximumTime;
    }
  }

  /** Write the accumulated trace data to a .qtd XML file. */
  writeToFile(filePath: string) {
    logger.info(
      `Writing trace: ${String(this._ranges.length)} ranges, ${String(this._eventTypes.length)} types -> ${filePath}`
    );

    const traceStart =
      this._traceStart >= BigInt(0) ? this._traceStart : BigInt(0);
    const traceEnd = this._traceEnd >= BigInt(0) ? this._traceEnd : traceStart;
    const totalTime = traceEnd - traceStart;

    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8" ?>');
    lines.push(
      `<trace version="1.02" traceStart="${String(traceStart)}" traceEnd="${String(traceEnd)}">`
    );
    lines.push(`  <eventData totalTime="${String(totalTime)}">`);

    for (const et of this._eventTypes) {
      lines.push(`    <event index="${String(et.index)}">`);
      lines.push(
        `      <displayname>${escapeXml(et.displayName)}</displayname>`
      );
      lines.push(`      <type>${escapeXml(et.typeName)}</type>`);
      if (et.filename) {
        lines.push(`      <filename>${escapeXml(et.filename)}</filename>`);
        lines.push(`      <line>${String(et.line)}</line>`);
        lines.push(`      <column>${String(et.column)}</column>`);
      }
      if (et.details) {
        lines.push(`      <details>${escapeXml(et.details)}</details>`);
      }
      if (et.memoryEventType !== undefined) {
        lines.push(
          `      <memoryEventType>${String(et.memoryEventType)}</memoryEventType>`
        );
      }
      lines.push(`    </event>`);
    }

    lines.push('  </eventData>');
    lines.push('  <profilerDataModel>');

    for (const r of this._ranges) {
      if (r.amount !== undefined) {
        lines.push(
          `    <range startTime="${String(r.startTime)}" eventIndex="${String(r.eventTypeIndex)}" amount="${String(r.amount)}"/>`
        );
      } else {
        lines.push(
          `    <range startTime="${String(r.startTime)}" duration="${String(r.duration)}" eventIndex="${String(r.eventTypeIndex)}"/>`
        );
      }
    }

    lines.push('  </profilerDataModel>');
    lines.push('</trace>');

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    logger.info('Trace written to', filePath);
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private findTopmostRangeIndex(rangeType: number): number {
    for (let i = this._rangeStack.length - 1; i >= 0; i--) {
      const item = this._rangeStack[i];
      if (item?.rangeType === rangeType) {
        return i;
      }
    }
    return -1;
  }

  private findTopmostRange(rangeType: number) {
    const idx = this.findTopmostRangeIndex(rangeType);
    return idx >= 0 ? this._rangeStack[idx] : undefined;
  }

  get hasData(): boolean {
    return this._ranges.length > 0 || this._eventTypes.length > 0;
  }

  reset() {
    this._eventTypes.length = 0;
    this._ranges.length = 0;
    this._rangeStack.length = 0;
    this._typeKeyToIndex.clear();
    this._traceStart = BigInt(-1);
    this._traceEnd = BigInt(-1);
  }
}

// ─────────────────────────────── XML escaping ─────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
