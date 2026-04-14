// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// Central, hand-curated list of golden expectations for the NatVis test.

import { GoldenEntry, type GoldenEntryInput } from './debug-golden.mts';

const GOLDEN_ENTRY_DEFS: readonly GoldenEntryInput[] = [
  {
    name: 'coreTypes.qByteArray',
    type: 'QByteArray',
    value: 'Hello World!',
    children: [
      {
        name: '[size]',
        value: '12'
      },
      {
        name: '[0]',
        value: "'H'"
      },
      {
        name: '[11]',
        value: "'!'"
      }
    ]
  },
  {
    name: 'coreTypes.qChar',
    type: 'QChar',
    value: "99 'c'",
    children: [
      {
        name: '[latin 1]',
        value: "'c'"
      },
      {
        name: '[unicode]',
        value: {
          darwin: "'c'",
          linux: "'c'",
          win32: "u'c'"
        }
      }
    ]
  },
  {
    name: 'coreTypes.qDate',
    type: 'QDate',
    value: '2024-06-15',
    knownProblem: {
      darwin:
        'LLDB fails to evaluate QDate intrinsics (year(), month(), day()) and prints evaluation errors instead of the formatted date.',
      linux:
        'GDB fails to evaluate QDate intrinsics (year(), month(), day()) and prints evaluation errors instead of the formatted date.'
    },
    children: [
      { name: '[year]', value: '2024' },
      { name: '[month]', value: '6' },
      { name: '[day]', value: '15' }
    ]
  },
  {
    name: 'coreTypes.qDateTimeBrunei',
    type: 'QDateTime',
    value: 'QDateTime(Brunei placeholder)',
    knownProblem: {
      darwin:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
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
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
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
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
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
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
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
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
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
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
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
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so LLDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
      linux:
        'NatVis expressions reference Windows-only private symbols ' +
        '(e.g. Qt6Cored.dll!QDateTimePrivate), so GDB cannot evaluate the intrinsics ' +
        '(priv(), status(), year(), month(), day(), RecZone views), producing long evaluation errors.',
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
        'natvis expressions reference Windows-only modules (Qt6Cored.dll), so LLDB cannot resolve the intrinsic d().',
      linux:
        'natvis expressions reference Windows-only modules (Qt6Cored.dll), so GDB cannot resolve the intrinsic d().',
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
        'natvis expressions depend on Windows-only Qt6Cored.dll symbols, so LLDB cannot evaluate d().',
      linux:
        'natvis expressions depend on Windows-only Qt6Cored.dll symbols, so GDB cannot evaluate d().',
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
        'natvis rules reference Windows-only Qt6Cored.dll symbols, so LLDB cannot compute the d() intrinsic.',
      linux:
        'natvis rules reference Windows-only Qt6Cored.dll symbols, so GDB cannot compute the d() intrinsic.',
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
        'QFlags-based SelectionFlags NatVis rule only works with the Visual Studio debugger; LLDB falls back to a raw value, so flag names are not shown.',
      linux:
        'QFlags-based SelectionFlags NatVis rule only works with the Visual Studio debugger; GDB falls back to a raw value, so flag names are not shown.'
    },
    children: [{ name: '[value]', value: 'SelectCurrent | SelectAll (3)' }]
  },
  {
    name: 'coreTypes.qJsonDocument',
    type: 'QJsonDocument',
    value: {
      darwin: '{...}',
      win32: '{d=unique_ptr {...} }',
      linux: ''
    },
    children: [
      {
        name: '[0]',
        value: '<unvalidated>',
        knownProblem: {
          all:
            'QJsonDocument NatVis Expand depends on a Qt6Cored.dll intrinsic / MSVC-only internals; ' +
            'child expansion is unreliable under LLDB/GDB and on win32 CI, so children are not validated.'
        }
      }
    ]
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
        'QJsonDocument NatVis relies on MSVC-specific internals (d._Mypair._Myval2) and a Qt6Cored.dll private type in Expand; LLDB cannot evaluate these, so value stays as raw "{...}" on non-Windows.',
      linux:
        'QJsonDocument NatVis relies on MSVC-specific internals (d._Mypair._Myval2) and a Qt6Cored.dll private type in Expand; GDB cannot evaluate these, so value stays as raw "{...}" on non-Windows.'
    },
    children: [{ name: '[expect_none]', value: '' }]
  },
  {
    name: 'coreTypes.qLine',
    type: 'QLine',
    value: '{ start point = { x = 0, y = 1 }, end point = { x = 42, y = 43 } }',
    children: [
      {
        name: '[start point]',
        value: '{ x = 0, y = 1 }',
        knownProblem: {
          darwin:
            'LLDB does not reliably enumerate NatVis Synthetic children; ' +
            'the [start point] node is missing from the expanded QLine on macOS.',
          linux:
            'GDB does not reliably enumerate NatVis Synthetic children; ' +
            'the [start point] node is missing from the expanded QLine on Linux.'
        },
        children: [
          { name: '[x]', value: '0' },
          { name: '[y]', value: '1' }
        ]
      },
      {
        name: '[end point]',
        value: '{ x = 42, y = 43 }',
        knownProblem: {
          darwin:
            'LLDB does not reliably enumerate NatVis Synthetic children; ' +
            'the [end point] node is missing from the expanded QLine on macOS.',
          linux:
            'GDB does not reliably enumerate NatVis Synthetic children; ' +
            'the [end point] node is missing from the expanded QLine on Linux.'
        },
        children: [
          { name: '[x]', value: '42' },
          { name: '[y]', value: '43' }
        ]
      }
    ]
  },
  {
    name: 'coreTypes.qPoint',
    type: 'QPoint',
    value: '{ x = 24, y = 48 }',
    children: [
      { name: '[x]', value: '24' },
      { name: '[y]', value: '48' }
    ]
  },
  {
    name: 'coreTypes.qPointF',
    type: 'QPointF',
    value: '{ x = 24.5, y = 48.5 }',
    children: [
      {
        name: '[x]',
        value: '24.5'
      },
      {
        name: '[y]',
        value: '48.5'
      }
    ]
  },
  {
    name: 'coreTypes.qRect',
    type: 'QRect',
    value: '{ x = 5, y = 6, width = 41, height = 42 }',
    children: [
      { name: '[x]', value: '5' },
      { name: '[y]', value: '6' },
      { name: '[width]', value: '41' },
      { name: '[height]', value: '42' }
    ]
  },
  {
    name: 'coreTypes.qRectF',
    type: 'QRectF',
    value: '{ x = 5.1, y = 5.5, width = 4.1, height = 4.2 }',
    children: [
      { name: '[x]', value: '5.1' },
      { name: '[y]', value: '5.5' },
      { name: '[width]', value: '4.1' },
      { name: '[height]', value: '4.2' }
    ]
  },
  {
    name: 'coreTypes.qSize',
    type: 'QSize',
    value: '{ width = 42, height = 43 }',
    children: [
      { name: '[width]', value: '42' },
      { name: '[height]', value: '43' }
    ]
  },
  {
    name: 'coreTypes.qSizeF',
    type: 'QSizeF',
    value: '{ width = 4.1, height = 4.2 }',
    children: [
      { name: '[width]', value: '4.1' },
      { name: '[height]', value: '4.2' }
    ]
  },
  {
    name: 'coreTypes.qString',
    type: 'QString',
    value: 'Hello World! Again.',
    children: [
      // NatVis <Item Name="[size]">d.size</Item>
      {
        name: '[size]',
        value: '19'
      },

      // NatVis <ArrayItems> – minimal sentinel checks
      {
        name: '[0]',
        value: "u'H'"
      },
      {
        name: '[18]',
        value: "u'.'"
      }
    ]
  },
  {
    name: 'coreTypes.qStringView',
    type: 'QStringView',
    value: 'Hello World! Again.',
    children: [{ name: '[size]', value: '19' }]
  },
  {
    name: 'coreTypes.qTime',
    type: 'QTime',
    value: '{ milliseconds = 45296000 }',
    children: [
      {
        name: '[hours]',
        value: '12',
        knownProblem: {
          darwin:
            'LLDB fails to evaluate QTime intrinsic hour(); ' +
            'reports "use of undeclared identifier \'hour\'".',
          linux:
            'GDB fails to evaluate QTime intrinsic hour(); ' +
            'reports "use of undeclared identifier \'hour\'".'
        }
      },
      {
        name: '[minutes]',
        value: '34',
        knownProblem: {
          darwin:
            'LLDB fails to evaluate QTime intrinsic minute(); ' +
            'reports "use of undeclared identifier \'minute\'".',
          linux:
            'GDB fails to evaluate QTime intrinsic minute(); ' +
            'reports "use of undeclared identifier \'minute\'".'
        }
      },
      {
        name: '[seconds]',
        value: '56',
        knownProblem: {
          darwin:
            'LLDB fails to evaluate QTime intrinsic second(); ' +
            'reports "use of undeclared identifier \'second\'".',
          linux:
            'GDB fails to evaluate QTime intrinsic second(); ' +
            'reports "use of undeclared identifier \'second\'".'
        }
      },
      {
        name: '[milliseconds]',
        value: '0',
        knownProblem: {
          darwin:
            'LLDB fails to evaluate QTime intrinsic millisecond(); ' +
            'reports "use of undeclared identifier \'millisecond\'".',
          linux:
            'GDB fails to evaluate QTime intrinsic millisecond(); ' +
            'reports "use of undeclared identifier \'millisecond\'".'
        }
      }
    ]
  },
  {
    name: 'coreTypes.qUrl',
    type: 'QUrl',
    value: 'https://github.com/narnaud/natvis4qt?ref=main#section1',
    knownProblem: {
      darwin:
        'LLDB cannot evaluate the pointer-arithmetic intrinsics used to access scheme()/host()/path() relying on MSVC-specific.',
      linux:
        'GDB cannot evaluate the pointer-arithmetic intrinsics used to access scheme()/host()/path() relying on MSVC-specific.'
    },
    children: [
      { name: '[scheme]', value: 'https' },
      { name: '[username]', value: 'user' },
      { name: '[password]', value: 'pass' },
      { name: '[host]', value: 'github.com' },
      { name: '[path]', value: '/narnaud/natvis4qt' },
      { name: '[query]', value: 'ref=main' },
      { name: '[fragment]', value: 'section1' }
    ]
  },
  {
    name: 'coreTypes.qUuid',
    type: 'QUuid',
    value: '{12345678-1234-1234-1234-1234567890AB}',
    knownProblem: {
      darwin:
        'QUuid NatVis uses Visual Studio–only format specifiers (Xb/nvoXb) unsupported by LLDB, causing evaluation errors on macOS.',
      linux:
        'QUuid NatVis uses Visual Studio–only format specifiers (Xb/nvoXb) unsupported by GDB, causing evaluation errors on Linux.',
      win32:
        'QUuid NatVis formatting appears truncated on current Windows debugger: the Node portion renders only 6 hex digits instead of 12 (likely nvoXb format handling regression).'
    },
    children: [
      { name: '[Time-low]', value: '12345678' },
      { name: '[Time-mid]', value: '1234' },
      { name: '[Time-high-and-version]', value: '1234' },
      { name: '[Clock-seq]', value: '1234' },
      { name: '[Node]', value: '1234567890AB' }
    ]
  },
  {
    name: 'containerTypes.qIntList',
    type: 'QList<int>',
    value: '{ size=3 }',
    children: [
      { name: '[0]', value: '1' },
      { name: '[2]', value: '3' }
    ]
  },
  {
    name: 'containerTypes.qVariantList',
    type: 'QList<QVariant>',
    value: '{ size=2 }',
    children: [
      {
        name: '[0]',
        value: '123',
        knownProblem: {
          darwin:
            'QVariant NatVis evaluation fails under LLDB. QList expands but element DisplayString becomes an evaluator error.',
          linux:
            'QVariant NatVis evaluation fails under GDB. QList expands but element DisplayString becomes an evaluator error.',
          win32:
            'QVariant elements are rendered as their internal storage ' +
            '(d/data/shared/_forAlignment...) instead of the contained scalar value.'
        }
      },
      {
        name: '[1]',
        value: 'hello',
        knownProblem: {
          darwin:
            'QVariant NatVis evaluation fails under LLDB. QList expands but element DisplayString becomes an evaluator error.',
          linux:
            'QVariant NatVis evaluation fails under GDB. QList expands but element DisplayString becomes an evaluator error.',
          win32:
            'QVariant elements are rendered as their internal storage ' +
            '(d/data/shared/_forAlignment...) instead of the contained scalar value.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qStringListExplicit',
    type: 'QList<QString>',
    value: '{ size=2 }',
    children: [
      { name: '[0]', value: 'alpha' },
      { name: '[1]', value: 'beta' }
    ]
  },
  {
    name: 'containerTypes.qStringList',
    type: 'QStringList',
    value: '{ size=3 }',
    knownProblem: {
      linux:
        'Typedef (QList<QString>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to {...}.',
      darwin:
        'Typedef (QList<QString>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to {...}.'
    },
    children: [
      { name: '[0]', type: 'QString', value: 'red' },
      { name: '[1]', type: 'QString', value: 'green' },
      { name: '[2]', type: 'QString', value: 'blue' }
    ]
  },
  {
    name: 'containerTypes.qVectorInt',
    type: 'QVector<int>',
    value: '{ size=3 }',
    knownProblem: {
      linux:
        'The NatVis QVector<*> rule evaluation fails, so the debugger falls back to {...}.'
    },
    children: [
      { name: '[0]', value: '10' },
      { name: '[1]', value: '20' },
      { name: '[2]', value: '30' }
    ]
  },
  {
    name: 'containerTypes.qSpanInt',
    type: 'QSpan<int>',
    value: '{ size=3 }',
    knownProblem: {
      darwin:
        "LLDB NatVis evaluation fails (e.g. 'use of undeclared identifier m_size'), so QSpan<int> isn't reliably visualized on macOS."
    },
    children: [
      { name: '[0]', value: '10' },
      { name: '[1]', value: '20' },
      { name: '[2]', value: '30' }
    ]
  },
  {
    name: 'containerTypes.qVectorPointF',
    type: 'QVector<QPointF>',
    value: '{ size=2 }',
    knownProblem: {
      linux:
        'The NatVis QVector<*> rule evaluation fails, so the debugger falls back to {...}.'
    },
    children: [
      { name: '[0]', value: '{ x = 1, y = 2 }' },
      { name: '[1]', value: '{ x = 3, y = 4 }' }
    ]
  },
  {
    name: 'containerTypes.qVarLengthArrayInt',
    type: 'QVarLengthArray<int, 4>',
    value: '{ size=3 }',
    knownProblem: {
      darwin:
        "LLDB NatVis errors out: expression 's' is not resolvable ('use of undeclared identifier s'), evaluation fails."
    },
    children: [
      { name: '[capacity]', value: '4' },
      { name: '[0]', value: '7' },
      { name: '[1]', value: '8' },
      { name: '[2]', value: '9' }
    ]
  },
  {
    name: 'containerTypes.qMapStringInt',
    type: 'QMap<QString, int>',
    value: '{ size=2 }',
    knownProblem: {
      darwin:
        'LLDB NatVis for QMap<*,*> errors: the rule relies on intrinsic p() and MSVC std::map internals (p()->m._Mypair..._Mysize), DisplayString/TreeItems fails.',
      linux:
        'GDB NatVis for QMap<*,*> errors: the rule relies on intrinsic p() and MSVC std::map internals (p()->m._Mypair..._Mysize), DisplayString/TreeItems fails.'
    },
    children: [
      { name: '[one]', value: '1' },
      { name: '[two]', value: '2' }
    ]
  },
  {
    name: 'containerTypes.qMultiMapStringInt',
    type: 'QMultiMap<QString, int>',
    value: '{ size=2 }',
    knownProblem: {
      darwin:
        'LLDB NatVis for QMap<*,*> errors: the rule relies on intrinsic p() and MSVC std::map internals (p()->m._Mypair..._Mysize), DisplayString/TreeItems fails.',
      linux:
        'GDB NatVis for QMap<*,*> errors: the rule relies on intrinsic p() and MSVC std::map internals (p()->m._Mypair..._Mysize), DisplayString/TreeItems fails.'
    },
    children: [
      { name: '[first_key]', value: '1' },
      { name: '[second_key]', value: '2' }
    ]
  },
  {
    name: 'containerTypes.qHashStringInt',
    type: 'QHash<QString, int>',
    value: '{ size=2 }',
    children: [
      {
        name: '[one]',
        type: 'QHashPrivate::Node<QString,int>',
        value: '1',
        knownProblem: {
          darwin:
            'LLDB does not reliably materialize QHash CustomListItems/Node children (key/value) via DAP variables().',
          linux:
            'GDB/MI does not reliably materialize QHash CustomListItems/Node children (key/value) via DAP variables().'
        },
        children: [
          { name: 'key', value: 'one' },
          { name: 'value', value: '1' }
        ]
      },
      {
        name: '[two]',
        type: 'QHashPrivate::Node<QString,int>',
        value: '2',
        knownProblem: {
          darwin:
            'LLDB does not reliably materialize QHash CustomListItems/Node children (key/value) via DAP variables().',
          linux:
            'GDB/MI does not reliably materialize QHash CustomListItems/Node children (key/value) via DAP variables().'
        },
        children: [
          { name: 'key', value: 'two' },
          { name: 'value', value: '2' }
        ]
      }
    ]
  },
  {
    name: 'containerTypes.qMultiHashStringInt',
    type: 'QMultiHash<QString, int>',
    value: '{ size=2 }',
    children: [
      {
        name: '[k1]',
        type: 'QHashPrivate::MultiNode<QString,int>',
        value: '100',
        knownProblem: {
          darwin:
            'LLDB/MI does not reliably materialize QMultiHash CustomListItems/MultiNode children via DAP variables().',
          linux:
            'GDB/MI does not reliably materialize QMultiHash CustomListItems/MultiNode children via DAP variables().'
        },
        children: [{ name: '[0]', value: '100' }]
      },
      {
        name: '[k2]',
        type: 'QHashPrivate::MultiNode<QString,int>',
        value: '200',
        knownProblem: {
          darwin:
            'LLDB/MI does not reliably materialize QMultiHash CustomListItems/MultiNode children via DAP variables().',
          linux:
            'GDB/MI does not reliably materialize QMultiHash CustomListItems/MultiNode children via DAP variables().'
        },
        children: [{ name: '[0]', value: '200' }]
      }
    ]
  },
  {
    name: 'containerTypes.qSetString',
    type: 'QSet<QString>',
    value: '{ size=2 }',
    children: [
      {
        name: '[apple]',
        value: 'apple',
        knownProblem: {
          darwin:
            'Expected QSet NatVis to inline-expand q_hash, but LLDB does not materialize the NatVis QHash CustomListItems expansion.',
          linux:
            'Expected QSet NatVis to inline-expand q_hash, but GDB does not materialize the NatVis QHash CustomListItems expansion.'
        }
      },
      {
        name: '[banana]',
        value: 'banana',
        knownProblem: {
          darwin:
            'Expected QSet NatVis to inline-expand q_hash, but LLDB does not materialize the NatVis QHash CustomListItems expansion.',
          linux:
            'Expected QSet NatVis to inline-expand q_hash, but GDB does not materialize the NatVis QHash CustomListItems expansion.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qVariantMap',
    type: 'QVariantMap',
    value: '{ size=2 }',
    knownProblem: {
      darwin:
        "LLDB NatVis evaluation fails, renders as '{...}' instead of a proper map summary.",
      linux:
        "GDB NatVis evaluation fails, renders as '{...}' instead of a proper map summary."
    },
    children: [
      {
        name: '[answer]',
        value: '42',
        knownProblem: {
          win32:
            'QMap/QVariantMap TreeItems MapHelper view is not applied; debugger shows raw std::pair<const QString,QVariant> instead of mapped value.'
        }
      },
      {
        name: '[question]',
        value: 'life',
        knownProblem: {
          win32:
            'QMap/QVariantMap TreeItems MapHelper view is not applied; debugger shows raw std::pair<const QString,QVariant> instead of mapped value.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qVariantListContainer',
    type: 'QVariantList',
    value: '{ size=3 }',
    knownProblem: {
      darwin:
        "LLDB NatVis evaluation fails, renders as '{...}' instead of a proper map summary.",
      linux:
        "GDB NatVis evaluation fails, renders as '{...}' instead of a proper map summary."
    },
    children: [
      {
        name: '[0]',
        value: '123',
        knownProblem: {
          win32:
            'QVariant inside QList/QVariantList is not rendered via NatVis on Windows; debugger falls back to internal d={data=...} representation.'
        }
      },
      {
        name: '[1]',
        value: 'abc',
        knownProblem: {
          win32:
            'QVariant inside QList/QVariantList is not rendered via NatVis on Windows; debugger falls back to internal d={data=...} representation.'
        }
      },
      {
        name: '[2]',
        value: 'true',
        knownProblem: {
          win32:
            'QVariant inside QList/QVariantList is not rendered via NatVis on Windows; debugger falls back to internal d={data=...} representation.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qVariantHash',
    type: 'QVariantHash',
    value: '{ size=2 }',
    knownProblem: {
      darwin:
        "LLDB NatVis evaluation fails, renders as '{...}' instead of a proper map summary.",
      linux:
        "GDB NatVis evaluation fails, renders as '{...}' instead of a proper map summary."
    },
    children: [
      {
        name: '[x]',
        type: 'QHashPrivate::Node<QString,QVariant>',
        value: '1',
        knownProblem: {
          darwin:
            'LLDB/MI does not reliably materialize QVariantHash (QHash<QString,QVariant>) CustomListItems/Node children via DAP variables().',
          linux:
            'GDB/MI does not reliably materialize QVariantHash (QHash<QString,QVariant>) CustomListItems/Node children via DAP variables().',
          win32:
            'cppvsdbg materializes QVariantHash entries as QHashPrivate::Node and the node DisplayString expands to internal QVariant storage ("{d={data=...}}") instead of a stable scalar like "1".'
        },
        children: [
          { name: 'key', value: 'x' },
          { name: 'value', value: '1' }
        ]
      },
      {
        name: '[y]',
        type: 'QHashPrivate::Node<QString,QVariant>',
        value: '2',
        knownProblem: {
          darwin:
            'LLDB/MI does not reliably materialize QVariantHash (QHash<QString,QVariant>) CustomListItems/Node children via DAP variables().',
          linux:
            'GDB/MI does not reliably materialize QVariantHash (QHash<QString,QVariant>) CustomListItems/Node children via DAP variables().',
          win32:
            'cppvsdbg materializes QVariantHash entries as QHashPrivate::Node and the node DisplayString expands to internal QVariant storage ("{d={data=...}}") instead of a stable scalar like "2".'
        },
        children: [
          { name: 'key', value: 'y' },
          { name: 'value', value: '2' }
        ]
      }
    ]
  },
  {
    name: 'containerTypes.qJsonArray',
    type: 'QJsonArray',
    value: {
      darwin: '{...}',
      linux: '',
      win32: '{a={...} }'
    },
    children: [
      {
        name: '[0]',
        value: '<unvalidated>',
        knownProblem: {
          all:
            'QJsonArray NatVis expands via an Intrinsic referencing Qt6Cored.dll; ' +
            'this is not reliable under LLDB/GDB, and is also unreliable on win32 CI. ' +
            'Child expansion is therefore not validated.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qJsonObject',
    type: 'QJsonObject',
    value: {
      darwin: '{...}',
      linux: '',
      win32: '{o={...} }'
    },
    children: [
      {
        name: '[0]',
        value: '',
        knownProblem: {
          all: 'QJsonObject Expand depends on Intrinsic cbor() using Qt6Cored.dll symbols; evaluation is unreliable on darwin/linux and on win32 CI. Children validation is disabled.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qJsonValueNull',
    type: 'QJsonValue',
    value: {
      darwin: '{...}',
      linux: 'null',
      win32: '{n=0 container=0xADDR <NULL> t=Null (278) }'
    },
    children: [
      {
        name: 'value',
        value: {
          darwin: '{...}',
          linux: 'null',
          win32: '{n=0 container=0xADDR <NULL> t=Null (278) }'
        },
        knownProblem: {
          all: 'QJsonValue Expand surfaces the internal value via ExpandedItem; debugger presentation varies across adapters.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qJsonValueInt',
    type: 'QJsonValue',
    value: '42',
    knownProblem: {
      darwin:
        'QJsonValue NatVis formatting is currently unreliable under LLDB; value collapses to {...}.',
      win32:
        "NatVis DisplayString '{value}' is not applied: debugger shows internal QJsonValue fields (n/container/t) instead of the scalar value."
    },
    children: [
      {
        name: 'value',
        value: '42',
        knownProblem: {
          all: 'QJsonValue Expand surfaces the internal value via ExpandedItem; debugger presentation varies across adapters.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qJsonValueString',
    type: 'QJsonValue',
    value: 'forty-two',
    knownProblem: {
      darwin:
        'QJsonValue NatVis formatting is currently unreliable under LLDB; value collapses to {...}.',
      linux:
        'QJsonValue NatVis formatting is currently unreliable under GDB; -var-create: unable to create variable object.',
      win32:
        "NatVis DisplayString '{value}' is not applied: debugger shows internal QJsonValue fields (n/container/t) instead of the scalar value."
    }
  },
  {
    name: 'containerTypes.qCborMapEmpty',
    type: 'QCborMap',
    value: 'empty',
    knownProblem: {
      darwin:
        'QCborMap NatVis relies on Qt6Cored.dll intrinsics; cbor() cannot be evaluated, so the "empty" DisplayString is not shown.',
      linux:
        'QCborMap NatVis relies on Qt6Cored.dll intrinsics; cbor() cannot be evaluated, so the "empty" DisplayString is not shown.',
      win32:
        'QCborMap NatVis uses Qt6Cored.dll intrinsics, but intrinsic evaluation is unreliable in VS Code tests, so the "empty" DisplayString is not shown.'
    }
  },
  {
    name: 'containerTypes.qCborMap',
    type: 'QCborMap',
    value: {
      darwin: '{...}',
      linux: '',
      win32: '{d={...} }'
    },
    children: [
      {
        name: '[k1]',
        value: '1',
        knownProblem: {
          darwin:
            'QCborMap expands via QCborContainerPrivate view(map) using Qt6Cored.dll intrinsics; LLDB evaluation is unreliable so key/value children do not materialize.',
          linux:
            'QCborMap expands via QCborContainerPrivate view(map) using Qt6Cored.dll intrinsics; GDB evaluation is unreliable so key/value children do not materialize.',
          win32:
            'QCborMap expands via QCborContainerPrivate view(map) using Qt6Cored.dll intrinsics (Qt6Cored.dll!QCborContainerPrivate / QtCbor::Element). On Windows CI these symbols are not reliably resolvable, so map key/value children do not materialize.'
        }
      }
    ]
  },
  {
    name: 'containerTypes.qCborValueNull',
    type: 'QCborValue',
    value: 'null',
    knownProblem: {
      darwin:
        'NatVis formatting is currently unreliable under LLDB; value collapses to {...}.',
      linux:
        'NatVis formatting is currently unreliable under GDB; value collapses to "undefined".',
      win32:
        "NatVis DisplayString '{value}' is not applied: debugger shows internal QCborValue fields (n/container/t) instead of the scalar value."
    }
  },
  {
    name: 'containerTypes.qCborValueString',
    type: 'QCborValue',
    value: 'forty-two',
    knownProblem: {
      darwin:
        'NatVis formatting is currently unreliable under LLDB; value collapses to {...}.',
      linux:
        'NatVis formatting is currently unreliable under GDB; -var-create: unable to create variable object.',
      win32:
        "NatVis DisplayString '{value}' is not applied: debugger shows internal QCborValueString fields (n/container/t) instead of the scalar value."
    }
  },
  {
    name: 'containerTypes.qByteArrayList',
    type: 'QByteArrayList',
    value: '{ size=2 }',
    knownProblem: {
      linux:
        'Typedef (QList<QByteArray>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to {...}.',
      darwin:
        'Typedef (QList<QByteArray>). The NatVis QList<*> rule evaluation fails, so the debugger falls back to {...}.'
    },
    children: [
      { name: '[0]', type: 'QByteArray', value: 'one' },
      { name: '[1]', type: 'QByteArray', value: 'two' }
    ]
  },
  {
    name: 'containerTypes.qPairStringInt',
    type: 'QPair<QString, int>',
    value: {
      win32: '(pair-key, 42)',
      darwin: '(0xADDR u"pair-key", 42)',
      linux: '(pair-key, 42)'
    },
    children: [
      {
        name: '[first]',
        value: 'pair-key',
        knownProblem: {
          win32:
            'QPair<QString,int> children are not reliably materialized; ' +
            'the debugger may omit [first] even when the root DisplayString is correct.'
        }
      },
      {
        name: '[second]',
        value: '42',
        knownProblem: {
          win32:
            'QPair<QString,int> children are not reliably materialized; ' +
            'the debugger may omit [second] even when the root DisplayString is correct.'
        }
      }
    ],
    knownProblem: {
      linux:
        'Typedef (QPair<QString, int>) rule evaluation fails, so the debugger falls back to {...}.'
    }
  },
  {
    name: 'containerTypes.qCborArray',
    type: 'QCborArray',
    value: 'unknown_invalid',
    knownProblem: {
      win32:
        'NatVis for QCborArray relies on a Windows-specific intrinsic (Qt6Cored.dll); visualization is fragile and not reliably applied by the debugger.',
      darwin:
        'NatVis for QCborArray uses a Windows-only intrinsic (Qt6Cored.dll), so the rule cannot be evaluated on macOS.',
      linux:
        'NatVis for QCborArray uses a Windows-only intrinsic (Qt6Cored.dll), so the rule cannot be evaluated on Linux.'
    }
  },
  {
    name: 'containerTypes.qCborValueInt',
    type: 'QCborValue',
    value: '42',
    knownProblem: {
      darwin:
        'QCborValue NatVis formatting is currently unreliable under LLDB; value often collapses to an opaque {...} form.',
      win32:
        'QCborValue NatVis currently fails. Debugger provides: n=42 container=0xADDR <NULL> t=Integer (0) instead of just "42".'
    },
    children: [
      {
        name: '[expect_none]',
        value: ''
      }
    ]
  },
  // ---------------------------------------------------------------------------
  // core_state_types
  // ---------------------------------------------------------------------------
  {
    name: 'coreStateTypes.qObject',
    type: 'QObject',
    value: 'core_state_types.qObject',
    knownProblem: {
      darwin:
        'QObject NatVis relies on Windows-only Qt6Cored.dll intrinsics (QObjectPrivate via d_ptr), so LLDB cannot evaluate objectName DisplayString.',
      linux:
        'QObject NatVis relies on Windows-only Qt6Cored.dll intrinsics (QObjectPrivate via d_ptr), so GDB cannot evaluate objectName DisplayString.',
      win32:
        'NatVis loads, but required private symbols/fields are not available ' +
        '(Qt build lacks full private debug info), so DisplayString evaluation fails and the debugger ' +
        'falls back to a raw "{d_ptr={...}}" representation instead of objectName.'
    }
  },
  // QVariant
  {
    name: 'coreStateTypes.qVariantNull',
    type: 'QVariant',
    value: '(null)',
    knownProblem: {
      win32:
        'On win32 CI, QVariant NatVis is not applied; debugger shows raw internal "{d={...}}" structure instead of DisplayString.'
    },
    children: [{ name: '[expect_none]', value: '' }]
  },
  {
    name: 'coreStateTypes.qVariantInt',
    type: 'QVariant',
    value: '42',
    knownProblem: {
      darwin:
        "QVariant NatVis evaluation fails under LLDB: rule calls typeId() but the debugger reports 'use of undeclared identifier typeId'.",
      linux:
        "QVariant NatVis evaluation fails under GDB: rule calls typeId() but the debugger reports 'use of undeclared identifier typeId'.",
      win32:
        'On win32 CI, QVariant NatVis is not applied; debugger shows raw internal "{d={...}}" structure instead of DisplayString.'
    }
  },
  {
    name: 'coreStateTypes.qVariantString',
    type: 'QVariant',
    value: 'variant-string',
    knownProblem: {
      darwin:
        "QVariant NatVis evaluation fails under LLDB: rule calls typeId() but the debugger reports 'use of undeclared identifier typeId'.",
      linux:
        "QVariant NatVis evaluation fails under GDB: rule calls typeId() but the debugger reports 'use of undeclared identifier typeId'.",
      win32:
        'On win32 CI, QVariant NatVis is not applied; debugger shows raw internal "{d={...}}" structure instead of DisplayString.'
    }
  },
  {
    name: 'coreStateTypes.qVariantBool',
    type: 'QVariant',
    value: 'true',
    knownProblem: {
      darwin:
        "QVariant NatVis evaluation fails under LLDB: rule calls typeId() but the debugger reports 'use of undeclared identifier typeId'.",
      linux:
        "QVariant NatVis evaluation fails under GDB: rule calls typeId() but the debugger reports 'use of undeclared identifier typeId'.",
      win32:
        'On win32 CI, QVariant NatVis is not applied; debugger shows raw internal "{d={...}}" structure instead of DisplayString.'
    }
  },
  // QFlags (NatVis for QFlags<*> is numeric: {($T1)i})
  {
    name: 'coreStateTypes.qFlagsNone',
    type: 'QFlags<*>',
    value: '0',
    knownProblem: {
      darwin:
        'QFlags<*> NatVis is not applied under LLDB; value falls back to {...} instead of the numeric DisplayString.',
      linux:
        'QFlags<*> NatVis is not applied under GDB; value falls back to "" instead of the numeric DisplayString.',
      win32:
        'QFlags<*> NatVis is not applied on win32; value falls back to "None (0)" instead of the numeric DisplayString.'
    }
  },
  {
    // This is the typedef created by Q_DECLARE_FLAGS(CoreStateFlags, CoreStateFlag)
    // NatVis applies via the underlying QFlags<*> rule.
    name: 'coreStateTypes.qFlags',
    type: 'QFlags<*>',
    value: '3',
    knownProblem: {
      darwin:
        'QFlags<*> NatVis is not applied under LLDB; value falls back to {...} instead of the numeric DisplayString.',
      linux:
        'QFlags<*> NatVis is not applied under GDB; value falls back to "" instead of the numeric DisplayString.',
      win32:
        'QFlags<*> NatVis is not applied on win32; value falls back to "Read | Write (3)" instead of the numeric DisplayString.'
    }
  },
  // Atomics
  {
    name: 'coreStateTypes.qAtomicInt',
    type: 'QBasicAtomicInteger<int>',
    value: '7',
    knownProblem: {
      darwin:
        'QBasicAtomicInteger<*> NatVis is not applied under LLDB; value falls back to {...} instead of the numeric DisplayString.',
      linux:
        'QBasicAtomicInteger<*> NatVis is not applied under GDB; value falls back to {...} instead of the numeric DisplayString.'
    },
    children: [
      {
        name: '[value]',
        value: '7'
      }
    ]
  },
  // Atomic pointers: non-null prints {_q_value} (address-like), null prints "empty"
  {
    name: 'coreStateTypes.qAtomicPtr',
    type: 'QBasicAtomicPointer<int>',
    value: '0xADDR',
    knownProblem: {
      darwin:
        'QBasicAtomicPointer<*> NatVis is not applied under LLDB; value falls back to {...} instead of {_q_value}/empty.',
      linux:
        'QBasicAtomicPointer<*> NatVis is not applied under GDB; value falls back to "" instead of {_q_value}/empty.',
      win32:
        'On win32 CI, atomic pointer formatting differs (shows "{123}" / raw) instead of address-like DisplayString.'
    }
  },
  {
    name: 'coreStateTypes.qAtomicVoidPtr',
    type: 'QBasicAtomicPointer<void>',
    value: '0xADDR',
    knownProblem: {
      darwin:
        'QBasicAtomicPointer<*> NatVis is not applied under LLDB; value falls back to {...} instead of {_q_value}/empty.',
      linux:
        'QBasicAtomicPointer<*> NatVis is not applied under GDB; value falls back to "" instead of {_q_value}/empty.',
      win32:
        'On win32 CI, atomic pointer formatting differs (shows empty string / raw) instead of address-like DisplayString.'
    }
  },
  {
    name: 'coreStateTypes.qAtomicPtrNull',
    type: 'QBasicAtomicPointer<int>',
    value: 'empty',
    knownProblem: {
      darwin:
        'QBasicAtomicPointer<*> NatVis is not applied under LLDB; value falls back to {...} instead of {_q_value}/empty.',
      linux:
        'QBasicAtomicPointer<*> NatVis is not applied under GDB; value falls back to "" instead of {_q_value}/empty.'
    },
    children: [{ name: '[expect_none]' }]
  },
  {
    name: 'coreStateTypes.qAtomicVoidPtrNull',
    type: 'QBasicAtomicPointer<void>',
    value: 'empty',
    knownProblem: {
      darwin:
        'QBasicAtomicPointer<*> NatVis is not applied under LLDB; value falls back to {...} instead of {_q_value}/empty.',
      linux:
        'QBasicAtomicPointer<*> NatVis is not applied under GDB; value falls back to "" instead of {_q_value}/empty.'
    },
    children: [{ name: '[expect_none]' }]
  },
  {
    name: 'coreTypes.qHostAddressIpv4',
    type: 'QHostAddress',
    value: 'undefined',
    knownProblem: {
      darwin:
        'QHostAddress NatVis does not provide a DisplayString under LLDB; value is reported as undefined.',
      linux:
        'QHostAddress NatVis does not provide a DisplayString under GDB; value is reported as undefined.',
      win32:
        'QHostAddress NatVis has no DisplayString; debugger reports undefined.'
    }
  },
  {
    name: 'coreTypes.qHostAddressIpv6',
    type: 'QHostAddress',
    value: 'undefined',
    knownProblem: {
      darwin:
        'QHostAddress NatVis does not provide a DisplayString under LLDB; value is reported as undefined.',
      linux:
        'QHostAddress NatVis does not provide a DisplayString under GDB; value is reported as undefined.',
      win32:
        'QHostAddress NatVis has no DisplayString; debugger reports undefined.'
    }
  },
  {
    name: 'guiTypes.qImageArgb32',
    type: 'QImage',
    value: '4x3',
    knownProblem: {
      darwin:
        'LLDB does not reliably apply the QImage NatVis DisplayString on macOS; ' +
        'it often falls back to an opaque "{...}" representation instead of the ' +
        'expected "{width}x{height}" summary.',
      linux:
        'GDB does not reliably apply the QImage NatVis DisplayString on Linux; ' +
        'the value may remain empty instead of showing the expected ' +
        '"{width}x{height}" summary.',
      win32:
        'The QImage NatVis DisplayString is not reliably applied; ' +
        'the debugger often reports the image as "empty" instead of showing the ' +
        'expected "{width}x{height}" summary.'
    }
  },
  {
    name: 'guiTypes.qPixmap',
    type: 'QPixmap',
    value: '4x3',
    knownProblem: {
      darwin:
        'LLDB does not reliably apply the QPixmap NatVis DisplayString on macOS; ' +
        'it often falls back to an opaque "{...}" representation instead of the ' +
        'expected "{width}x{height}" summary.',
      linux:
        'GDB does not reliably apply the QPixmap NatVis DisplayString on Linux; ' +
        'the value may remain empty instead of showing the expected ' +
        '"{width}x{height}" summary.',
      win32:
        'The QPixmap NatVis DisplayString is not reliably applied; ' +
        'the debugger falls back to an internal "{data={...}}" representation ' +
        'instead of the expected "{width}x{height}" summary.'
    }
  },
  {
    name: 'guiTypes.qPolygon',
    type: 'QPolygon',
    value: '{ size=4 }',
    knownProblem: {
      darwin:
        'LLDB NatVis evaluation for QPolygon is unstable on macOS: the rule relies ' +
        "on accessing the internal 'd' pointer, but LLDB reports 'Multiple internal " +
        "symbols found for d', producing an evaluation error instead of the " +
        "'{ size=N }' summary."
    },
    children: [
      {
        name: '[closed]',
        value: 'false',
        knownProblem: {
          linux:
            "GDB CI: QPolygon NatVis child '[closed]' is not stable/present in the locals snapshot (sometimes missing, sometimes shown).",
          win32:
            "Windows CI: QPolygon NatVis child '[closed]' is not stable/present in the locals snapshot (sometimes missing, sometimes shown)."
        }
      },

      {
        name: '[0]',
        type: 'QPoint',
        value: '{ x = 0, y = 0 }',
        knownProblem: {
          linux:
            "GDB CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers).",
          win32:
            "Windows CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers)."
        }
      },
      {
        name: '[1]',
        type: 'QPoint',
        value: '{ x = 10, y = 0 }',
        knownProblem: {
          linux:
            "GDB CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers).",
          win32:
            "Windows CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers)."
        }
      },
      {
        name: '[2]',
        type: 'QPoint',
        value: '{ x = 10, y = 10 }',
        knownProblem: {
          linux:
            "GDB CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers).",
          win32:
            "Windows CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers)."
        }
      },
      {
        name: '[3]',
        type: 'QPoint',
        value: '{ x = 0, y = 10 }',
        knownProblem: {
          linux:
            "GDB CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers).",
          win32:
            "Windows CI: QPoint NatVis formatting for QPolygon items is unstable (often renders as '{ x = {...}, y = {...} }' instead of concrete numbers)."
        }
      }
    ]
  },
  {
    name: 'guiTypes.qPolygonF',
    type: 'QPolygonF',
    value: '{ size=4 }',
    knownProblem: {
      darwin:
        'LLDB NatVis evaluation for QPolygonF is unstable on macOS: the rule relies ' +
        "on accessing the internal 'd' pointer, but LLDB reports 'Multiple internal " +
        "symbols found for d', producing an evaluation error instead of the " +
        "'{ size=N }' summary."
    },
    children: [
      { name: '[closed]', value: 'false' },

      { name: '[0]', type: 'QPointF', value: '{ x = 0.5, y = 0.5 }' },
      { name: '[1]', type: 'QPointF', value: '{ x = 10.5, y = 0.5 }' },
      { name: '[2]', type: 'QPointF', value: '{ x = 10.5, y = 10.5 }' },
      { name: '[3]', type: 'QPointF', value: '{ x = 0.5, y = 10.5 }' }
    ]
  },
  {
    name: 'guiTypes.qVector2D',
    type: 'QVector2D',
    value: '(1, 2)',
    knownProblem: {
      darwin:
        'On macOS, LLDB sometimes does not apply the QVector2D NatVis DisplayString ' +
        'and falls back to a raw field view instead of the expected "(x, y)" ' +
        'summary.',
      linux:
        'On Linux, GDB does not consistently apply the QVector2D NatVis DisplayString ' +
        'and falls back to a raw field-based representation instead of the expected ' +
        '"(x, y)" summary.',
      win32:
        'The QVector2D NatVis DisplayString is not applied; ' +
        'the debugger shows the raw field-based representation instead of the ' +
        'expected "(x, y)" summary.'
    }
  },
  {
    name: 'guiTypes.qVector3D',
    type: 'QVector3D',
    value: '(1, 2, 3)',
    knownProblem: {
      darwin:
        'On macOS, LLDB sometimes does not apply the QVector3D NatVis DisplayString ' +
        'and falls back to a raw field view instead of the expected "(x, y, z)" ' +
        'summary.',
      linux:
        'On Linux, GDB does not consistently apply the QVector3D NatVis DisplayString ' +
        'and falls back to a raw field-based representation instead of the expected ' +
        '"(x, y, z)" summary.',
      win32:
        'The QVector3D NatVis DisplayString is not applied; ' +
        'the debugger shows the raw field-based representation instead of the ' +
        'expected "(x, y, z)" summary.'
    }
  },
  {
    name: 'guiTypes.qVector4D',
    type: 'QVector4D',
    value: '(1, 2, 3, 4)',
    knownProblem: {
      darwin:
        'On macOS, LLDB sometimes does not apply the QVector4D NatVis DisplayString ' +
        'and falls back to a raw field view instead of the expected "(x, y, z, w)" ' +
        'summary.',
      linux:
        'On Linux, GDB does not consistently apply the QVector4D NatVis DisplayString ' +
        'and falls back to a raw field-based representation instead of the expected ' +
        '"(x, y, z, w)" summary.',
      win32:
        'On Windows CI, the QVector4D NatVis DisplayString is not applied; ' +
        'the debugger shows the raw field-based representation instead of the ' +
        'expected "(x, y, z, w)" summary.'
    }
  },
  {
    name: 'guiTypes.qMatrix4x4',
    type: 'QMatrix4x4',
    value: '{ m11 = 2, m12 = 0, m13 = 0, m14 = 1, ... }',
    children: [
      { name: '[m11]', value: '2' },
      { name: '[m14]', value: '1' },
      { name: '[m41]', value: '0' },
      { name: '[m44]', value: '1' }
    ]
  },
  {
    name: 'guiTypes.qMatrix2x2',
    type: 'QMatrix2x2',
    value: 'Columns: [2], Rows: [2]',
    knownProblem: {
      darwin:
        'LLDB does not support NatVis template-parameter tokens ($T1/$T2) in DisplayString for ' +
        'QGenericMatrix<*,*,*> (and its aliases like QMatrix2x2). Evaluation errors occur, so the ' +
        'debugger falls back to "undefined" instead of the "Columns/Rows" summary.',
      linux:
        'GDB fails to substitute QGenericMatrix<*,*,*> template parameters ($T1/$T2) when ' +
        'evaluating the DisplayString for aliases like QMatrix2x2, so the placeholders ' +
        'render as "void" (Columns: [void], Rows: [void]) instead of the expected dimensions.'
    },
    children: [
      { name: '[0]', value: '1' },
      { name: '[1]', value: '3' },
      { name: '[2]', value: '2' },
      { name: '[3]', value: '4' }
    ]
  },
  {
    name: 'coreTypes.qSizePolicy',
    type: 'QSizePolicy',
    value: '{ horizontal = Expanding, vertical = Minimum }',
    knownProblem: {
      darwin:
        'LLDB fails to evaluate QSizePolicy NatVis intrinsics. The DisplayString relies on ' +
        'internal enum types (Policy) and bitfields that are not visible to the expression ' +
        'evaluator, resulting in evaluation errors and a fallback to "undefined".',
      linux:
        'GDB cannot evaluate the QSizePolicy NatVis DisplayString in some configurations. ' +
        'The evaluator fails to create internal variable objects (-var-create) and cannot ' +
        'resolve symbols like ControlType, producing errors in-place of the horizontal/vertical ' +
        'policy names.',
      win32:
        'The MSVC debug engine (cppvsdbg) fails to resolve QSizePolicy enum values when evaluating ' +
        'the NatVis DisplayString. As a result, the horizontal/vertical fields render empty, and ' +
        'the summary degrades to blank placeholders instead of policy names.'
    }
  },
  {
    name: 'quickTypes.qQuickItem',
    type: 'QQuickItem',
    value: '{ x = 1.25, y = 2.5, width = 320, height = 200 }',
    knownProblem: {
      darwin:
        'LLDB fails to evaluate the QQuickItem NatVis DisplayString. The DisplayString references ' +
        'the private member d_ptr (d_ptr.d), but the expression evaluator cannot resolve it and ' +
        'reports "use of undeclared identifier \'d_ptr\'", so the debugger falls back to "undefined".',
      linux:
        'The debugger cannot materialize the delegated NatVis expression `{d_ptr.d,na}` for QQuickItem ' +
        'and fails to create a variable object for the underlying private data. It reports ' +
        '"-var-create: unable to create variable object", so the expected QQuickItemPrivate summary ' +
        '(x/y/width/height) is not available at the root.',
      win32:
        'The debugger shows an opaque "{...}" placeholder for QQuickItem instead of evaluating the ' +
        'delegated NatVis DisplayString `{d_ptr.d,na}`. As a result, the expected QQuickItemPrivate ' +
        'summary (x/y/width/height) is not produced at the root.'
    }
  },
  {
    name: 'coreTypes.qPropertyInt',
    type: 'QProperty<int>',
    value: { darwin: '{...}', linux: '123', win32: '123' },
    children: [
      {
        name: 'QPropertyData<int>',
        type: 'QPropertyData<int>',
        value: '123',
        knownProblem: {
          darwin:
            "LLDB fails to evaluate the NatVis synthetic QPropertyData<T> view under QProperty<T> (reports \"no member named 'QPropertyData' in 'QProperty<...>'\"), so the QPropertyData node/value cannot be materialized reliably.",
          win32:
            'cppvsdbg does not consistently materialize the NatVis synthetic QPropertyData<T> view under QProperty<T>; the node may appear or disappear depending on evaluation.',
          linux:
            'GDB/MI materializes QPropertyData<T> differently than expected; the synthetic NatVis node may appear instead of being hidden, leading to unstable presence/value.'
        },
        children: [{ name: '[value]', value: '123' }]
      }
    ]
  },
  {
    name: 'coreTypes.qPropertyString',
    type: 'QProperty<QString>',
    value: { darwin: '{...}', linux: 'prop', win32: 'prop' },
    children: [
      {
        name: 'QPropertyData<QString>',
        type: 'QPropertyData<QString>',
        value: 'prop',
        knownProblem: {
          darwin:
            "LLDB fails to evaluate the NatVis synthetic QPropertyData<T> view under QProperty<T> (reports \"no member named 'QPropertyData' in 'QProperty<...>'\"), so the QPropertyData node/value cannot be materialized reliably.",
          win32:
            'cppvsdbg does not consistently materialize the NatVis synthetic QPropertyData<T> view under QProperty<T>; the node may appear or disappear depending on evaluation.',
          linux:
            'GDB/MI materializes QPropertyData<T> differently than expected; the synthetic NatVis node may appear instead of being hidden, leading to unstable presence/value.'
        },
        children: [{ name: '[value]', value: 'prop' }]
      }
    ]
  }
] as const;

export const GOLDEN_ENTRIES: readonly GoldenEntry[] = GOLDEN_ENTRY_DEFS.map(
  (e) => new GoldenEntry(e)
);
