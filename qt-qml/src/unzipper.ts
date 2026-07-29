// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as yauzl from 'yauzl';
import { Writable } from 'stream';

export type Entry = yauzl.Entry;

export async function unzip(
  inputPath: string,
  streamProvider: (entry: yauzl.Entry) => Writable | null
) {
  return new Promise<void>((resolve, reject) => {
    // Reading an entry only means its bytes have been handed to the
    // destination stream, not that they have landed on disk. Resolving as
    // soon as the zip's central directory is exhausted would let callers
    // touch files (e.g. spawn an extracted exe) while the last entries are
    // still being flushed. So track outstanding writers and only resolve
    // once every 'finish' has fired too.
    let pendingWrites = 0;
    let allEntriesRead = false;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const resolveIfDone = () => {
      if (!settled && allEntriesRead && pendingWrites === 0) {
        settled = true;
        resolve();
      }
    };

    const callback = (error: Error | null, zipFile: yauzl.ZipFile) => {
      if (error) {
        fail(error);
        return;
      }

      zipFile.readEntry();
      zipFile.on('entry', (entry: yauzl.Entry) => {
        const writer = streamProvider(entry);
        if (writer === null) {
          zipFile.readEntry();
          return;
        }

        pendingWrites++;
        zipFile.openReadStream(entry, (e, reader) => {
          if (e) {
            fail(e);
            return;
          }

          reader.pipe(writer);
          reader.on('end', () => {
            zipFile.readEntry();
          });

          writer.on('finish', () => {
            pendingWrites--;
            resolveIfDone();
          });

          reader.on('error', fail);
          writer.on('error', fail);
        });
      });

      zipFile.on('end', () => {
        zipFile.close();
        allEntriesRead = true;
        resolveIfDone();
      });

      zipFile.on('error', () => {
        fail(new Error('zipfile error'));
      });
    };

    yauzl.open(inputPath, { lazyEntries: true }, callback);
  });
}
