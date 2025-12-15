// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// Central, hand-curated list of golden expectations for the NatVis test.

import { GoldenEntry, type GoldenEntryInput } from './debug-golden.mts';

const GOLDEN_ENTRY_DEFS: readonly GoldenEntryInput[] = [
  {
    name: 'coreTypes.qByteArray',
    type: 'QByteArray',
    value: 'Hello World!'
  },
  {
    name: 'coreTypes.qChar',
    type: 'QChar',
    value: "99 'c'"
  },
  {
    name: 'coreTypes.qDate',
    type: 'QDate',
    value: '2024-06-15',
    knownProblem: {
      darwin:
        'LLDB fails to evaluate QDate intrinsics (year(), month(), day()) and prints evaluation errors instead of the formatted date.',
      linux:
        'LLDB fails to evaluate QDate intrinsics (year(), month(), day()) and prints evaluation errors instead of the formatted date.'
    }
  },
  {
    name: 'coreTypes.qDateTimeBrunei',
    type: 'QDateTime',
    value: 'QDateTime(Brunei placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d={...}}" representation instead of a formatted date-time.'
    }
  },
  {
    name: 'coreTypes.qDateTimeDefault',
    type: 'QDateTime',
    value: 'QDateTime(Default placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d={...}}" representation instead of a formatted date-time.'
    }
  },
  {
    name: 'coreTypes.qDateTimeMarquesas',
    type: 'QDateTime',
    value: 'QDateTime(Marquesas placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d={...}}" representation instead of a formatted date-time.'
    }
  },
  {
    name: 'coreTypes.qDateTimeSecOffset',
    type: 'QDateTime',
    value: 'QDateTime(TimeSecOffset placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d={...}}" representation instead of a formatted date-time.'
    }
  },
  {
    name: 'coreTypes.qDateTimeShouldFail',
    type: 'QDateTime',
    value: 'unknown_invalid',
    knownProblem: {
      all:
        'qDateTimeShouldFail is intentionally constructed with an invalid/timezone setup to ' +
        'exercise QDateTime NatVis error-path behaviour. However, because QDateTime NatVis is ' +
        'currently broken globally, we cannot yet assert its DisplayString or error formatting.'
    }
  },
  {
    name: 'coreTypes.qDateTimeSouthPole',
    type: 'QDateTime',
    value: 'QDateTime(SouthPole placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d={...}}" representation instead of a formatted date-time.'
    }
  },
  {
    name: 'coreTypes.qDateTimeUtc',
    type: 'QDateTime',
    value: 'QDateTime(TimeUtc placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d={...}}" representation instead of a formatted date-time.'
    }
  },
  {
    name: 'coreTypes.qDateTimeYukon',
    type: 'QDateTime',
    value: 'QDateTime(Yukon placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB/GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors. ',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d={...}}" representation instead of a formatted date-time.'
    }
  },
  {
    name: 'coreTypes.qDir',
    type: 'QDir',
    value: '"/path/to/normalize/projectFolderNatvis"',
    knownProblem: {
      darwin:
        'natvis expressions reference Windows-only modules (Qt6Core[d].dll), so LLDB/GDB cannot resolve the intrinsic "d()". ',
      linux:
        'natvis expressions reference Windows-only modules (Qt6Core[d].dll), so LLDB/GDB cannot resolve the intrinsic "d()". ',
      win32:
        'natvis loads, but DisplayString fails due to missing or incompatible private symbols (QDirPrivate) or incomplete PDBs, causing fallback to raw {d_ptr={...}} output.'
    }
  },
  {
    name: 'coreTypes.qFile',
    type: 'QFile',
    value: '"/path/to/normalize/projectFolderNatvis"',
    knownProblem: {
      darwin:
        '-natvis expressions depend on Windows-only Qt6Core[d].dll symbols, so LLDB/GDB cannot evaluate "d()". ',
      linux:
        '-natvis expressions depend on Windows-only Qt6Core[d].dll symbols, so LLDB/GDB cannot evaluate "d()". ',
      win32:
        'natvis is loaded, but DisplayString evaluation fails (likely due to absent private symbols or reduced PDBs), leading to fallback raw formatting.'
    }
  },
  {
    name: 'coreTypes.qFileInfo',
    type: 'QFileInfo',
    value: '"/path/to/normalize/projectFolderNatvis"',
    knownProblem: {
      darwin:
        'natvis rules reference Windows-only Qt6Core[d].dll symbols, so LLDB/GDB cannot compute the "d()" intrinsic. ',
      linux:
        'natvis rules reference Windows-only Qt6Core[d].dll symbols, so LLDB/GDB cannot compute the "d()" intrinsic. ',
      win32:
        'natvis loads, but DisplayString fails because required private types or fields (QFileInfoPrivate) are not available in the CI Qt build, forcing the debugger to show raw {d_ptr={...}} output.'
    }
  },
  {
    name: 'coreTypes.qFlags',
    type: 'SelectionFlags',
    value: 'SelectCurrent | SelectAll (3)',
    knownProblem: {
      darwin:
        'QFlags-based SelectionFlags NatVis rule only works with the Visual Studio debugger; LLDB/GDB fall back to a raw value, so flag names are not shown.',
      linux:
        'QFlags-based SelectionFlags NatVis rule only works with the Visual Studio debugger; LLDB/GDB fall back to a raw value, so flag names are not shown.'
    }
  },
  {
    name: 'coreTypes.qJsonDocument',
    type: 'QJsonDocument',
    value: {
      darwin: '{...}',
      win32: '{d=unique_ptr {...} }',
      linux: ''
    }
    // no knownProblem here: the known problem is only for qJsonDocumentEmpty
  },
  {
    name: 'coreTypes.qJsonDocumentEmpty',
    type: 'QJsonDocument',
    value: {
      darwin: '{empty}',
      linux: '{empty}',
      win32: '{d=empty }'
    },
    knownProblem: {
      darwin:
        'QJsonDocument NatVis relies on MSVC-specific internals (d._Mypair._Myval2) and a Qt6Cored.dll private type in Expand; LLDB/GDB cannot evaluate these, so value stays as raw "{...}" on non-Windows.',
      linux:
        'QJsonDocument NatVis relies on MSVC-specific internals (d._Mypair._Myval2) and a Qt6Cored.dll private type in Expand; LLDB/GDB cannot evaluate these, so value stays as raw "{...}" on non-Windows.'
    }
  },
  {
    name: 'coreTypes.qLine',
    type: 'QLine',
    value: '{ start point = { x = 0, y = 1 }, end point = { x = 42, y = 43 } }'
  },
  {
    name: 'coreTypes.qPoint',
    type: 'QPoint',
    value: '{ x = 24, y = 48 }'
  },
  {
    name: 'coreTypes.qPointF',
    type: 'QPoint',
    value: '{ x = 24.5, y = 48.5 }'
  },
  {
    name: 'coreTypes.qRect',
    type: 'QRect',
    value: '{ x = 5, y = 6, width = 41, height = 42 }'
  },
  {
    name: 'coreTypes.qRectF',
    type: 'QRectF',
    value: '{ x = 5.1, y = 5.5, width = 4.1, height = 4.2 }'
  },
  {
    name: 'coreTypes.qSize',
    type: 'QSize',
    value: '{ width = 42, height = 43 }'
  },
  {
    name: 'coreTypes.qSizeF',
    type: 'QSize',
    value: '{ width = 4.1, height = 4.2 }'
  },
  {
    name: 'coreTypes.qString',
    type: 'QString',
    value: 'Hello World! Again.'
  },
  {
    name: 'coreTypes.qStringView',
    type: 'QStringView',
    value: 'Hello World! Again.',
    knownProblem: {
      darwin:
        'LLDB currently fails to evaluate {m_data,[m_size]} and prints an evaluation error instead of the string contents.',
      linux:
        'LLDB currently fails to evaluate {m_data,[m_size]} and prints an evaluation error instead of the string contents.'
    }
  },
  {
    name: 'coreTypes.qTime',
    type: 'QTime',
    value: '{ milliseconds = 45296000 }'
  },
  {
    name: 'coreTypes.qUrl',
    type: 'QUrl',
    value: 'https://github.com/narnaud/natvis4qt',
    knownProblem: {
      darwin:
        'LLDB/GDB cannot evaluate the pointer-arithmetic intrinsics used to access scheme()/host()/path() relying on MSVC-specific ',
      linux:
        'LLDB/GDB cannot evaluate the pointer-arithmetic intrinsics used to access scheme()/host()/path() relying on MSVC-specific ',
      win32:
        'natvis loads, but DisplayString evaluation fails due to missing private QtCore symbols or reduced PDBs, causing fallback to the raw internal form.'
    }
  },
  {
    name: 'coreTypes.qUuid',
    type: 'QUuid',
    value: '{12345678-1234-1234-1234-1234567890AB}',
    knownProblem: {
      darwin:
        'QUuid NatVis uses Visual Studio–only format specifiers (Xb/nvoXb) unsupported by LLDB/GDB, causing evaluation errors on macOS/Linux.',
      linux:
        'QUuid NatVis uses Visual Studio–only format specifiers (Xb/nvoXb) unsupported by LLDB/GDB, causing evaluation errors on macOS/Linux.'
    }
  },
  {
    name: 'containerTypes.qIntList',
    type: 'QList<int>',
    value: '{ size=3 }'
  },
  {
    name: 'containerTypes.qStringList',
    type: 'QStringList',
    value: '{ size=3 }',
    knownProblem: {
      linux:
        'Typedef (QList<QString>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to "{...}"".',
      darwin:
        'Typedef (QList<QString>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to "{...}"".'
    }
  },
  {
    name: 'containerTypes.qByteArrayList',
    type: 'QByteArrayList',
    value: '{ size=2 }',
    knownProblem: {
      linux:
        'Typedef (QList<QByteArray>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to "{...}"".',
      darwin:
        'Typedef (QList<QByteArray>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to "{...}"".'
    }
  },
  {
    name: 'containerTypes.qPairStringInt',
    type: 'QPair<QString, int>',
    value: {
      win32: '(pair-key, 42)',
      darwin: '(0xADDR u"pair-key", 42)',
      linux: '(pair-key, 42)'
    },
    knownProblem: {
      linux:
        'Typedef (QPair<QString, int>) ule evaluation fails, so the debugger falls back to "{...}"".'
    }
  },
  {
    name: 'containerTypes.qCborArray',
    type: 'QCborArray',
    value: 'unknown_invalid',
    knownProblem: {
      all: 'QCborArray NatVis output is not stable across platforms/debuggers yet (often raw/opaque forms like "{...}", quoting artifacts, or backend-specific formatting). Keep placeholder until we decide what to assert.'
    }
  },
  {
    name: 'containerTypes.qCborValueInt',
    type: 'QCborValue',
    value: '42',
    knownProblem: {
      darwin:
        'QCborValue NatVis formatting is currently unreliable under LLDB; value often collapses to an opaque "{...}" form.',
      win32:
        'QCborValue NatVis currently fails. Debugger provides: n=42 container=0xADDR <NULL> t=Integer (0) instead of just "42".'
    }
  }
] as const;

export const GOLDEN_ENTRIES: readonly GoldenEntry[] = GOLDEN_ENTRY_DEFS.map(
  (e) => new GoldenEntry(e)
);
