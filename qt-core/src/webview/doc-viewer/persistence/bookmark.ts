// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { BookmarkEdit, BookmarkEntry } from '@/webview/shared/doc-viewer';
import { UriStore } from './uri-store';

const MaxEntries = 500;

export class DocViewerBookmarkManager extends UriStore<BookmarkEntry> {
  public edit(edit: BookmarkEdit) {
    switch (edit.action) {
      case 'toggle': {
        if (edit.entry.uri.length === 0) {
          break;
        }

        const index = this._findIndex(edit.entry.uri);
        if (index === -1) {
          if (this._entries.length >= MaxEntries) {
            return false;
          }

          this._entries.push(edit.entry);
        } else {
          this._entries.splice(index, 1);
        }

        return true;
      }

      case 'move': {
        if (edit.from === edit.to) {
          return false;
        }

        const [item] = this._entries.splice(edit.from, 1);
        if (item) {
          const to = edit.from < edit.to ? edit.to - 1 : edit.to;
          this._entries.splice(to, 0, item);
          return true;
        }
        break;
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
