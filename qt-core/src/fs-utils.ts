// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function fsDir(first: string | vscode.Uri, ...rest: string[]) {
  return new DirWrapper(resolvePath(first, ...rest));
}

export function fsFile(first: string | vscode.Uri, ...rest: string[]) {
  return new FileWrapper(resolvePath(first, ...rest));
}

// internal classes
class DirWrapper {
  constructor(private readonly _dirPath: string) {}

  public toString() {
    return this._dirPath;
  }

  public toUri() {
    return vscode.Uri.file(this._dirPath);
  }

  public stat(): fs.Stats | undefined {
    try {
      return fs.statSync(this._dirPath);
    } catch {
      return undefined;
    }
  }

  public exists(): boolean {
    try {
      const stat = fs.statSync(this._dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  public subDirPaths(): string[] {
    return fs
      .readdirSync(this._dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(e.parentPath, e.name));
  }

  public subDirNames(): string[] {
    return fs
      .readdirSync(this._dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  }

  public allFilePaths(name: string): string[] {
    const found: string[] = [];

    this._walkAllDirs((fullPath: string, e: fs.Dirent) => {
      if (e.isFile() && e.name === name) {
        found.push(fullPath);
      }
    });

    return found;
  }

  public copyAll(destDir: string) {
    DirWrapper._copyAllDeep(this._dirPath, destDir);
  }

  // vscode commands
  public openAsWorkspace(option: { newWindow?: boolean } = {}) {
    if (option.newWindow) {
      return vscode.commands.executeCommand(
        'vscode.openFolder',
        this.toUri(),
        true
      );
    } else {
      return vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders?.length ?? 0,
        null,
        { uri: this.toUri() }
      );
    }
  }

  public revealInFileManager() {
    return vscode.env.openExternal(this.toUri());
  }

  // private methods
  private _walkAllDirs(task: (fullPath: string, e: fs.Dirent) => void) {
    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const e of entries) {
        const fullPath = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(fullPath);
          continue;
        }

        task(fullPath, e);
      }
    }

    walk(this._dirPath);
  }

  private static _copyAllDeep(srcDir: string, destDir: string) {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (!entry.isDirectory()) {
        fs.copyFileSync(srcPath, destPath);
        continue;
      }

      DirWrapper._copyAllDeep(srcPath, destPath);
    }
  }
}

class FileWrapper {
  constructor(private readonly _filePath: string) {}

  public toString() {
    return this._filePath;
  }

  public toUri() {
    return vscode.Uri.file(this._filePath);
  }

  public stat(): fs.Stats | undefined {
    try {
      return fs.statSync(this._filePath);
    } catch {
      return undefined;
    }
  }

  public exists(): boolean {
    try {
      const stat = fs.statSync(this._filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  public readAll() {
    return fs.readFileSync(this._filePath);
  }

  // vscode commands
  public openInEditor(options?: vscode.TextDocumentShowOptions) {
    return vscode.window.showTextDocument(
      this.toUri(),
      options ?? {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
        preview: true
      }
    );
  }

  public openExternal() {
    return vscode.env.openExternal(this.toUri());
  }

  public revealInFileManager() {
    return vscode.commands.executeCommand('revealFileInOS', this.toUri());
  }

  public openInSimpleBrowser(viewColumn?: vscode.ViewColumn) {
    return vscode.commands.executeCommand(
      'simpleBrowser.api.open',
      this.toUri(),
      {
        viewColumn: viewColumn ?? vscode.ViewColumn.Beside
      }
    );
  }
}

// helper
function resolvePath(first: string | vscode.Uri, ...rest: string[]) {
  const base = first instanceof vscode.Uri ? first.fsPath : first;
  return path.join(base, ...rest);
}
