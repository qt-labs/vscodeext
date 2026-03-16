// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import * as vscode from 'vscode';

import { fsDir, fsFile } from '@/fs-utils';
import { ExEntry, ExResolvedPaths } from '@/webview/shared/ex-browser';
import * as helpers from './helpers';
import * as consts from './constants';

export class ExPathsResolver {
  public constructor(
    private readonly _insRoot: string,
    private readonly _qtVersionDir: string
  ) {}

  public resolve(e: ExEntry): ExResolvedPaths {
    return {
      doc: this._resolveDocHtml(e.docUrl),
      image: this._resolveImage(e.imageUrl),
      projectDir: this._resolveProjectDir(e.projectPath),
      projectFile: this._resolveFilePath(e.projectPath),
      filesToOpen: this._resolveFilesToOpen(e.filesToOpen)
    };
  }

  private _resolveDocHtml(docUrl: string) {
    // "qthelp://org.qt-project.qtcharts.6101/qtcharts/qtcharts-audio-example.html"
    const rel = vscode.Uri.parse(docUrl).path;
    const abs = this._toAbsPath('docs', rel);
    return fsFile(abs).exists() ? abs : '';
  }

  private _resolveProjectDir(projectPath: string) {
    // "charts/qmlchartsgallery/CMakeLists.txt"
    const abs = this._toAbsPath('examples', path.dirname(projectPath));
    return fsDir(abs).exists() ? abs : '';
  }

  private _resolveFilePath(relPath: string) {
    // "charts/qmlchartsgallery/main.cpp"
    // "charts/qmlchartsgallery/CMakeLists.txt"
    const abs = this._toAbsPath('examples', relPath);
    return fsFile(abs).exists() ? abs : '';
  }

  private _resolveFilesToOpen(relPaths: string[]) {
    const all = {} as Record<string, string>;

    relPaths.forEach((rel) => {
      const abs = this._toAbsPath('examples', rel);
      if (fsFile(abs).exists()) {
        all[rel] = abs;
      }
    });

    return all;
  }

  private _resolveImage(imageUrl: string) {
    // "qthelp://org.qt-project.qtscxml.6101/qtscxml/images/calculator.png"
    const uri = vscode.Uri.parse(imageUrl);
    const abs = this._toAbsPath('docs', uri.path);
    return fsFile(abs).exists() ? abs : '';
  }

  private _toAbsPath(type: 'docs' | 'examples', relPath: string): string {
    // input: qtscxml/images/calculator.png"
    // output: <insRoot>/Docs/<version>/<input>
    // output: <insRoot>/Examples/<version>/<input>
    if (!this._insRoot || !this._qtVersionDir) {
      return '';
    }

    return path.join(
      path.join(
        this._insRoot,
        type === 'docs' ? consts.DOCS_DIR_NAME : consts.EX_DIR_NAME,
        this._qtVersionDir,
        relPath
      )
    );
  }
}

export class ExImageUriResolver {
  constructor(
    private readonly _webview: vscode.Webview | undefined,
    private readonly _context: vscode.ExtensionContext
  ) {}

  public resolveWebUri(
    ex: ExEntry,
    resolvedPaths: ExResolvedPaths
  ): vscode.Uri {
    if (!this._webview) {
      return vscode.Uri.file('');
    }

    // 1. try already resolved url under Docs/ folder
    // "qthelp://org.qt-project.qtscxml.6101/qtscxml/images/calculator.png"
    if (fsFile(resolvedPaths.image).exists()) {
      return this._webview.asWebviewUri(vscode.Uri.file(resolvedPaths.image));
    }

    // 2. project folder to locate the file of the same name
    const filename = path.basename(ex.imageUrl);
    const candidate = fsFile(
      resolvedPaths.projectDir,
      'doc',
      'images',
      filename
    );
    if (candidate.exists()) {
      return this._webview.asWebviewUri(vscode.Uri.file(candidate.toString()));
    }

    // 3. fallback to the image in the resource
    const fallback = vscode.Uri.joinPath(
      helpers.fallbackImageDir(this._context),
      consts.FALLBACK_IMAGE_FILE_IN_RES
    );

    return this._webview.asWebviewUri(fallback);
  }
}
