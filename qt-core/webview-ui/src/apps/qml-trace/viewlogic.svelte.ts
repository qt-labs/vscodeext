// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import { vscode } from '@/apps/vscode';
import { CommandId } from '@shared/message';
import { data } from './states.svelte';

export async function onAppMount() {
  void updateConfigs();
}

export async function setConfigsAndReload(allDirs: string) {
  const additionalDirs: string[] = [];

  allDirs.split('\n').forEach(e => {
    const s = e.trim();
    if ((s.length !== 0) && (additionalDirs.indexOf(s) < 0)) {
      additionalDirs.push(s);
    }
  });

  await vscode.post(CommandId.QmlTraceSetConfigs, { additionalDirs });
  await updateConfigs();
}

export async function openFileInTextEditor() {
  await vscode.post(CommandId.QmlTraceOpenFileInTextEditor);
}

export async function openFileInTraceViewer() {
  await vscode.post(CommandId.QmlTraceOpenFileInTraceViewer);
}

export async function getFoldersToAdd(source: 'dialog' | 'workspaces') {
  const reply = (source === 'dialog')
    ? await vscode.post(CommandId.QmlTraceSelectFolder, undefined, -1)
    : await vscode.post(CommandId.QmlTraceGetWorkspaceFolders);

  if (reply) {
    const f = _.get(reply, 'folders', []) as string[];
    const ok = Array.isArray(f) && f.every((e) => (typeof e === 'string'));
    return ok ? f : [];
  }

  return [];
}

async function updateConfigs() {
  const r = await vscode.post(CommandId.QmlTraceGetConfigs);

  data.configs = {
    filePath: _.get(r, 'filePath', data.configs.filePath),
    fileName: _.get(r, 'fileName', data.configs.fileName),
    additionalDirs: _.get(r, 'additionalDirs', data.configs.additionalDirs),
  }
}
