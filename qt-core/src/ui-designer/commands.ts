// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { findUiDesignerSession } from '@/ui-designer/session';
import * as consts from './constants';

const logger = createLogger('commands');

export function registerUiDesignerCommands(context: vscode.ExtensionContext) {
  function register(c: string, callback: (...args: unknown[]) => unknown) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`${consts.COMMAND_PREFIX}.${c}`, callback)
    );
  }

  register(consts.COMMAND_OPEN_IN_WIDGETS_DESIGNER, openInUiDesigner);
}

async function openInUiDesigner() {
  const doc = vscode.window.activeTextEditor?.document.uri;
  const session = doc && findUiDesignerSession(doc);
  if (!session) {
    logger.error('No active document or session found');
    return;
  }

  await session.open(doc);
}
