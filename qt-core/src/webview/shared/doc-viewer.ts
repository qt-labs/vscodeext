// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

const OpenOriginNames = ['unspecified', 'qt-help', 'ex-browser'] as const;
const OpenInTargetNames = [
  'new',
  'current',
  'vscode-env',
  'file-manager'
] as const;

export type OpenOrigin = (typeof OpenOriginNames)[number];
export type OpenInTarget = (typeof OpenInTargetNames)[number];

export interface OpenOptions {
  origin: OpenOrigin;
  homeUri?: string;
  syncPanelTitle?: boolean;
  forceNewWindow?: boolean;
}

export interface NamedUri {
  uri: string;
  title: string;
}

export type BookmarkEntry = NamedUri;
export interface HistoryEntry extends NamedUri {
  timestamp?: number;
}

export type BookmarkEdit =
  | { action: 'toggle'; entry: BookmarkEntry }
  | { action: 'remove'; selection: BookmarkEntry[] }
  | { action: 'move'; from: number; to: number }
  | { action: 'sort' }
  | { action: 'clear' };

export type HistoryEdit =
  | { action: 'add'; entry: HistoryEntry }
  | { action: 'remove'; selection: HistoryEntry[] }
  | { action: 'clear' };

export enum IframeMessageId {
  RequestFindInPage = 'request-find-in-page',
  RequestReloadPage = 'request-reload-page',
  RequestScrollToTop = 'request-scroll-to-top',
  RequestCopySelected = 'request-copy-selected',
  RequestApplyVscodeTheme = 'request-apply-vscode-theme',
  EventLoaded = 'event-loaded',
  EventClicked = 'event-clicked',
  EventKeyDown = 'event-key-down',
  EventScrolled = 'event-scrolled',
  EventMouseDown = 'event-mouse-down',
  EventContextMenu = 'event-contextmenu',
  EventHashChanged = 'event-hash-changed',
  EventHoverChanged = 'event-hover-changed',
  EventSelectionChanged = 'event-selection-changed'
}

// type guard functions
export function isOpenOrigin(x: unknown): x is OpenOrigin {
  return (
    typeof x === 'string' && (OpenOriginNames as readonly string[]).includes(x)
  );
}

export function isOpenInTarget(x: unknown): x is OpenInTarget {
  return (
    typeof x === 'string' &&
    (OpenInTargetNames as readonly string[]).includes(x)
  );
}

export function isOpenOptions(x: unknown): x is OpenOptions {
  if (!isValidObject(x)) {
    return false;
  }

  return (
    isOpenOrigin(x.origin) &&
    (x.homeUri === undefined || typeof x.homeUri === 'string') &&
    (x.syncPanelTitle === undefined || typeof x.syncPanelTitle === 'boolean') &&
    (x.forceNewWindow === undefined || typeof x.forceNewWindow === 'boolean')
  );
}

export function isBookmarkEntry(x: unknown): x is BookmarkEntry {
  if (!isValidObject(x)) {
    return false;
  }

  return typeof x.uri === 'string' && typeof x.title === 'string';
}

export function isBookmarkEdit(x: unknown): x is BookmarkEdit {
  if (typeof x !== 'object' || x === null || !('action' in x)) {
    return false;
  }

  const e = x as Record<string, unknown>;
  switch (e.action) {
    case 'toggle':
      return isBookmarkEntry(e.entry);

    case 'move':
      return isIndex(e.from) && isIndex(e.to);

    case 'remove':
      return Array.isArray(e.selection) && e.selection.every(isBookmarkEntry);

    case 'sort':
    case 'clear':
      return true;

    default:
      return false;
  }
}

export function isHistoryEntry(x: unknown): x is HistoryEntry {
  if (!isValidObject(x)) {
    return false;
  }

  return (
    typeof x.uri === 'string' &&
    typeof x.title === 'string' &&
    (x.timestamp === undefined || typeof x.timestamp === 'number')
  );
}

export function isHistoryEdit(x: unknown): x is HistoryEdit {
  if (typeof x !== 'object' || x === null || !('action' in x)) {
    return false;
  }

  const e = x as Record<string, unknown>;
  switch (e.action) {
    case 'add':
      return isHistoryEntry(e.entry);

    case 'remove':
      return Array.isArray(e.selection) && e.selection.every(isHistoryEntry);

    case 'clear':
      return true;

    default:
      return false;
  }
}

function isValidObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function isIndex(v: unknown) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}
