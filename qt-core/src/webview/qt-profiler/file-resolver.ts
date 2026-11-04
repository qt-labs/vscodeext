// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import { workspace, Uri, GlobPattern, RelativePattern } from 'vscode';

import { QRCParser, createWrappedLogger } from 'qt-lib';

const logger = createWrappedLogger('file-path-resolver');

export class FilePathResolver {
  private readonly _qrcParser = new QRCParser();
  private _aliasToPath = new Map<string, string>();

  constructor(private readonly _additionalDirs: string[] = []) {}

  public async resolve(target: string) {
    if (target.startsWith('qrc:') || target.startsWith(':')) {
      return this._resolveQrcAlias(target);
    }

    return findInWorkspace(target, '**/*.{qml,js}');
  }

  private async _resolveQrcAlias(uri: string) {
    const parts = uri.split(':');
    const alias = parts[1];
    if (parts.length !== 2 || !alias) {
      logger.text('Invalid URI').data(uri).info();
      return undefined;
    }

    if (!this._aliasToPath.has(alias)) {
      const qrcUris = await findAllQrcUris(this._additionalDirs);
      this._aliasToPath = await generateAliasMap(qrcUris, this._qrcParser);
    }

    return this._aliasToPath.get(alias);
  }
}

// helpers
async function findInWorkspace(fsPath: string, pattern: string) {
  const name = path.basename(fsPath);
  if (!name) {
    logger.text('Invalid file name').data(fsPath).info();
    return undefined;
  }

  const all = await workspace.findFiles(pattern);
  const candidates = all
    .filter((u) => u.fsPath.endsWith(name))
    .map((u) => u.fsPath);

  const matches = findBestMatches(candidates, fsPath);
  return matches.find((m) => fs.existsSync(m));
}

async function findAllQrcUris(additionalDirs: string[]) {
  const pattern = '**/*.qrc';
  const globs: GlobPattern[] = [
    pattern,
    ...additionalDirs.map((dir) => new RelativePattern(dir, pattern))
  ];

  const found = await Promise.all(globs.map((p) => workspace.findFiles(p)));
  return found.flat();
}

async function generateAliasMap(qrcUris: Uri[], parser: QRCParser) {
  const parsedResults = await Promise.all(
    qrcUris.map((uri) => parser.parseQRCFile(uri.fsPath))
  );

  const items = parsedResults.flatMap((r) => (r ? [...r] : []));
  return new Map(items);
}

function findBestMatches(candidates: string[], target: string): string[] {
  let maxRank = -1;
  let matches: string[] = [];

  for (const c of candidates) {
    const rank = measureCommonSuffix(c, target);
    if (rank < maxRank) {
      continue;
    }

    if (rank > maxRank) {
      maxRank = rank;
      matches = [];
    }

    matches.push(c);
  }

  return matches;
}

function measureCommonSuffix(a: string, b: string) {
  let rank = 0;
  let la = a.length;
  let lb = b.length;

  while (--la >= 0 && --lb >= 0 && a.charAt(la) === b.charAt(lb)) {
    rank++;
  }

  return rank;
}
