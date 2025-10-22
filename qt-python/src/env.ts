// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { Environment } from '@vscode/python-extension';

import * as utils from './utils';
import * as consts from './constants';

export class PySideEnv {
  private readonly _pyEnv: Environment | undefined;

  constructor(pyenv?: Environment) {
    this._pyEnv = pyenv;
  }

  public isVenv(): boolean {
    return this._pyEnv?.environment?.type === 'VirtualEnvironment';
  }

  get venvName(): string | undefined {
    return this._pyEnv?.environment?.name;
  }

  get venvBinPath(): string {
    const root = this._pyEnv?.executable.sysPrefix ?? '';
    return root
      ? utils.toForwardSlash(path.join(root, consts.VENV_BIN_DIR))
      : '';
  }

  get interpreterPath(): string | undefined {
    return this._pyEnv?.executable.uri?.fsPath;
  }
}
