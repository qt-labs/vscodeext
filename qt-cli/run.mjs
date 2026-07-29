// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function findGitBash() {
  const git = spawnSync('git', ['--exec-path'], {
    encoding: 'utf8',
    windowsHide: true
  });
  const gitExecPath = git.stdout?.trim();
  const candidates = [
    gitExecPath
      ? path.resolve(gitExecPath, '..', '..', '..', 'bin', 'bash.exe')
      : undefined,
    process.env.ProgramFiles
      ? path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe')
      : undefined,
    process.env['ProgramFiles(x86)']
      ? path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe')
      : undefined
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

const bash = process.platform === 'win32' ? findGitBash() : 'bash';
if (!bash) {
  console.error('Git Bash is required to run qt-cli commands on Windows.');
  process.exit(1);
}

const result = spawnSync(
  bash,
  [path.join(scriptDirectory, 'run.sh'), ...process.argv.slice(2)],
  {
    cwd: scriptDirectory,
    stdio: 'inherit'
  }
);
if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
