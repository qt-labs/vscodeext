// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  provideVSCodeDesignSystem,
  vsCodeButton
} from '@vscode/webview-ui-toolkit';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

provideVSCodeDesignSystem().register(vsCodeButton());

const vscode = acquireVsCodeApi();

window.addEventListener('load', main);

function main() {
  const buttons = document.querySelectorAll('vscode-button');
  if (buttons.length === 0) {
    throw new Error('No buttons found');
  }
  const openWithDesignerButton = document.getElementById(
    'openWithDesignerButton'
  );
  if (openWithDesignerButton) {
    openWithDesignerButton.focus();
  }
  function onOpenWithDesignerButtonClick() {
    vscode.postMessage({
      type: 'run'
    });
  }
  openWithDesignerButton?.addEventListener(
    'click',
    onOpenWithDesignerButtonClick
  );

  openWithDesignerButton?.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpenWithDesignerButtonClick();
    }
  });
  document.addEventListener('keydown', function (event) {
    // if any arrow key is pressed, focus the this button
    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight'
    ) {
      event.preventDefault();
      openWithDesignerButton?.focus();
    }
  });
}
