// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export interface Preset {
  id: string;
  name: string;
  template: string;
  meta: PresetMeta;
  prompt?: PresetPrompt;
}

export interface PresetMeta {
  type: string;
  title: string;
  description: string;
}

export interface PresetPrompt {
  version: string;
  steps: PresetPromptStep[];
  consts: object[];
}

export interface PresetPromptStep {
  id: string;
  type: string;
  question: string;
  default: string;
  items: PresetPromptStepItem[];
  when: string;
  rules: object[];
}

export interface PresetPromptStepItem {
  text: string;
  data: unknown;
  description: string;
  checked: string;
}

export class PresetWrapper {
  private _raw = $state(undefined as Preset | undefined);

  constructor(data?: Preset) {
    this.setData(data);
  }

  get id() {
    return this._raw?.id ?? '';
  }
  get name() {
    return this._raw?.name ?? '';
  }
  get template() {
    return this._raw?.template ?? '';
  }
  get title() {
    return this._raw?.meta.title;
  }
  get description() {
    return this._raw?.meta.description ?? '';
  }
  get steps() {
    return this._raw?.prompt?.steps;
  }
  get itemText() {
    if (this.isValid() && this.isDefaultPreset() && this._raw?.meta.title) {
      return this._raw?.meta.title;
    }

    return this.name;
  }

  public isValid() {
    return this._raw !== undefined;
  }

  public isCustomPreset() {
    return this.name.length > 0 && !this.name.startsWith('@');
  }

  public isDefaultPreset() {
    return this.name.length > 0 && this.name.startsWith('@');
  }

  public hasSteps() {
    return this.steps !== undefined && this.steps.length > 0;
  }

  public setData(data: Preset | undefined) {
    this._raw = data;
  }
}

// type guard functions
export function isPreset(x: unknown): x is Preset {
  if (typeof x !== 'object' || x === null) return false;

  const obj = x as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.name !== 'string' ||
    typeof obj.template !== 'string' ||
    typeof obj.meta !== 'object' ||
    obj.meta === null
  ) {
    return false;
  }

  const meta = obj.meta as Record<string, unknown>;
  return typeof meta.title === 'string' && typeof meta.description === 'string';
}

export function isPresetArray(x: unknown): x is Preset[] {
  return Array.isArray(x) && x.every(isPreset);
}
