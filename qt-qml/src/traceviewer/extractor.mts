// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as yauzl from 'yauzl';
import * as vscode from 'vscode';
import { Writable } from 'stream';

import { IsWindows } from 'qt-lib';
import { DownloadResult } from './downloader.mts';
import { InstalledRelease } from './installation-manager.mts';

export async function extractWithProgress(
  installBaseDir: string,
  downloadResult: DownloadResult
) {
  const release = new InstalledRelease(installBaseDir, downloadResult.id);
  const taskOptions = {
    title: 'Extracting QML trace viewer',
    location: vscode.ProgressLocation.Notification,
    cancellable: true
  };

  const task = async () => {
    const unzipStreamProvider = (entry: Entry) => {
      const name = entry.fileName;
      const fullPath = path.join(release.filesDir, name);

      if (entry.fileName.endsWith('/')) {
        fs.mkdirSync(fullPath, { recursive: true });
        return null;
      }

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      return { stream: fs.createWriteStream(fullPath), fullPath };
    };

    fs.rmSync(release.filesDir, { recursive: true, force: true });
    await unzipV2(
      downloadResult.downloadedFilePath,
      release.filesDir,
      unzipStreamProvider
    );
  };

  await vscode.window.withProgress(taskOptions, task);
  return release;
}

// helpers
type Entry = yauzl.Entry;
type StreamProviderResult = {
  stream: Writable;
  fullPath: string;
} | null;

const UNIX_SYMLINK = 0o120000;
const UNIX_FILE_TYPE_MASK = 0o170000;

export async function unzipV2(
  inputPath: string,
  baseDir: string,
  streamProvider: (entry: yauzl.Entry) => StreamProviderResult
) {
  return new Promise<void>((resolve, reject) => {
    const callback = (error: Error | null, zipFile: yauzl.ZipFile) => {
      if (error) {
        reject(error);
        return;
      }

      zipFile.readEntry();
      zipFile.on('entry', (entry: yauzl.Entry) => {
        const unixAttrs = entry.externalFileAttributes >> 16;
        const isSymlink = (unixAttrs & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK;

        if (isSymlink) {
          zipFile.openReadStream(entry, (e, reader) => {
            if (e) {
              reject(e);
              return;
            }
            let target = '';
            reader.on('data', (chunk: Buffer) => {
              target += chunk.toString();
            });
            reader.on('end', () => {
              try {
                const linkPath = path.join(baseDir, entry.fileName);
                fs.mkdirSync(path.dirname(linkPath), { recursive: true });
                fs.symlinkSync(target.trim(), linkPath);
              } catch (err) {
                reject(err as Error);
                return;
              }
              zipFile.readEntry();
            });
            reader.on('error', reject);
          });
          return;
        }

        const provider = streamProvider(entry);
        if (provider === null) {
          zipFile.readEntry();
          return;
        }

        zipFile.openReadStream(entry, (e, reader) => {
          if (e) {
            reject(e);
            return;
          }

          reader.pipe(provider.stream);

          provider.stream.on('finish', () => {
            if (!IsWindows) {
              const mode = unixAttrs & 0o777;
              if (mode !== 0) {
                fs.chmodSync(provider.fullPath, mode);
              }
            }
          });

          reader.on('end', () => {
            zipFile.readEntry();
          });

          reader.on('error', reject);
          provider.stream.on('error', reject);
        });
      });

      zipFile.on('end', () => {
        zipFile.close();
        resolve();
      });

      zipFile.on('error', () => {
        reject(new Error('Zip file error'));
      });
    };

    yauzl.open(inputPath, { lazyEntries: true }, callback);
  });
}
