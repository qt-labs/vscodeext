// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export function createController() {
  const states = $state({
    kind: '',
    dark: false,
    observer: undefined as (MutationObserver | undefined)
  });

  function startMonitor() {
    if (states.observer) {
      return false;
    }

    states.observer = new MutationObserver(_updateStatesAndExecCallback);
    states.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    _updateStatesAndExecCallback();
    return true;
  }

  function stopMonitor() {
    if (states.observer) {
      states.observer.disconnect();
      states.observer = undefined;
    }
  }

  function getBodyCss() {
    return getComputedStyle(document.body);
  }

  function _updateStatesAndExecCallback() {
    states.kind = _getThemeKind();
    states.dark = states.kind.endsWith('dark');

    _onChangedCallback();
  }

  function _getThemeKind() {
    const classes = document.body.classList;
    if (classes.contains('vscode-high-contrast-light')) {
      return 'high-contrast-light';
    }

    if (classes.contains('vscode-high-contrast')) {
      return 'high-contrast-dark';
    }

    if (classes.contains('vscode-light')) {
      return 'light';
    }

    return 'dark';
  }

  function onChanged(callback: () => void) {
    _onChangedCallback = callback;
  }

  let _onChangedCallback = () => {}

  return {
    states,
    getBodyCss,

    monitor: {
      start: startMonitor,
      stop: stopMonitor,
      onChanged
    }
  }
}
