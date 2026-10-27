// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { HistoryEdit, HistoryEntry } from '@/webview/shared/doc-viewer';
import { UriStore as UriStore } from './uri-store';

const MaxEntries = 500;

export class DocViewerHistoryManager extends UriStore<HistoryEntry> {
  public edit(edit: HistoryEdit) {
    switch (edit.action) {
      case 'add': {
        const last = this._entries[this._entries.length - 1];
        const timestamp = Date.now();
        if (last?.uri === edit.entry.uri) {
          last.timestamp = timestamp;
        } else {
          this._entries.push({ ...edit.entry, timestamp });
          if (this._entries.length > MaxEntries) {
            this._entries.splice(0, this._entries.length - MaxEntries);
          }
        }

        return true;
      }

      case 'remove': {
        const uris = new Set(edit.selection.map((e) => e.uri));
        this._entries = this._entries.filter((e) => !uris.has(e.uri));
        return true;
      }

      case 'clear':
        this._entries = [];
        return true;

      default:
        break;
    }

    return false;
  }
}
