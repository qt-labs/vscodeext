// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import { vscode } from '@/apps/vscode';
import {
  IframeMessageId,
  type OpenInTarget,
  type HistoryEntry
} from '@shared/doc-viewer';
import { CommandId, type CommandReply } from '@shared/message';

import { data, ui } from './states.svelte';
import { type FindAction } from './types.svelte';
import * as helpers from './helpers';
import * as history from './viewlogic.history.svelte';
import * as bookmark from './viewlogic.bookmark.svelte';

export { history, bookmark };

export async function onAppMount() {
  ui.theme.monitor.start();
  ui.theme.monitor.onChanged(onVscodeThemeChanged);

  window.addEventListener('keydown', onKeydown);
  window.addEventListener('message', onMessageFromIframe);
  vscode.onDidReceiveNotification(onMessageFromVscode);

  await loadConfigs();
  await history.load();
  await bookmark.load();

  if (data.configs.homeUri) {
    void openDoc(data.configs.homeUri);
  }
}

export async function onAppDestroy() {
}

export async function reset() {
  ui.iframe.uri = '';
  resetIframeState();
  syncIframeState();
}

export function currentUri() {
  return ui.iframe.uri;
}

export async function openDoc(uri: string, target: OpenInTarget = 'current') {
  if (!URL.canParse(uri)) {
    return false;
  }

  const r = await vscode.post(CommandId.DocViewerOpenDoc, { uri, target });
  const kind = String(_.get(r, 'kind', '')).trim();
  const serviceUri = String(_.get(r, 'serviceUri', '')).trim();

  switch (kind) {
    case 'load':
      if (ui.iframe.uri !== serviceUri) {
        resetIframeState();
        ui.iframe.uri = serviceUri;
      }
      return;

    case 'error':
      setIframeError(String(_.get(r, 'errorCode', '')).trim());
      syncIframeState();
      break;

    default:
      return;
  }
}

export function navigate(dir: 'back' | 'forward') {
  openDoc(ui.navigation.go(dir)?.uri ?? '');
}

export function navigateTo(e: HistoryEntry) {
  openDoc(ui.navigation.goTo(e)?.uri ?? '');
}

export function copySelection() {
  postToIframe(IframeMessageId.RequestCopySelected);
}

export function scrollToTop() {
  postToIframe(IframeMessageId.RequestScrollToTop);
}

export function setSidebar(mode: 'bookmark' | 'history' | undefined) {
  ui.sidebar.mode = mode;
}

export function findInPage(action: FindAction) {
  postToIframe(IframeMessageId.RequestFindInPage, {
    keyword: ui.popovers.find.keyword,
    action
  });
}

// helpers
async function loadConfigs() {
  const r = await vscode.post(CommandId.DocViewerGetConfig);
  const c = data.configs;
  c.homeUri = String(_.get(r, 'homeUri', c.homeUri)).trim();
  c.serverOrigin = String(_.get(r, 'serverOrigin', c.serverOrigin)).trim();
}

function onVscodeThemeChanged() {
  postToIframe(IframeMessageId.RequestApplyVscodeTheme, {
    vars: ui.theme.getAllVscodeCssVars()
  });
}

function onMessageFromVscode(reply: CommandReply) {
  if (reply.id === CommandId.DocViewerReloadPage) {
    postToIframe(IframeMessageId.RequestReloadPage);
  }
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLocaleLowerCase() === 'f') {
    ui.popovers.find.visible = true;
  }
}

function resetIframeState() {
  ui.iframe.title = '';
  ui.iframe.errorCode = '';
  ui.iframe.hoveredUri = '';
  ui.iframe.scrollTop = 0;
}

function setIframeError(errorCode: string) {
  ui.iframe.title = 'Error';
  ui.iframe.errorCode = errorCode;
  ui.iframe.hoveredUri = '';
  ui.iframe.scrollTop = 0;
}

function syncIframeState() {
  void vscode.post(CommandId.DocViewerSetViewerState, {
    uri: helpers.toFileUriIfServer(ui.iframe.uri),
    title: ui.iframe.title,
  });
}

function onMessageFromIframe(e: MessageEvent) {
  switch (e.data?.id) {
    case IframeMessageId.EventLoaded:
    case IframeMessageId.EventHashChanged: {
      const errorCode = String(_.get(e.data, 'errorCode', '')).trim();
      if (errorCode) {
        setIframeError(errorCode);
      } else {
        const h: HistoryEntry = {
          uri: helpers.toFileUriIfServer(e.data.href),
          title: e.data.title,
          timestamp: Date.now()
        };

        resetIframeState();
        ui.iframe.title = h.title;
        ui.iframe.scrollTop = e.data.scrollTop;

        ui.navigation.push(h);
        history.edit({ action: 'add', entry: h });
        postToIframe(IframeMessageId.RequestApplyVscodeTheme, {
          vars: ui.theme.getAllVscodeCssVars()
        });
      }

      syncIframeState();
      break;
    }

    case IframeMessageId.EventHoverChanged:
      if (typeof e.data.href === 'string') {
        ui.iframe.hoveredUri = e.data.href;
      }
      break;

    case IframeMessageId.EventClicked:
      if (typeof e.data.href === 'string') {
        openDoc(
          e.data.href,
          e.data.newWindow === true ? 'new' : 'current'
        );
      }
      break;

    case IframeMessageId.EventKeyDown: {
      const fields = e.data.fields;

      if (fields.key.toLowerCase() === 'c') {
        if (fields.metaKey || fields.ctrlKey) {
          postToIframe(IframeMessageId.RequestCopySelected);
          return;
        }
      }

      document.dispatchEvent(new KeyboardEvent('keydown', {
        ...fields,
        bubbles: true,
        cancelable: true,
      }));
      break;
    }

    case IframeMessageId.EventScrolled: {
      ui.iframe.scrollTop = e.data.scrollTop;
      break;
    }

    case IframeMessageId.EventContextMenu: {
      const r = ui.iframe.el?.getBoundingClientRect();
      if (r) {
        const menu = ui.popovers.contextMenu;
        menu.hoveredUri = ui.iframe.hoveredUri;
        menu.pos = {
          x: r.left + e.data.x,
          y: r.top + e.data.y
        };
        menu.show();
      }
      break;
    }

    case IframeMessageId.EventMouseDown:
      ui.popovers.contextMenu.hide();
      break;

    case IframeMessageId.EventSelectionChanged:
      ui.popovers.contextMenu.hasSelection = e.data.hasSelection;
      break;

    default:
      break;
  }
}

function postToIframe(id: IframeMessageId, data = {}) {
  ui.iframe.el?.contentWindow?.postMessage(
    { id, ...data }, '*'
  );
}
