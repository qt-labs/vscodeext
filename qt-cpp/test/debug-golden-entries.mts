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
        'GDB fails to evaluate QDate intrinsics (year(), month(), day()) and prints evaluation errors instead of the formatted date.'
    }
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
        'QJsonDocument NatVis relies on MSVC-specific internals (d._Mypair._Myval2) and a Qt6Cored.dll private type in Expand; LLDB cannot evaluate these, so value stays as raw "{...}" on non-Windows.',
      linux:
        'QJsonDocument NatVis relies on MSVC-specific internals (d._Mypair._Myval2) and a Qt6Cored.dll private type in Expand; GDB cannot evaluate these, so value stays as raw "{...}" on non-Windows.'
    }
  },
  {
    name: 'coreTypes.qLine',
    type: 'QLine',
    value: '{ start point = { x = 0, y = 1 }, end point = { x = 42, y = 43 } }',
    knownProblem: {
      linux:
        'On Linux/GDB with Qt 6.10, QLine NatVis depends on QPoint formatting for pt1/pt2; ' +
        'since QPoint NatVis collapses to "{...}", QLine also renders as ' +
        '"{ start point = { x = {...}, y = {...} }, end point = { x = {...}, y = {...} } }" ' +
        'instead of numeric coordinates.',
      darwin:
        'On macOS/LLDB with Qt 6.10, QLine NatVis depends on QPoint formatting for pt1/pt2; ' +
        'since QPoint NatVis collapses to "{...}", QLine also renders as "{ start point = { x = {...}, y = {...} }, ... }" ' +
        'instead of numeric coordinates.',
      win32:
        'Qt 6.10 on Windows wraps the underlying integer fields used by the QLine NatVis rule ' +
        '(e.g. QPoint/QSize internal members), so the debugger prints nested wrappers like "{m_i=...}" ' +
        'instead of plain integers. This indicates the NatVis rule is not producing the intended ' +
        'formatting on win32 with Qt 6.10'
    }
  },
  {
    name: 'coreTypes.qPoint',
    type: 'QPoint',
    value: '{ x = 24, y = 48 }',
    knownProblem: {
      linux:
        'On Linux/GDB with Qt 6.10, QPoint NatVis does not evaluate the integer members reliably; ' +
        'the debugger collapses x/y to "{...}" instead of printing numeric values.',
      darwin:
        'On macOS/LLDB with Qt 6.10, QPoint NatVis does not evaluate the integer members reliably; ' +
        'the debugger collapses the fields to "{...}" instead of printing numeric x/y.',
      win32:
        'Qt 6.10 on Windows wraps QPoint integer members (xp/yp), so the NatVis DisplayString ' +
        'renders as "{ x = {m_i=...}, y = {m_i=...} }" instead of plain integers. NatVis rule needs ' +
        'an update for Qt 6.10.1 win32.'
    }
  },
  {
    name: 'coreTypes.qPointF',
    type: 'QPointF',
    value: '{ x = 24.5, y = 48.5 }'
  },
  {
    name: 'coreTypes.qRect',
    type: 'QRect',
    value: '{ x = 5, y = 6, width = 41, height = 42 }',
    knownProblem: {
      linux:
        'On Linux/GDB with Qt 6.10, QRect NatVis arithmetic fails: expressions like ' +
        '"x2 - x1 + 1" and "y2 - y1 + 1" trigger GDB internal errors ' +
        '(incompatible overload candidates proposed), so the formatted rectangle ' +
        'cannot be produced.',
      darwin:
        'On macOS/LLDB with Qt 6.10, QRect NatVis DisplayString arithmetic fails because the members ' +
        'participate in checked-integer wrappers; evaluating "x2 - x1 + 1" triggers an LLDB error ' +
        '(invalid operands to binary expression involving QtPrivate::QCheckedIntegers::QCheckedInt<int>), ' +
        'so the formatted "{ x=..., y=..., width=..., height=... }" string cannot be produced.',
      win32:
        'Qt 6.10 on Windows wraps QRect integer members (x1/y1/x2/y2), so the NatVis rule does not ' +
        'format the rectangle as "{ x = ..., y = ..., width = ..., height = ... }" and instead exposes ' +
        'wrapped internals like "{m_i=...}". NatVis rule needs a Qt 6.10.1 win32-compatible accessor.'
    }
  },
  {
    name: 'coreTypes.qRectF',
    type: 'QRectF',
    value: '{ x = 5.1, y = 5.5, width = 4.1, height = 4.2 }'
  },
  {
    name: 'coreTypes.qSize',
    type: 'QSize',
    value: '{ width = 42, height = 43 }',
    knownProblem: {
      linux:
        'On Linux/GDB with Qt 6.10, QSize NatVis does not evaluate the integer members reliably; ' +
        'the debugger collapses width/height to "{...}" instead of numeric values.',
      darwin:
        'On macOS/LLDB with Qt 6.10, QSize NatVis does not evaluate the integer members reliably; ' +
        'the debugger collapses width/height to "{...}" instead of printing numeric values.',
      win32:
        'Qt 6.10.1 on Windows wraps QSize integer members (wd/ht), so the NatVis DisplayString shows ' +
        '"{ width = {m_i=...}, height = {m_i=...} }" instead of plain integers. NatVis rule needs ' +
        'a Qt 6.10.1 win32-compatible accessor.'
    }
  },
  {
    name: 'coreTypes.qSizeF',
    type: 'QSizeF',
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
        'GDB currently fails to evaluate {m_data,[m_size]} and prints an evaluation error instead of the string contents.'
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
        'LLDB cannot evaluate the pointer-arithmetic intrinsics used to access scheme()/host()/path() relying on MSVC-specific.',
      linux:
        'GDB cannot evaluate the pointer-arithmetic intrinsics used to access scheme()/host()/path() relying on MSVC-specific.',
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
        'QUuid NatVis uses Visual Studio–only format specifiers (Xb/nvoXb) unsupported by LLDB, causing evaluation errors on macOS.',
      linux:
        'QUuid NatVis uses Visual Studio–only format specifiers (Xb/nvoXb) unsupported by GDB, causing evaluation errors on Linux.'
    }
  },
  {
    name: 'containerTypes.qIntList',
    type: 'QList<int>',
    value: '{ size=3 }'
  },
  {
    name: 'containerTypes.qVariantList',
    type: 'QList<QVariant>',
    value: '{ size=2 }'
  },
  {
    name: 'containerTypes.qStringListExplicit',
    type: 'QList<QString>',
    value: '{ size=2 }'
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
    }
  },
  {
    name: 'containerTypes.qVectorInt',
    type: 'QVector<int>',
    value: '{ size=3 }',
    knownProblem: {
      linux:
        'The NatVis QVector<*> rule evaluation fails, so the debugger falls back to {...}.'
    }
  },
  {
    name: 'containerTypes.qSpanInt',
    type: 'QSpan<int>',
    value: '{ size=3 }',
    knownProblem: {
      darwin:
        "LLDB NatVis evaluation fails (e.g. 'use of undeclared identifier m_size'), so QSpan<int> isn't reliably visualized on macOS."
    }
  },
  {
    name: 'containerTypes.qVectorPoint',
    type: 'QVector<QPoint>',
    value: '{ size=2 }',
    knownProblem: {
      linux:
        'The NatVis QVector<*> rule evaluation fails, so the debugger falls back to {...}.'
    }
  },
  {
    name: 'containerTypes.qVarLengthArrayInt',
    type: 'QVarLengthArray<int, 4>',
    value: '{ size=3 }',
    knownProblem: {
      darwin:
        "LLDB NatVis errors out: expression 's' is not resolvable ('use of undeclared identifier s'), evaluation fails."
    }
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
    }
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
    }
  },
  {
    name: 'containerTypes.qHashStringInt',
    type: 'QHash<QString, int>',
    value: '{ size=2 }'
  },
  {
    name: 'containerTypes.qMultiHashStringInt',
    type: 'QMultiHash<QString, int>',
    value: '{ size=1 }'
  },
  {
    name: 'containerTypes.qSetString',
    type: 'QSet<QString>',
    value: '{ size=2 }'
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
    }
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
    }
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
    }
  },
  {
    name: 'containerTypes.qJsonArray',
    type: 'QJsonArray',
    value: {
      darwin: '{...}',
      linux: '',
      win32: '{a={...} }'
    }
  },
  {
    name: 'containerTypes.qJsonObject',
    type: 'QJsonObject',
    value: {
      darwin: '{...}',
      linux: '',
      win32: '{o={...} }'
    }
  },
  {
    name: 'containerTypes.qJsonValueNull',
    type: 'QJsonValue',
    value: {
      darwin: '{...}',
      linux: 'null',
      win32: '{n=0 container=0xADDR <NULL> t=Null (278) }'
    }
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
    }
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
    }
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
    }
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
    }
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
    type: 'CoreStateFlags',
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
    type: 'CoreStateFlags',
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
    }
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
    }
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
    }
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
    }
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
    }
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
    value: '{ m11 = 2, m12 = 0, m13 = 0, m14 = 1, ... }'
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
    }
  }
] as const;

export const GOLDEN_ENTRIES: readonly GoldenEntry[] = GOLDEN_ENTRY_DEFS.map(
  (e) => new GoldenEntry(e)
);
