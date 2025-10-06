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
  const openWithDesignerButton = document.getElementById(
    'openWithDesignerButton'
  );
  const openWithTextEditorButton = document.getElementById(
    'openWithTextEditorButton'
  );
  if (openWithDesignerButton) {
    openWithDesignerButton.focus();
  }
  function onOpenWithDesignerButtonClick() {
    vscode.postMessage({
      type: 'run'
    });
  }
  function onOpenWithTextEditorButtonClick() {
    vscode.postMessage({
      type: 'openWithTextEditor'
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
  openWithTextEditorButton?.addEventListener(
    'click',
    onOpenWithTextEditorButtonClick
  );
  openWithTextEditorButton?.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onOpenWithTextEditorButtonClick();
    }
  });
  document.addEventListener('keydown', function (event) {
    // Toggle focus between the two buttons with arrow keys
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();
      openWithDesignerButton?.focus();
    } else if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault();
      openWithTextEditorButton?.focus();
    }
  });
}
