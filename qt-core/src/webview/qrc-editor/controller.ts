// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { Jimp, ResizeStrategy } from 'jimp';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { createLogger } from 'qt-lib';
import { WebviewChannel } from '@/webview/channel';
import {
  Command,
  CommandId,
  CommandHandler,
  IsCommand
} from '@/webview/shared/message';
import {
  RccTag,
  QResourceTag,
  FileTag,
  QrcDocChangeEvent,
  QrcCommandReplyType
} from '@/webview/shared/qrc-types';
import { QrcNode } from './node';
import { makeUniqueName } from './utils';
import { QrcDocsManager } from './docs-manager';

const logger = createLogger('qrc-editor-controller');

export class QrcEditorController {
  private readonly _comm: WebviewChannel;
  private readonly _routes: Map<CommandId, CommandHandler>;
  private readonly _docPath: string;
  private readonly _docManager: QrcDocsManager;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    view: vscode.Webview,
    docManager: QrcDocsManager,
    docPath: string
  ) {
    this._comm = new WebviewChannel(view);
    this._docPath = docPath;
    this._docManager = docManager;

    this._disposables.push(
      this._comm,
      this._comm.onDidReceiveMessage(this._dispatch),
      this._docManager.onChange(this._onDocChange)
    );

    this._routes = new Map<CommandId, CommandHandler>([
      [CommandId.QrcAddFiles, this._onAddFiles],
      [CommandId.QrcAddNewGroup, this._onAddNewGroup],
      [CommandId.QrcGetRccTag, this._onGetRccTag],
      [CommandId.QrcGetFileInfo, this._onGetFileInfo],
      [CommandId.QrcClean, this._onClean],
      [CommandId.QrcRemove, this._onRemove],
      [CommandId.QrcSetProp, this._onSetProp],
      [CommandId.QrcSortAll, this._onSortAll],
      [CommandId.QrcRunVscodeUiAction, this._onRunActionInVscode],
      [CommandId.QrcRunClipboardAction, this._onRunClipboardAction]
    ]);
  }

  public dispose() {
    this._disposables.forEach((d) => {
      d.dispose();
    });
    this._disposables.length = 0;
  }

  private readonly _dispatch = async (cmd: unknown) => {
    if (!IsCommand(cmd)) {
      return;
    }

    const handler = this._routes.get(cmd.id);
    if (!handler) {
      logger.warn(`unhandled command: id = ${cmd.id}`);
      return;
    }

    try {
      await handler(cmd);
    } catch (e) {
      logger.error(`Error while handling command '${cmd.id}': ${String(e)}`);
    }
  };

  private readonly _onDocChange = (e: QrcDocChangeEvent) => {
    if (this._docPath === e.key) {
      this._comm.post(CommandId.QrcDocChanged, e);
    }
  };

  private readonly _onAddFiles = async (cmd: Command) => {
    const node = this._findQrcNodeOrThrow(cmd.payload);
    if (!node.qrcUri) {
      return;
    }

    const paths = await extractOrAskAbsPaths(cmd.payload, node.qrcUri);
    const fileIndexes = (
      await Promise.all(
        paths.map(async (p) =>
          collectAllFiles(p).then((found) => node.addFiles(found))
        )
      )
    ).flat();

    if (fileIndexes.length !== 0) {
      await this._applyAndPostData(cmd, {
        action: 'add',
        groupKey: node.pos.groupKey,
        fileIndexes
      });
    }
  };

  private readonly _onAddNewGroup = async (cmd: Command) => {
    const node = this._findQrcNodeOrThrow(cmd.payload);
    const name = createNewPrefixName(node.rcc);
    const group = node.addGroup(name);

    await this._applyAndPostData(cmd, {
      action: 'add',
      groupKey: group.attributes.__groupKey ?? '',
      fileIndexes: [-1]
    });
  };

  private readonly _onGetRccTag = (cmd: Command) => {
    const doc = this._docManager.find(this._docPath);
    if (doc?.rccTag) {
      this._comm.postDataReply(cmd, doc.rccTag);
    }
  };

  private readonly _onGetFileInfo = async (cmd: Command) => {
    const node = this._findQrcNodeOrThrow(cmd.payload);
    const fsPath = node.fileUri?.fsPath ?? '';
    const size = _.get(cmd.payload, 'thumbnailSize', 24) as number;
    const info = await createFileInfo(fsPath, size);

    this._comm.postDataReply(cmd, info);
  };

  private readonly _onClean = async (cmd: Command) => {
    const doc = this._docManager.find(this._docPath);
    const rcc = doc?.rccTag;
    if (!rcc?.qresource) {
      return;
    }

    removeEmptyGroups(rcc);

    const baseDir = path.dirname(this._docPath);
    for (const g of rcc.qresource) {
      await removeInvalidFiles(g, baseDir);
    }

    await this._applyAndPostData(cmd, { status: 'done' });
  };

  private readonly _onRemove = async (cmd: Command) => {
    const node = this._findQrcNodeOrThrow(cmd.payload);
    if (node.remove()) {
      await this._applyAndPostData(cmd, { status: 'done' });
    }
  };

  private readonly _onSetProp = async (cmd: Command) => {
    const node = this._findQrcNodeOrThrow(cmd.payload);
    const name = _.get(cmd.payload, 'name', '') as string;
    const value = _.get(cmd.payload, 'value', '') as string;

    if (node.setAttribute(name, value)) {
      await this._applyAndPostData(cmd, { status: 'done' });
    }
  };

  private readonly _onSortAll = async (cmd: Command) => {
    const doc = this._docManager.find(this._docPath);
    const rcc = doc?.rccTag;
    if (!rcc?.qresource) {
      return;
    }

    const order = _.get(cmd.payload, 'order', 'asc') as string;
    if (sortGroups(rcc, order)) {
      rcc.qresource.forEach((g) => sortFiles(g, order));
      await this._applyAndPostData(cmd, { status: 'done' });
    }
  };

  private readonly _onRunActionInVscode = async (cmd: Command) => {
    const action = _.get(cmd.payload, 'action', '') as string;

    if (action === 'openQrcInTextEditor') {
      void vscode.window.showTextDocument(vscode.Uri.file(this._docPath));
      this._comm.postDataReply(cmd, { status: 'done' });
      return;
    }

    const node = this._findQrcNodeOrThrow(cmd.payload);
    if (!node.file || !node.fileUri) {
      return;
    }

    if (!(await fileExists(node.fileUri.fsPath))) {
      return;
    }

    if (action === 'openFile') {
      void vscode.commands.executeCommand('vscode.open', node.fileUri, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside
      });
    } else if (action === 'revealFileInExplorer') {
      void vscode.commands.executeCommand('revealInExplorer', node.fileUri);
    } else {
      return;
    }

    this._comm.postDataReply(cmd, { status: 'done' });
  };

  private readonly _onRunClipboardAction = async (cmd: Command) => {
    const node = this._findQrcNodeOrThrow(cmd.payload);
    const action = _.get(cmd.payload, 'action', '') as string;

    switch (action) {
      case 'copy':
        if (await node.copy()) {
          await this._applyAndPostData(cmd, { status: 'done' });
        }
        break;

      case 'cut':
        if ((await node.copy()) && node.remove()) {
          await this._applyAndPostData(cmd, { status: 'done' });
        }
        break;

      case 'paste': {
        const r = await node.paste();
        if (r) {
          await this._applyAndPostData(cmd, { action: 'paste', ...r });
        }
        return;
      }
    }
  };

  private async _applyAndPostData(cmd: Command, data: QrcCommandReplyType) {
    const doc = this._docManager.find(this._docPath);
    if (doc) {
      this._docManager.setRecentCommandId(this._docPath, cmd.id);
      await doc.updateXmlVsdoc();
      this._comm.postDataReply(cmd, data);
    }
  }

  private _findQrcNodeOrThrow(data: unknown): QrcNode {
    const doc = this._docManager.find(this._docPath);
    if (!doc) {
      throw new Error('Invalid QRC file');
    }

    const g = _.get(data, 'groupKey', '') as string;
    const f = toInteger(_.get(data, 'fileIndex', -1), -1);
    return new QrcNode(doc, g, f);
  }
}

// helpers
async function createFileInfo(absPath: string, thumbnailSize: number) {
  let exists = false;
  let thumbnail: number[] | undefined;

  try {
    if (await fileExists(absPath)) {
      exists = true;

      const image = await Jimp.read(absPath);
      const resized = image.resize({
        w: thumbnailSize,
        mode: ResizeStrategy.NEAREST_NEIGHBOR
      });

      const buffer = await resized.getBuffer('image/png');
      thumbnail = Array.from(new Uint8Array(buffer));
    }
  } catch {
    // do nothing on purpose
  }

  return { exists, ...(thumbnail && { thumbnail }) };
}

function createNewPrefixName(rcc: RccTag) {
  if (rcc.qresource.length === 0) {
    return '/';
  }

  const base = '/new/prefix';
  const taken = rcc.qresource.map((g) => g.attributes.prefix ?? '');
  return makeUniqueName(base, new Set(taken));
}

function toInteger(value: unknown, defaultValue = 0): number {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return defaultValue;
  }

  const safe = Math.floor(num);
  if (safe < Number.MIN_SAFE_INTEGER) {
    return Number.MIN_SAFE_INTEGER;
  }
  if (safe > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }

  return safe;
}

async function collectAllFiles(dir: string) {
  const s = await fs.stat(dir);
  if (s.isFile()) {
    return [dir];
  }

  let found: string[] = [];
  const list = await fs.readdir(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      found = found.concat(await collectAllFiles(filePath));
    } else {
      found.push(filePath);
    }
  }

  return found;
}

async function fileExists(fsPath: string) {
  try {
    const s = await fs.stat(fsPath);
    return s.isFile();
  } catch {
    return false;
  }
}

function sortGroups(rcc: RccTag, order: string): boolean {
  rcc.qresource.sort((a, b) => {
    const ap = a.attributes.prefix ?? '';
    const bp = b.attributes.prefix ?? '';
    return order === 'asc' ? ap.localeCompare(bp) : bp.localeCompare(ap);
  });

  return true;
}

function sortFiles(group: QResourceTag, order: string): boolean {
  group.file.sort((a, b) =>
    order === 'asc'
      ? a.text.localeCompare(b.text)
      : b.text.localeCompare(a.text)
  );

  return true;
}

function removeEmptyGroups(rcc: RccTag) {
  if (rcc.qresource.length === 0) {
    return false;
  }

  const retained = rcc.qresource.filter((g) => g.file.length > 0);
  if (rcc.qresource.length !== retained.length) {
    rcc.qresource = retained;
    return true;
  }

  return false;
}

async function removeInvalidFiles(group: QResourceTag, baseDir: string) {
  if (group.file.length === 0) {
    return false;
  }

  const retained: FileTag[] = [];

  for (const f of group.file) {
    const emptyAttr = f.attributes.empty ?? '';
    const isEmptyEntry = 'true' === emptyAttr.trim().toLowerCase();
    if (isEmptyEntry || (await fileExists(path.join(baseDir, f.text)))) {
      retained.push(f);
    }
  }

  if (group.file.length !== retained.length) {
    group.file = retained;
    return true;
  }

  return false;
}

async function extractOrAskAbsPaths(cmdPayload: unknown, qrcUri: vscode.Uri) {
  if (_.isPlainObject(cmdPayload) && _.has(cmdPayload, 'files')) {
    const files = _.get(cmdPayload, 'files', []);
    if (Array.isArray(files) && files.every((s) => typeof s === 'string')) {
      return files;
    }

    return [];
  }

  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: true,
    openLabel: 'Select files to add',
    defaultUri: qrcUri
  });

  return selected?.map((url) => url.fsPath) ?? [];
}
