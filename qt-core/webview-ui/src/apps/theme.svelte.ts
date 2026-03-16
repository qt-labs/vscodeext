// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

const states = $state({
  kind: '',
  dark: false,
  observer: undefined as (MutationObserver | undefined)
});

function getBodyCss() {
  return getComputedStyle(document.body);
}

function refreshStates() {
  states.kind = readThemeKind();
  states.dark = states.kind.endsWith('dark');
}

function readThemeKind() {
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

function start() {
  if (states.observer) {
    return;
  }

  states.observer = new MutationObserver(refreshStates);
  states.observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });

  refreshStates();
  return;
}

const qtDark = '#00414A';
const qtLight = '#2CDE85';

export const qtColors = {
  dark: qtDark,
  light: qtLight,
  get foreground() { return states.dark ? qtLight : qtDark; },
  get background() { return states.dark ? qtDark : qtLight; }
};

export const monitor = {
  states,
  getBodyCss
}

start();
