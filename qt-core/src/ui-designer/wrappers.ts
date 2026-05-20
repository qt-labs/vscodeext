// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  QtInfo,
  IsMacOS,
  findQtKits,
  OSExeSuffix,
  searchForExeInQtInfo
} from 'qt-lib';
import * as path from 'path';
import { fsDir, fsFile } from '@/fs-utils';
import { coreAPI } from '@/extension';

export enum QtToolId {
  Linguist,
  Designer
}

export class QtInsRootWrapper {
  constructor(private readonly _qtInsRoot: string) {}

  public isValid() {
    return this._qtInsRoot.length > 0 && fsDir(this._qtInsRoot).exists();
  }

  public toString() {
    return this._qtInsRoot;
  }

  public async getKits() {
    const allKits = await findQtKits(this._qtInsRoot);
    return allKits.map((k) => new QtKitWrapper(k));
  }
}

export class QtKitWrapper {
  constructor(private readonly _qtKitPath: string) {}

  get binDir() {
    return new QtBinDirWrapper(path.join(this._qtKitPath, 'bin'));
  }

  get fsPath() {
    return this.isValid() ? this._qtKitPath : undefined;
  }

  get qtVersion() {
    return this.isValid()
      ? path.basename(path.join(this._qtKitPath, '..'))
      : undefined;
  }

  get qtInsRoot() {
    return this.isValid()
      ? new QtInsRootWrapper(path.join(this._qtKitPath, '../..'))
      : undefined;
  }

  public isValid() {
    return this._qtKitPath.length > 0 && fsDir(this._qtKitPath).exists();
  }
}

export class QtpathsWrapper {
  constructor(private readonly _qtpathsExe: string) {}

  get qtInfo() {
    const r = coreAPI?.getQtInfoFromPath(this._qtpathsExe);
    return r?.info ? new QtInfoWrapper(r.info) : undefined;
  }

  get kit() {
    const kit = new QtKitWrapper(path.join(this.fsPath, '../..'));
    return kit.isValid() ? kit : undefined;
  }

  get fsPath() {
    return this._qtpathsExe;
  }

  public isValid() {
    return this._qtpathsExe.length > 0 && fsFile(this._qtpathsExe).exists();
  }
}

export class QtInfoWrapper {
  constructor(private readonly _info: QtInfo) {}

  public async searchExe(exePathGetter: (p: string) => string) {
    return searchForExeInQtInfo(this._info, exePathGetter);
  }

  public async searchDesignerExe() {
    return this.searchExe((binPath) => {
      return new QtBinDirWrapper(binPath).designerExePath ?? '';
    });
  }
}

export class QtBinDirWrapper {
  constructor(private readonly _qtBinDir: string) {}

  get fsPath() {
    return this._qtBinDir;
  }

  get designerExePath() {
    return this.locateTool(QtToolId.Designer);
  }

  public locateTool(id: QtToolId) {
    const expected = this.composeToolPath(id);
    return expected && fsFile(expected).exists() ? expected : undefined;
  }

  public composeToolPath(id: QtToolId) {
    if (!this.isValid()) {
      return undefined;
    }

    if (id === QtToolId.Designer) {
      return path.join(
        this._qtBinDir,
        IsMacOS
          ? 'Designer.app/Contents/MacOS/Designer'
          : 'designer' + OSExeSuffix
      );
    }

    return undefined;
  }

  public isValid() {
    return this._qtBinDir.length > 0 && fsDir(this._qtBinDir).exists();
  }
}
