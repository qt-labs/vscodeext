// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { z } from "zod";

import {
  type QResourceTag,
  type FileTag,
  QrcNodePos
} from '@shared/qrc-types';
import * as texts from '@/apps/texts';

export type QrcPropName =  'alias' | 'prefix' | 'lang';
export type QrcClipboardAction = 'copy' | 'cut' | 'paste';
export type QrcVscodeUiAction =
  | 'openFile'
  | 'openQrcInTextEditor'
  | 'revealFileInExplorer';

export interface PropInputConfig {
  enabled: boolean;
  value?: string;
}

export class PropInputField {
  public value = $state('');
  public enabled = $state(false);
  public error = $state('');
  public schema: z.ZodTypeAny | undefined;

  public validate() {
    if (this.schema && this.enabled) {
      const r = this.schema.safeParse(this.value.trim());
      this.error = r.success ? "" : r.error.errors[0].message;
    } else {
      this.error = '';
    }
  }
}

export class PropInputsManager {
  public alias = new PropInputField();
  public prefix = new PropInputField();
  public language = new PropInputField();

  constructor() {
    this.alias.schema = z.union([
      z.literal(""),
      z.string()
        .max(30, { message: texts.qrc.errors.tooLong })
    ]);

    this.prefix.schema = z
      .string()
      .trim()
      .nonempty({ message: texts.qrc.errors.prefixEmpty })
      .max(30, { message: texts.qrc.errors.tooLong })
      .startsWith("/", { message: texts.qrc.errors.prefixStart });

    this.language.schema = z.union([
      z.literal(""),
      z.string().regex(
        /^[a-z]{2}(_[A-Z]{2})?$/,
        { message: texts.qrc.errors.invalidLang }
      )
    ]);
  }

  public find(name: QrcPropName) {
    if (name === "alias") return this.alias;
    if (name === 'prefix') return this.prefix;
    if (name === 'lang') return this.language;
    return undefined;
  }

  public applyConfig(name: QrcPropName, config: PropInputConfig) {
    const input = this.find(name);
    if (!input) {
      return;
    }

    input.enabled = config.enabled;
    input.value = config.value ?? '';
    if (input.enabled) {
      input.validate();
    } else {
      input.error = '';
    }
  }

  public applyConfigs(all: Record<QrcPropName, PropInputConfig>) {
    for (const key in all) {
      const name = key as QrcPropName;
      this.applyConfig(name, all[name]);
    }
  }

  public validateAll() {
    this.alias.validate();
    this.prefix.validate();
    this.language.validate();
  }
}

export interface FileInfo {
  exists: boolean,
  thumbnailUrl: string
}

export class GroupNodeWrapper {
  private _group: QResourceTag | undefined;
  private _files: FileNodeWrapper[] = [];
  private _highlighted = $state(false);
  private _opened = $state(false);
  private _onOpenedChanged?: (opened: boolean) => void;

  constructor(tag?: QResourceTag) {
    this._group = tag;
    this._files = tag?.file.map((f, i) => {
      return new FileNodeWrapper(this, f, i);
    }) ?? [];
  }

  get pos(): QrcNodePos {
    return new QrcNodePos(this.key);
  }

  get key(): string {
    return this._group?.attributes.__groupKey ?? '';
  }

  get hash(): string {
    return this._group?.attributes.__hash ?? '';
  }

  get filesHash(): string {
    return this._group?.attributes.__groupFilesHash ?? '';
  }

  get prefix(): string {
    return this._group?.attributes.prefix ?? '';
  }

  get language(): string {
    return this._group?.attributes.lang ?? '';
  }

  get opened(): boolean {
    return this._opened;
  }

  get highlighted(): boolean {
    return this._highlighted;
  }

  public numFiles(): number {
    return this._files.length;
  }

  public fileAt(index: number): FileNodeWrapper | undefined {
    return this._files[index];
  }

  public allFiles(): FileNodeWrapper[] {
    return this._files;
  }

  public onOpenedChanged(callback: (opened: boolean) => void) {
    this._onOpenedChanged = callback;
  }

  public setOpened(open: boolean) {
    if (this._opened !== open) {
      this._opened = open;
      this._onOpenedChanged?.(open);
    }
  }

  public setHighlighted(highlight: boolean) {
    this._highlighted = highlight;
  }

  public setFilesHighlighted(fileIndexes: number[], highlight: boolean) {
    fileIndexes.map(i => {
      const file = this._files[i];
      if (file) {
        file.setHighlighted(highlight);
      }
    })
  }

  public setAllFilesHighlighted(highlight: boolean) {
    this.setFilesHighlighted(_.range(0, this._files.length), highlight);
  }

  public static createList(tags: QResourceTag[]) {
    return tags.map(tag => new GroupNodeWrapper(tag));
  }
}

export class FileNodeWrapper {
  private _file: FileTag | undefined;
  private _index: number = -1;
  private _pos: QrcNodePos;
  private _highlighted = $state(false);

  constructor(group?: GroupNodeWrapper, tag?: FileTag, index?: number) {
    this._file = tag;
    this._index = index ?? -1;
    this._pos = new QrcNodePos(group?.pos.groupKey ?? '', this._index);
  }

  get pos(): QrcNodePos {
    return this._pos;
  }

  get hash(): string {
    return this._file?.attributes.__hash ?? '';
  }

  get text(): string {
    return this._file?.text ?? '';
  }

  get alias(): string {
    return this._file?.attributes.alias ?? '';
  }

  get empty(): boolean {
    const s = this._file?.attributes.empty ?? 'false';
    return (s.trim().toLowerCase() === 'true');
  }

  get highlighted(): boolean {
    return this._highlighted;
  }

  public setHighlighted(highlight: boolean) {
    this._highlighted = highlight;
  }
}

export class CursorManager {
  private _groups: GroupNodeWrapper[] = [];
  private _allVisiblePos: QrcNodePos[] = [];
  private _currentIndex = $state(-1);
  private _onCurrentChanged?: () => void;

  public currentIndex = $derived(this._currentIndex);
  public currentPos = $derived(this._currentPos() ?? new QrcNodePos());

  public refresh(groups: GroupNodeWrapper[]) {
    this._groups = groups;
    this._groups.forEach(g => g.onOpenedChanged(() => this._rebuild()));
    this._rebuild();
  }

  public moveTo(groupKey: string, fileIndex: number = -1) {
    this.moveToPos(new QrcNodePos(groupKey, fileIndex));
  }

  public moveToPos(id: QrcNodePos) {
    const index = this._allVisiblePos.findIndex(p => p.equals(id));
    if (index >= 0) {
      this._setCurrentIndex(index);
    }
  }

  public moveDir(dir: 'up' | 'down' | 'left' | 'right'): boolean {
    if (dir === 'up') return this._moveUp();
    else if (dir === 'down') return this._moveDown();
    else if (dir === 'left') return this._moveLeft();
    else if (dir === 'right') return this._moveRight();
    return false;
  }

  public getAllVisiblePos() {
    return this._allVisiblePos;
  }

  public unsetCurrent() {
    this._currentIndex = -1;
  }

  public onCurrentChanged(callback: () => void) {
    this._onCurrentChanged = callback;
  }

  private _setCurrentIndex(i: number): boolean {
    if (this._currentIndex !== i) {
      this._currentIndex = i;
      this._onCurrentChanged?.();
      return true;
    }

    return false;
  }

  private _setCurrentIndexClamped(i: number): boolean {
    const valid = Math.max(0, Math.min(i, this._allVisiblePos.length - 1));
    return this._setCurrentIndex(valid);
  }

  private _currentPos(): QrcNodePos | undefined {
    return this._allVisiblePos[this._currentIndex];
  }

  private _currentGroup(): GroupNodeWrapper | undefined {
    return this._groups.find(g => g.key === this.currentPos.groupKey);
  }

  private _moveUp(): boolean {
    return this._setCurrentIndexClamped(this._currentIndex - 1);
  }

  private _moveDown(): boolean {
    return this._setCurrentIndexClamped(this._currentIndex + 1);
  }

  private _moveLeft(): boolean {
    const pos = this._currentPos();
    const group = this._currentGroup();
    if (!pos || !group) return false;

    if (group.opened) {
      if (pos.isFile()) {
        this.moveTo(pos.groupKey, -1);
      } else if (pos.isGroup()) {
        group.setOpened(false);
      }

      return true;
    }

    return this._moveUp();
  }

  private _moveRight(): boolean {
    const pos = this._currentPos();
    const group = this._currentGroup();
    if (!pos || !group) return false;

    if (pos.isGroup() && !group.opened) {
      group.setOpened(true);
      return true;
    }

    return this._moveDown();
  }

  private _rebuild() {
    const result: QrcNodePos[] = [];

    for (const g of this._groups) {
      result.push(g.pos);
      if (g.opened) {
        g.allFiles().forEach(f => result.push(f.pos));
      }
    }

    if (result.length === 0) {
      this._setCurrentIndex(-1);
      this._allVisiblePos = [];
      return;
    }

    this._allVisiblePos = result;
    this._setCurrentIndexClamped(this._currentIndex);
  }
}

export class OpenStateSnapshot {
  private _openedKeys = new Set<string>();

  public static capture(groups: GroupNodeWrapper[]) {
    const keys = groups.filter(g => g.opened).map(g => g.key);
    const instance = new OpenStateSnapshot();
    instance._openedKeys = new Set(keys);

    return instance;
  }

  public restoreTo(groups: GroupNodeWrapper[]) {
    groups.forEach(g => g.setOpened(this._openedKeys.has(g.key)));
  }
}

export class CursorStateSnapshot {
  private _allVisiblePos: QrcNodePos[] = [];
  private _currentIndex = -1;

  public static capture(cursor: CursorManager) {
    const instance = new CursorStateSnapshot();
    instance._allVisiblePos = cursor.getAllVisiblePos();
    instance._currentIndex = cursor.currentIndex;

    return instance;
  }

  public restoreTo(cursor: CursorManager) {
    const allPos = cursor.getAllVisiblePos();

    for (let i = this._currentIndex; i < this._allVisiblePos.length; ++i) {
      const candidate = this._allVisiblePos.at(i);
      if (!candidate) {
        continue;
      }

      const found = (allPos.findIndex(id => id.equals(candidate)) >= 0);
      if (found) {
        cursor.unsetCurrent();
        cursor.moveToPos(candidate);
        return;
      }
    }
  }
}
