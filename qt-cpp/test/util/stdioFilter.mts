// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

let origStdoutWrite: ((...args: any[]) => any) | undefined;
let origStderrWrite: ((...args: any[]) => any) | undefined;

function suppress(line: string): boolean {
  // Drop noisy CMake Tools lines (debug/info)
  if (
    line.includes('[CMakeTools]') &&
    (line.includes('[debug]') || line.includes('[info]'))
  ) {
    return true;
  }
  // Keep everything else
  return false;
}

export function installStdioFilter(): () => void {
  if (!origStdoutWrite)
    origStdoutWrite = process.stdout.write.bind(process.stdout);
  if (!origStderrWrite)
    origStderrWrite = process.stderr.write.bind(process.stderr);

  const filteredWrite = (orig: (chunk: any, enc?: any, cb?: any) => any) =>
    function write(this: any, chunk: any, enc?: any, cb?: any) {
      try {
        const s =
          typeof chunk === 'string' ? chunk : (chunk?.toString?.() ?? '');
        if (!s || suppress(s)) return true; // swallow
      } catch {
        /* ignore */
      }
      return orig.call(this, chunk, enc, cb);
    };

  // ts-expect-error - patching Node streams is intentional here
  process.stdout.write = filteredWrite(origStdoutWrite);
  // ts-expect-error - patching Node streams is intentional here
  process.stderr.write = filteredWrite(origStderrWrite);

  // return uninstaller
  return () => {
    if (origStdoutWrite) {
      // ts-expect-error
      process.stdout.write = origStdoutWrite;
    }
    if (origStderrWrite) {
      // ts-expect-error
      process.stderr.write = origStderrWrite;
    }
  };
}
