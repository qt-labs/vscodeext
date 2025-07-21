// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export class DragDropHandler {
  private _target: HTMLElement;
  private _dragDepth = 0;
  private _dragging = $state(false);
  public dragging = $derived(this._dragging);

  public onEnter: (e: DragEvent) => void = () => {};
  public onLeave: (e: DragEvent) => void = () => {};
  public onOver: (e: DragEvent) => void = () => {};
  public onDrop: (files: string[], e: DragEvent) => void = () => {};

  constructor(target: HTMLElement) {
    this._target = target;
  }

  public attach() {
    this._target.addEventListener('dragenter', this._handleEnter);
    this._target.addEventListener('dragleave', this._handleLeave);
    this._target.addEventListener('dragover', this._handleOver);
    this._target.addEventListener('drop', this._handleDrop);
  }

  public detach() {
    this._target.removeEventListener('dragenter', this._handleEnter);
    this._target.removeEventListener('dragleave', this._handleLeave);
    this._target.removeEventListener('dragover', this._handleOver);
    this._target.removeEventListener('drop', this._handleDrop);
  }

  private _handleEnter = (e: DragEvent) => {
    e.preventDefault();

    if (++this._dragDepth === 1) {
      this._setDragging(true);
      this.onEnter(e);
    }
  };

  private _handleLeave = (e: DragEvent) => {
    e.preventDefault();

    if (--this._dragDepth === 0) {
      this._setDragging(false);
      this.onLeave(e);
    }
  };

  private _handleOver = (e: DragEvent) => {
    e.preventDefault();
    this.onOver(e);
  };

  private _handleDrop = async (e: DragEvent) => {
    e.preventDefault();

    this._dragDepth = 0;
    this._setDragging(false);
    this.onDrop(await collectDropItems(e), e);
  };

  private _setDragging(dragging: boolean) {
    if (this._dragging !== dragging) {
      this._dragging = dragging;
    }
  }
}

async function collectDropItems(e: DragEvent) {
  function getItemAsString(item: DataTransferItem): Promise<string> {
    return new Promise(resolve => {
      item.getAsString(str => resolve(str));
    });
  }

  function parseCodefiles(s: string): string[] {
    const o = JSON.parse(s);
    if (!Array.isArray(o)) return [];
    if (!o.every(e => { return typeof e === 'string'; })) return [];

    return o;
  }

  const interestedType = 'codefiles';
  const items = e.dataTransfer?.items ?? [];
  const all: string[] = [];

  for (const item of items) {
    if (item.type === interestedType && item.kind === 'string') {
      const s = await getItemAsString(item);
      all.push(...parseCodefiles(s));
    }
  }

  return all;
}

