// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { smSettings } from 'qt-lib';
import * as consts from './constants';

export function isWalkthroughAvailable() {
  return (
    vscode.extensions.getExtension(consts.QT_SM_EXTENSION_ID) !== undefined
  );
}

// Reads the qt-sm.getStartedDone flag, which qt-sm sets once the user
// completes or dismisses the "Get Started with Qt" walkthrough.
export function isGetStartedDone() {
  return smSettings.getStartedDone.get(false);
}

export async function openWalkthrough() {
  await vscode.commands.executeCommand(consts.QT_SM_WALKTHROUGH_COMMAND);
}
