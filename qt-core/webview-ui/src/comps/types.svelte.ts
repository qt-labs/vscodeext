// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-onl

import _ from 'lodash';
import { File } from '@lucide/svelte';

export interface PickerItem {
  text: string;
  icon?: typeof File | undefined;
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
