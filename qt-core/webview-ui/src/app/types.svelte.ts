// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

export interface Preset {
  id: string;
  name: string;
  meta: {
    title: string;
    description: string;
  };
  prompt?: PresetPrompt;
}

export interface PresetPromptStep {
  id: string;
  type: string;
  question: string;
  default: unknown;
  items: unknown[];
  when: string;
  rules: object[];
}

export interface PresetPrompt {
  version: string;
  steps: PresetPromptStep[];
  consts: object[];
}

export class InputIssue {
  public level = $state('');
  public message = $state('');

  public clear() {
    this.level = '';
    this.message = '';
  }

  public loadFrom(data: object) {
    this.level = _.get(data, 'level', this.level);
    this.message = _.get(data, 'message', this.message);
  }

  public isError(): boolean {
    return this.level.toLocaleLowerCase() === 'error';
  }
}

// type guard functions
export function isPreset(x: unknown): x is Preset {
  if (typeof x !== 'object' || x === null) return false;

  const obj = x as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.name !== 'string' ||
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
