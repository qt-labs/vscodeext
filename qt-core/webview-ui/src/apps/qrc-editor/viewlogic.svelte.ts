// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { tick } from 'svelte';

import { vscode } from '@/apps/vscode';
import { CommandId, type CommandReply } from '@shared/message';
import {
  isRccTag,
  isQrcDocChangeEvent,
  type QrcDocChangeEvent
} from '@shared/qrc-types';
import {
  GroupNodeWrapper,
  FileNodeWrapper,
  OpenStateSnapshot,
  CursorStateSnapshot,
  type PropInputConfig,
  type QrcPropName,
  type QrcVscodeUiAction,
  type QrcClipboardAction,
} from './types.svelte';
import { data, ui } from './states.svelte';

let onQrcReloadOnce: (() => void)[] = [];

export async function onAppMount() {
  vscode.onDidReceiveNotification(onVscodeNotified);
  ui.cursor.onCurrentChanged(onCursorCurrentChanged);

  await reloadQrcContent();
  setAllGroupsOpened(true);
  ui.cursor.moveTo(data.groups[0]?.pos.groupKey ?? '');
}

export function onKeydown(e: KeyboardEvent) {
  if (takeCareKeydownEvent(e)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export async function addFilesFromDialog() {
  addFiles([]);
}

export async function addFiles(files: string[]) {
  const cmdId = CommandId.QrcAddFiles;
  const nodeId = ui.cursor.currentPos.toJson();
  const reply = files.length > 0
    ? await vscode.post(cmdId, { ...nodeId, files })
    : await vscode.post(cmdId, { ...nodeId }, -1);

  const groupKey = _.get(reply, 'groupKey', '') as string;
  const fileIndexes = _.get(reply, 'fileIndexes', [] as number[]);

  if (fileIndexes.length > 0) {
    afterQrcReload(() => {
      ui.cursor.moveTo(groupKey, fileIndexes[0]);
      withGroup(groupKey, g => {
        g.setOpened(true);
        g.setFilesHighlighted(fileIndexes, true);
      });
    });
  }
}

export async function addNewGroup() {
  const reply = await vscode.post(CommandId.QrcAddNewGroup);
  const groupKey = _.get(reply, 'groupKey', '') as string;

  afterQrcReload(() => {
    ui.cursor.moveTo(groupKey);
    withGroup(groupKey, g => g.setOpened(true));
  });
}

export async function removeCurrent() {
  const payload = ui.cursor.currentPos.toJson();
  await vscode.post(CommandId.QrcRemove, payload);
}

export async function clean() {
  await vscode.post(CommandId.QrcClean);
}

export async function setProp(name: QrcPropName) {
  const input = ui.inputs.find(name);
  if (!input || !input.enabled) {
    return;
  }

  const payload = {
    name,
    value: input.value.trim(),
    ...ui.cursor.currentPos.toJson()
  };

  await vscode.post(CommandId.QrcSetProp, payload);
  ui.inputs.validateAll();
}

export async function sortAll() {
  await vscode.post(CommandId.QrcSortAll);
}

export async function runClipboardAction(action: QrcClipboardAction) {
  const payload = { action, ...ui.cursor.currentPos.toJson() };
  const reply = await vscode.post(CommandId.QrcRunClipboardAction, payload);

  if (action === 'paste') {
    const groupKey = _.get(reply, 'groupKey', '') as string;
    const fileIndexes = _.get(reply, 'fileIndexes', [] as number[]);

    if (fileIndexes.length > 0) {
      afterQrcReload(() => {
        ui.cursor.moveTo(groupKey);
        withGroup(groupKey, g => {
          g.setOpened(true);
          g.setFilesHighlighted(fileIndexes, true);
        });
      });
    }
  }
}

export async function runVscodeUiAction(action: QrcVscodeUiAction) {
  const payload = { action, ...ui.cursor.currentPos.toJson() };
  await vscode.post(CommandId.QrcRunVscodeUiAction, payload);
}

export async function updateFileInfo(file: FileNodeWrapper) {
  const key = file.text;
  if (key.length === 0 || key in data.fileInfo) {
    return;
  }

  const thumbnailSize = 24;
  const payload = { thumbnailSize, ...file.pos.toJson() };
  const reply = await vscode.post(CommandId.QrcGetFileInfo, payload);

  let thumbnailUrl = '';
  const exists = _.get(reply, 'exists', false) as boolean;
  const thumbnail = _.get(reply, 'thumbnail', []) as Array<number>;

  if (exists && thumbnail && thumbnail.length !== 0) {
    const byteArray = new Uint8Array(thumbnail);
    const blob = new Blob([byteArray], { type: 'image/png' });
    thumbnailUrl = URL.createObjectURL(blob);
  }

  data.fileInfo = {
    ...data.fileInfo,
    [key]: { exists, thumbnailUrl }
  }
}

export function setAllGroupsOpened(open: boolean) {
  data.groups.forEach(g => g.setOpened(open));

  if (!open) {
    ui.cursor.moveTo(ui.cursor.currentPos.groupKey, -1);
  }
}

// helpers
async function onVscodeNotified(reply: CommandReply) {
  if (reply.id === CommandId.QrcDocChanged) {
    const e = isQrcDocChangeEvent(reply.payload)
      ? reply.payload
      : undefined;

    await reloadQrcContent(e);
  }
}

function onCursorCurrentChanged() {
  const id = ui.cursor.currentPos;
  if (id.isFile()) {
    withGroup(id.groupKey, g => g.setOpened(true));
  }

  updatePropInputs();
  document.getElementById(id.toString())?.focus();
  data.groups.forEach(g => g.setAllFilesHighlighted(false));
}

async function reloadQrcContent(e?: QrcDocChangeEvent) {
  const reply = await vscode.post(CommandId.QrcGetRccTag);
  if (!isRccTag(reply)) {
    return;
  }

  const openState = OpenStateSnapshot.capture(data.groups);
  const cursorState = CursorStateSnapshot.capture(ui.cursor);

  data.groups = GroupNodeWrapper.createList(reply.qresource);
  openState.restoreTo(data.groups);
  ui.cursor.refresh(data.groups);

  await tick();
  requestAnimationFrame(() => {
    if (e && e.reason === 'command') {
      if (e.commandId === CommandId.QrcClean
        || e.commandId === CommandId.QrcRemove
        || e.commandId === CommandId.QrcSortAll) {
        cursorState.restoreTo(ui.cursor);
      }
    }

    onQrcReloadOnce.forEach(f => f());
    onQrcReloadOnce = [];
  });
}

function afterQrcReload(cb: () => void) {
  onQrcReloadOnce.push(cb);
}

function withGroup(groupKey: string, callback: (g: GroupNodeWrapper) => void) {
  const group = data.groups.find(g => (g.key === groupKey));
  if (group) {
    callback(group);
  }
}

function updatePropInputs() {
  const pos = ui.cursor.currentPos;
  const g = data.groups.find(g => g.key === pos.groupKey);
  const f = g?.fileAt(pos.fileIndex);

  let lang: PropInputConfig = { enabled: false };
  let alias: PropInputConfig = { enabled: false };
  let prefix: PropInputConfig = { enabled: false };

  if (pos.isGroup() && g) {
    lang = { enabled: true, value: g.language };
    prefix = { enabled: true, value: g.prefix };
  }

  if (pos.isFile() && f) {
    alias = { enabled: true, value: f.alias };
  }

  ui.inputs.applyConfigs({ prefix, alias, lang });
  ui.inputs.validateAll();
}

function takeCareKeydownEvent(e: KeyboardEvent): boolean {
  if (e.key.startsWith('Arrow')) {
    return takeCareArrowKeys(e);
  }

  if (e.key === 'Tab') {
    return ui.cursor.moveDir(e.shiftKey ? 'up' : 'down');
  }

  if (e.key === 'Delete') {
    removeCurrent();
    return true;
  }

  if (e.key === 'Escape') {
    data.groups.forEach(g => g.setAllFilesHighlighted(false));
    return true;
  }

  if (e.key === ' ') {
    if (ui.cursor.currentPos.isGroup()) {
      withGroup(ui.cursor.currentPos.groupKey, g => g.setOpened(!g.opened));
      return true;
    }
  }

  if (e.key === 'Enter') {
    if (ui.cursor.currentPos.isGroup()) {
      withGroup(ui.cursor.currentPos.groupKey, g => g.setOpened(!g.opened));
    } else {
      void runVscodeUiAction('openFile');
    }
    return true;
  }

  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'c') { runClipboardAction('copy'); return true; }
    if (k === 'x') { runClipboardAction('cut'); return true; }
    if (k === 'v') { runClipboardAction('paste'); return true; }
  }

  return false;
}

function takeCareArrowKeys(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown') ui.cursor.moveDir('down');
  else if (e.key === 'ArrowUp') ui.cursor.moveDir('up');
  else if (e.key === 'ArrowLeft') ui.cursor.moveDir('left');
  else if (e.key === 'ArrowRight') ui.cursor.moveDir('right');
  else {
    return false;
  }

  return true;
}
