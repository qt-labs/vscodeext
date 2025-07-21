// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { type RccTag, QResourceTag } from '@/webview/shared/qrc-types';
import { parseXml, generateXml } from './xml-io';
import { updateGroupHashes, generateKey } from './utils';

export class QrcDoc {
  private readonly _vsdoc: vscode.TextDocument;
  private _rccTag: RccTag | undefined;

  constructor(doc: vscode.TextDocument) {
    this._vsdoc = doc;
    this.reloadXmlVsdoc();
  }

  get uri() {
    return this._vsdoc.uri;
  }

  get rccTag() {
    return this._rccTag;
  }

  public reloadXmlVsdoc() {
    const rcc = parseXml(this._vsdoc.getText());
    if (!rcc) {
      return;
    }

    if (rcc.qresource.length !== 0) {
      rcc.qresource.forEach((g) => {
        updateGroupHashes(g);
      });
      migrateGroupKeys(rcc, this._rccTag);
      ensureGroupKeysValid(rcc);
    }

    this._rccTag = rcc;
  }

  public async updateXmlVsdoc() {
    if (!this._rccTag) {
      return undefined;
    }

    const xml = generateXml(this._rccTag);
    const whole = new vscode.Range(0, 0, this._vsdoc.lineCount, 0);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(this._vsdoc.uri, whole, xml);

    await vscode.workspace.applyEdit(edit);
  }
}

// helpers
type GroupCompareMode = 'hash' | 'files' | 'both';

function migrateGroupKeys(destRcc: RccTag, srcRcc: RccTag | undefined) {
  if (!srcRcc || srcRcc.qresource.length === 0) {
    return;
  }

  const compareModes: GroupCompareMode[] = ['both', 'hash', 'files'];

  for (const mode of compareModes) {
    destRcc.qresource.forEach((destGroup) => {
      matchAndTransferGroupKey(destGroup, srcRcc, mode);
    });
  }
}

function compareGroupHashes(
  first: QResourceTag,
  second: QResourceTag,
  mode: GroupCompareMode
) {
  const a = first.attributes;
  const b = second.attributes;

  if (!a.__hash || !a.__groupFilesHash) {
    return false;
  }
  if (!b.__hash || !b.__groupFilesHash) {
    return false;
  }

  switch (mode) {
    case 'hash':
      return a.__hash === b.__hash;

    case 'files':
      return a.__groupFilesHash === b.__groupFilesHash;

    case 'both':
    default:
      return a.__hash === b.__hash && a.__groupFilesHash === b.__groupFilesHash;
  }
}

function matchAndTransferGroupKey(
  destGroup: QResourceTag,
  srcRcc: RccTag,
  mode: GroupCompareMode
) {
  const srcGroups = srcRcc.qresource;
  if (!srcGroups.length) {
    return;
  }

  const matchIndex = srcGroups.findIndex((sourceGroup) => {
    return compareGroupHashes(destGroup, sourceGroup, mode);
  });

  const matchGroup = matchIndex === -1 ? undefined : srcGroups[matchIndex];
  const matchedKey = matchGroup?.attributes.__groupKey;
  if (matchedKey) {
    destGroup.attributes.__groupKey = matchedKey;

    // Prevent duplicated migration by consuming the matched group.
    srcGroups.splice(matchIndex, 1);
  }
}

function ensureGroupKeysValid(rcc: RccTag) {
  rcc.qresource.forEach((group) => {
    if ((group.attributes.__groupKey ?? '') === '') {
      group.attributes.__groupKey = generateKey();
    }
  });
}
