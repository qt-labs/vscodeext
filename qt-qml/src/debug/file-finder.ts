// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as fs from 'fs';

import { QRCParser } from '@debug/qrc-parser';

export class FileFinder {
  private readonly _qrcParser: QRCParser;
  private readonly _cache: Map<string, string>;
  private allFiles: vscode.Uri[] = [];
  private _buildDirs: string[] = [];
  constructor() {
    this._qrcParser = new QRCParser();
    this._cache = new Map();
    this.allFiles = [];
  }

  set buildDirs(dirs: string[]) {
    this._buildDirs = dirs;
  }
  get buildDirs() {
    return this._buildDirs;
  }

  async findFile(fileUrl: string) {
    if (fileUrl.startsWith('qrc') || fileUrl.startsWith(':')) {
      return this.findInQrcFiles(fileUrl, this._buildDirs);
    }
    return this.checkProjectFiles(fileUrl);
  }
  async findInQrcFiles(fileUrl: string, additionalFolders: string[] = []) {
    const fileUrlParts = fileUrl.split(':');
    const fileUrlPath = fileUrlParts[1];
    if (fileUrlParts.length !== 2 || !fileUrlPath) {
      throw new Error('Invalid file URL');
    }
    const filePath = this._cache.get(fileUrlPath);
    if (filePath) {
      return filePath;
    }
    const allQrcFiles = await vscode.workspace.findFiles('**/*.qrc');
    for (const folder of additionalFolders) {
      const pattern = new vscode.RelativePattern(folder, '**/*.qrc');
      const additionalQrcFiles = await vscode.workspace.findFiles(pattern);
      allQrcFiles.push(...additionalQrcFiles);
    }
    // parse all qrc files asynchrounously
    const parsePromises = allQrcFiles.map((file) =>
      this._qrcParser.parseQRCFile(file.fsPath)
    );
    const parsedQrcFiles = await Promise.all(parsePromises);
    this._cache.clear();
    for (const parsedQrcFile of parsedQrcFiles) {
      if (parsedQrcFile) {
        for (const [alias, path] of parsedQrcFile) {
          this._cache.set(alias, path);
        }
      }
    }
    return this._cache.get(fileUrlPath);
  }
  async checkProjectFiles(originalPath: string) {
    // Filter .qml and .js files
    // Rewrite again becuase new files may be added or removed
    this.allFiles = await vscode.workspace.findFiles('**/*.{qml,js}');
    const matches: string[] = [];
    const lastSegment = originalPath.split('/').pop();
    if (!lastSegment) {
      throw new Error('Invalid path');
    }
    const files = this.filesWithSameFileName(lastSegment);
    matches.push(...files.map((file) => file.fsPath));
    const matchedFilePaths = FileFinder.bestMatches(matches, originalPath);
    if (matchedFilePaths.length === 0) {
      return undefined;
    }
    const hits: string[] = [];
    for (const matchedFilePath of matchedFilePaths) {
      if (FileFinder.checkPath(matchedFilePath)) {
        hits.push(matchedFilePath);
      }
    }
    // return the first hit
    return hits[0];
  }
  filesWithSameFileName(fileName: string) {
    return this.allFiles.filter((file) => file.fsPath.endsWith(fileName));
  }

  static commonPostFixLength(
    candidatePath: string,
    filePathToFind: string
  ): number {
    let rank = 0;
    let a = candidatePath.length;
    let b = filePathToFind.length;

    while (
      --a >= 0 &&
      --b >= 0 &&
      candidatePath.charAt(a) === filePathToFind.charAt(b)
    ) {
      rank++;
    }

    return rank;
  }
  static checkPath(candidate: string) {
    // check if the file exists
    if (fs.existsSync(candidate)) {
      return true;
    }
    return false;
  }

  static bestMatches(filePaths: string[], filePathToFind: string): string[] {
    if (filePaths.length === 0) {
      return [];
    }

    if (filePaths.length === 1) {
      console.debug(
        `FileInProjectFinder: found ${filePaths[0]} in project files`
      );
      return filePaths;
    }

    let bestRank = -1;
    let bestFilePaths: string[] = [];

    for (const fp of filePaths) {
      const currentRank = FileFinder.commonPostFixLength(fp, filePathToFind);
      if (currentRank < bestRank) {
        continue;
      }
      if (currentRank > bestRank) {
        bestRank = currentRank;
        bestFilePaths = [];
      }
      bestFilePaths.push(fp);
    }

    if (bestFilePaths.length === 0) {
      throw new Error('No best file paths found');
    }

    return bestFilePaths;
  }
}
