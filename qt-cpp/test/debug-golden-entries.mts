// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// Central, hand-curated list of golden expectations for the NatVis test.

import { GoldenEntry, type GoldenEntryBase } from './debug-golden.mts';

const GOLDEN_ENTRY_DEFS: readonly GoldenEntryBase[] = [
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
    value: '2024-06-15'
  },
  {
    name: 'coreTypes.qDateTimeBrunei',
    type: 'QDateTime',
    value: 'QDateTime(Brunei placeholder)'
  },
  {
    name: 'coreTypes.qDateTimeDefault',
    type: 'QDateTime',
    value: 'QDateTime(Default placeholder)'
  },
  {
    name: 'coreTypes.qDateTimeMarquesas',
    type: 'QDateTime',
    value: 'QDateTime(Marquesas placeholder)'
  },
  {
    name: 'coreTypes.qDateTimeSecOffset',
    type: 'QDateTime',
    value: 'QDateTime(TimeSecOffset placeholder)'
  },
  {
    name: 'coreTypes.qDateTimeShouldFail',
    type: 'QDateTime',
    value: 'unknown_invalid'
  },
  {
    name: 'coreTypes.qDateTimeSouthPole',
    type: 'QDateTime',
    value: 'QDateTime(SouthPole placeholder)'
  },
  {
    name: 'coreTypes.qDateTimeUtc',
    type: 'QDateTime',
    value: 'QDateTime(TimeUtc placeholder)'
  },
  {
    name: 'coreTypes.qDateTimeYukon',
    type: 'QDateTime',
    value: 'QDateTime(Yukon placeholder)'
  },
  {
    name: 'coreTypes.qDir',
    type: 'QDir',
    value: '"/path/to/normalize/projectFolderNatvis"'
  },
  {
    name: 'coreTypes.qFile',
    type: 'QFile',
    value: '"/path/to/normalize/projectFolderNatvis"'
  },
  {
    name: 'coreTypes.qFileInfo',
    type: 'QFileInfo',
    value: '"/path/to/normalize/projectFolderNatvis"'
  },
  {
    name: 'coreTypes.qFlags',
    type: 'SelectionFlags',
    value: 'SelectCurrent | SelectAll (3)'
  },
  {
    name: 'coreTypes.qJsonDocument',
    type: 'QJsonDocument',
    value: {
    darwin: '{...}',
    win32: '{d=unique_ptr {...} }',
    linux: ''
  }
  },
  {
    name: 'coreTypes.qJsonDocumentEmpty',
    type: 'QJsonDocument',
    value: {
    darwin: '{empty}',
    linux: '{empty}',
    win32: '{d=empty }'
  }
  },
  {
    name: 'coreTypes.qLine',
    type: 'QLine',
    value:
      '{ start point = { x = 0, y = 1 }, end point = { x = 42, y = 43 } }'
  },
  {
    name: 'coreTypes.qPoint',
    type: 'QPoint',
    value: '{ x = 24, y = 48 }'
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
    name: 'coreTypes.qString',
    type: 'QString',
    value: 'Hello World! Again.'
  },
  {
    name: 'coreTypes.qStringView',
    type: 'QStringView',
    value: 'Hello World! Again.'
  },
  {
    name: 'coreTypes.qTime',
    type: 'QTime',
    value: '{ milliseconds = 45296000 }'
  },
  {
    name: 'coreTypes.qUrl',
    type: 'QUrl',
    value: 'https://github.com/narnaud/natvis4qt'
  },
  {
    name: 'coreTypes.qUuid',
    type: 'QUuid',
    value: '{12345678-1234-1234-1234-1234567890AB}'
  }
] as const;

/**
 * Concrete GoldenEntry objects derived from the declarative definitions above.
 *
 * Tests should *not* construct GoldenEntry directly; they should always
 * use this exported constant (or a helper that wraps it) so we have a single
 * source of truth for the logical golden expectations.
 */
export const GOLDEN_ENTRIES: readonly GoldenEntry[] =
  GOLDEN_ENTRY_DEFS.map((e) => new GoldenEntry(e));