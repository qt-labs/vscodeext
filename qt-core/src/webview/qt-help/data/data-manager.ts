// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as path from 'path';
import { Uri, ExtensionContext } from 'vscode';

import { coreAPI } from '@/extension';
import {
  getCurrentGlobalAdditionalQtPaths,
  getCurrentGlobalQtInstallationRoot
} from '@/installation-root';
import { fsDir, fsFile } from '@/fs-utils';
import { DocRootInfo } from '@/webview/shared/qt-help';
import { QchReader } from './qch-reader';
import { findDocRoots } from './doc-discovery';
import { HtmlFullTextIndex } from './text-search';

export class QtHelpDataManager {
  private _readersPromise: Promise<QchReader[]> = Promise.resolve([]);
  private readonly _fullTextIndex = new HtmlFullTextIndex();
  private _fullTextIndexBuild: Promise<void> = Promise.resolve();
  private _selectedPackage: DocRootInfo | undefined;

  constructor(private readonly _context: ExtensionContext) {}

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public getPackages() {
    if (!coreAPI) {
      return [];
    }

    return findDocRoots({
      purpose: 'doc-browser',
      coreApi: coreAPI,
      insRoot: getCurrentGlobalQtInstallationRoot(),
      additionalQtpathsList: getCurrentGlobalAdditionalQtPaths()
    });
  }

  public selectPackage(p: DocRootInfo) {
    if (_.isEqual(this._selectedPackage, p)) {
      return;
    }

    this._selectedPackage = p;
    this._rebuild(p.fsPath);
  }

  public getHomeUri() {
    const base = this._selectedPackage?.fsPath ?? '';
    const home = path.join(base, 'qtdoc/index.html');
    if (path.isAbsolute(home) && fsFile(home).exists()) {
      return Uri.file(home).toString();
    }

    return '';
  }

  public async readToc() {
    const readers = await this._readersPromise;
    const results = await Promise.all(readers.map((r) => r.readToc()));

    return results.flat();
  }

  public async readIndexes() {
    const readers = await this._readersPromise;
    const results = await Promise.all(readers.map((r) => r.readIndexes()));

    return results.flat();
  }

  public async searchFullText(keyword: string) {
    await this._fullTextIndexBuild;
    const results = this._fullTextIndex.search(keyword);
    return Promise.resolve(results);
  }

  private _rebuild(docRootDir: string) {
    const qchFiles = fsDir(docRootDir).findFiles('*.qch');
    const sqlDistPath = path.join(this._context.extensionPath, 'res/others');

    this._readersPromise = Promise.all(
      qchFiles.map(async (filePath) => QchReader.create(sqlDistPath, filePath))
    );

    this._fullTextIndexBuild = this._fullTextIndex.build(docRootDir);
  }
}
