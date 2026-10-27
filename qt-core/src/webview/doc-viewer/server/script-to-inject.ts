// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { IframeMessageId } from '@/webview/shared/doc-viewer';

let cached: string | undefined;

export function getScriptToInject() {
  if (!cached) {
    const all = [
      CommonScript,
      DocLoadedScript,
      DocReloadScript,
      DocHashChangedScript,
      ScrollToTopScript,
      FindInPageScript,
      ApplyThemeScript,
      LinkClickedScript,
      LinkHoverChangedScript,
      ForwardKeyDownScript,
      ScrolledScript,
      ContextMenuScript,
      CopySelectionScript,
      SelectionChangedScript
    ];

    cached = /*html*/ `
      <script>
        ${all.join('\n')}
      </script>
    `;
  }

  return cached;
}

// all scripts to inject
const CommonScript = /*js*/ `
  function notifyParent(id, fields) {
    window.parent.postMessage({ id, ...fields }, '*');
  }

  function addListener(eventName, handler) {
    window.addEventListener(eventName, handler, true);
  }

  function addListenerNoCapture(eventName, handler) {
    window.addEventListener(eventName, handler, false);
  }

  function onParentMessage(id, handler) {
    addListenerNoCapture('message', (e) => {
      if (e.data?.id === id) {
        handler(e.data);
      }
    });
  }

  function getDocLoadState() {
    return {
      href: location.href,
      title: document.title,
      scrollTop: window.scrollY,
      errorCode: document.body?.dataset.errorCode,
    };
  }
`;

const DocLoadedScript = /*js*/ `
  addListenerNoCapture('load', () => {
    notifyParent('${IframeMessageId.EventLoaded}', getDocLoadState());
  });
`;

const DocReloadScript = /*js*/ `
  onParentMessage('${IframeMessageId.RequestReloadPage}', () => {
    location.reload();
  });
`;

const DocHashChangedScript = /*js*/ `
  addListenerNoCapture('hashchange', () => {
    notifyParent('${IframeMessageId.EventHashChanged}', getDocLoadState());
  });
`;

const FindInPageScript = /*js*/ `
  function findInPage(keyword, dir) {
    return window.find(
      keyword,
      false, // caseSensitive
      dir === 'backward',
      true, // wrapAround
      false, // wholeWord
      false, // searchInFrames
      false, // showDialog
    );
  }

  onParentMessage('${IframeMessageId.RequestFindInPage}', ({ keyword, action }) => {
    switch (action) {
      case 'new':
        window.getSelection()?.removeAllRanges();
        findInPage(keyword, 'forward');
        break;

      case 'prev':
        findInPage(keyword, 'backward');
        break;

      case 'next':
        findInPage(keyword, 'forward');
        break;

      case 'clear':
        window.getSelection()?.removeAllRanges();
        break;
    }
  });
`;

const ScrollToTopScript = /*js*/ `
  onParentMessage('${IframeMessageId.RequestScrollToTop}', ({ vars }) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });j
  });
`;

const ApplyThemeScript = /*js*/ `
  onParentMessage('${IframeMessageId.RequestApplyVscodeTheme}', ({ vars }) => {
    for (const [name, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(name, value);
    }
  });
`;

const LinkClickedScript = /*js*/ `
  function findAnchor(e) {
    return e.target instanceof Element ? e.target.closest('a[href]') : null;
  }

  function notifyLinkClicked(anchor, newWindow) {
    const url = new URL(anchor.href, document.baseURI);
    notifyParent('${IframeMessageId.EventClicked}', { href: url.href, newWindow });
  }

  addListenerNoCapture('click', (e) => {
    const anchor = findAnchor(e);
    if (!anchor) {
      return;
    }

    const newWindow = e.ctrlKey || e.metaKey || e.shiftKey || anchor.target === '_blank';
    notifyLinkClicked(anchor, newWindow);
    e.preventDefault();
  });

  addListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  });

  addListenerNoCapture('auxclick', (e) => {
    if (e.button !== 1) {
      return;
    }

    const anchor = findAnchor(e);
    if (!anchor) {
      return;
    }

    notifyLinkClicked(anchor, true);
    e.preventDefault();
  });
`;

const LinkHoverChangedScript = /*js*/ `
  function onMouseInOut(e) {
    if (!(e.target instanceof HTMLElement)) {
      return;
    }

    const link = e.target.closest('a');
    const isLeavingWithinLink = (e.type === 'mouseout')
      && link
      && e.relatedTarget
      && link.contains(e.relatedTarget);

    if (!link || isLeavingWithinLink) {
      return;
    }

    notifyParent('${IframeMessageId.EventHoverChanged}', {
      href: (e.type === 'mouseover') ? link.href : '',
    });
  }

  addListenerNoCapture('mouseout', onMouseInOut);
  addListenerNoCapture('mouseover', onMouseInOut);
`;

const ForwardKeyDownScript = /*js*/ `
  addListener('keydown', (e) => {
    notifyParent('${IframeMessageId.EventKeyDown}', {
      fields: {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        repeat: e.repeat,
      },
    });
  });
`;

const ScrolledScript = /*js*/ `
  addListener('scroll', (e) => {
    notifyParent('${IframeMessageId.EventScrolled}', {
      scrollTop: window.scrollY
    });
  });
`;

const ContextMenuScript = /*js*/ `
  addListener('contextmenu', (e) => {
    e.preventDefault();
    notifyParent('${IframeMessageId.EventContextMenu}', {
      x: e.clientX,
      y: e.clientY
    });
  });

  addListener('mousedown', () => {
    notifyParent('${IframeMessageId.EventMouseDown}');
  });
`;

const CopySelectionScript = /*js*/ `
  onParentMessage('${IframeMessageId.RequestCopySelected}', async () => {
    const text = window.getSelection()?.toString() ?? '';
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.execCommand('copy');
    }
  });
`;

const SelectionChangedScript = /*js*/ `
  let hadSelection = false;

  addListener('selectionchange', () => {
    const hasSelection = !!window.getSelection()?.toString();
    if (hasSelection === hadSelection) {
      return;
    }

    hadSelection = hasSelection;
    notifyParent('${IframeMessageId.EventSelectionChanged}', {
      hasSelection
    });
  });
`;
