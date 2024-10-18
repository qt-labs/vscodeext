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
    const callback = (error: Error | null, zipFile: yauzl.ZipFile) => {
      if (error) {
        reject(error);
        return;
      }

      zipFile.readEntry();
      zipFile.on('entry', (entry: yauzl.Entry) => {
        const writer = streamProvider(entry);
        if (writer === null) {
          zipFile.readEntry();
          return;
        }

        zipFile.openReadStream(entry, (e, reader) => {
          if (e) {
            reject(e);
            return;
          }

          reader.pipe(writer);
          reader.on('end', () => {
            zipFile.readEntry();
          });

          reader.on('error', reject);
          writer.on('error', reject);
        });
      });

      zipFile.on('end', () => {
        zipFile.close();
        resolve();
      });

      zipFile.on('error', () => {
        reject(new Error('zipfile error'));
      });
    };

    yauzl.open(inputPath, { lazyEntries: true }, callback);
  });
}
