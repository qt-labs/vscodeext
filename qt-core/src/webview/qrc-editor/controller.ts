// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { Jimp, ResizeStrategy } from 'jimp';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { WebviewDispatcher } from '@/webview/dispatcher';
import { Command, CommandId } from '@/webview/shared/message';
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

export class QrcEditorController {
  private readonly _docPath: string;
  private readonly _docManager: QrcDocsManager;
  private readonly _dispatcher: WebviewDispatcher;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    panel: vscode.WebviewPanel,
    docManager: QrcDocsManager,
    docPath: string
  ) {
    this._docPath = docPath;
    this._docManager = docManager;
    this._dispatcher = new WebviewDispatcher('qrc-editor', panel);
    this._dispatcher.setHandlers([
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

    this._disposables.push(
      this._dispatcher,
      this._docManager.onChange(this._onDocChange)
    );
  }

  public dispose() {
    this._disposables.forEach((d) => void d.dispose());
    this._disposables.length = 0;
  }

  private readonly _onDocChange = (e: QrcDocChangeEvent) => {
    if (this._docPath === e.key) {
      this.channel.notify(CommandId.QrcDocChanged, e);
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
      this.channel.replyData(cmd, doc.rccTag);
    }
  };

  private readonly _onGetFileInfo = async (cmd: Command) => {
    const node = this._findQrcNodeOrThrow(cmd.payload);
    const fsPath = node.fileUri?.fsPath ?? '';
    const size = _.get(cmd.payload, 'thumbnailSize', 24) as number;
    const info = await createFileInfo(fsPath, size);

    this.channel.replyData(cmd, info);
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
      this.channel.replyDone(cmd);
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

   this.channel.replyDone(cmd);
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
        break;
      }

      case 'copy-resource-url':
      case 'copy-resource-path': {
        const type = action.endsWith('-url') ? 'url' : 'path';
        const text = node.formatResourceString(type).trim();
        if (text.length !== 0) {
          void vscode.env.clipboard.writeText(text);
          this.channel.replyDone(cmd);
        }
        break;
      }
    }
  };

  private async _applyAndPostData(cmd: Command, data: QrcCommandReplyType) {
    const doc = this._docManager.find(this._docPath);
    if (doc) {
      this._docManager.setRecentCommandId(this._docPath, cmd.id);
      await doc.updateXmlVsdoc();
      this.channel.replyData(cmd, data);
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

  private get channel() {
    return this._dispatcher.channel;
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
