// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createWrappedLogger } from 'qt-lib';
import { findUiDesignerSession } from '@/ui-file/session';

const logger = createWrappedLogger('ui-designer-commands');

export async function openInUiDesigner() {
  const doc = vscode.window.activeTextEditor?.document.uri;
  if (doc?.fsPath.endsWith('.ui') === false) {
    return;
  }

  const session = doc && findUiDesignerSession(doc);
  if (!session) {
    logger.text('No active document or session found').error();
    return;
  }

  await session.open(doc);
}
