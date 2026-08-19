// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as yauzl from 'yauzl';
import { Writable } from 'stream';

export type Entry = yauzl.Entry;

// Bounds for what a single archive may extract. A crafted archive (zip bomb)
// can declare millions of entries or expand a few compressed bytes into
// gigabytes and exhaust disk or memory before any path check runs, so breach
// aborts the extraction. The caps are generous multiples of the real qmlls
// and trace viewer packages. yauzl verifies the declared sizes against the
// actual inflated bytes (validateEntrySizes defaults to true), so a central
// directory that understates a size is caught at stream time.
const MaxEntryCount = 10000;
const MaxTotalUncompressedBytes = 2 * 1024 * 1024 * 1024; // 2 GiB
const MaxCompressionRatio = 100;
// Fixed deflate overhead makes tiny entries report extreme ratios, so only
// entries large enough to matter are ratio checked.
const RatioCheckMinBytes = 1024 * 1024; // 1 MiB

export class ExtractionBudget {
  private _entryCount = 0;
  private _totalUncompressedBytes = 0;

  charge(entry: yauzl.Entry) {
    this._entryCount++;
    if (this._entryCount > MaxEntryCount) {
      throw new Error(
        `Archive contains more than ${MaxEntryCount.toString()} entries`
      );
    }

    this._totalUncompressedBytes += entry.uncompressedSize;
    if (this._totalUncompressedBytes > MaxTotalUncompressedBytes) {
      throw new Error(
        `Archive expands beyond ${MaxTotalUncompressedBytes.toString()} bytes`
      );
    }

    if (
      entry.uncompressedSize > RatioCheckMinBytes &&
      entry.uncompressedSize > entry.compressedSize * MaxCompressionRatio
    ) {
      throw new Error(
        `Archive entry has a suspicious compression ratio: ${entry.fileName}`
      );
    }
  }
}

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
    const budget = new ExtractionBudget();

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
        let writer: Writable | null;
        try {
          budget.charge(entry);
          writer = streamProvider(entry);
        } catch (err) {
          fail(err as Error);
          return;
        }
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
