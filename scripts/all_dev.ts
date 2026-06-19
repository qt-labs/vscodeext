// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as path from 'path';
import { exec, execSync } from 'child_process';
import { program } from 'commander';

function main() {
  program.option('--profile <string>', 'Profile to install package');
  program.option('--extension <string>', 'Extension to generate package');
  program.parse(process.argv);
  const options = program.opts();
  const targetExtension = options.extension as string;
  const profile = options.profile as string;
  const extensionRoot = path.resolve(__dirname, '../');
  const targetExtensionRoot = path.join(extensionRoot, targetExtension);

  if (targetExtension === 'all') {
    void exec('npm run build:qt-cli');
    for (const lib of ['qt-lib', 'sms-api']) {
      buildLib(lib, extensionRoot);
    }
  }
  if (targetExtension === 'qt-sm') {
    buildLib('sms-api', extensionRoot);
  }
  execSync(`npm run ci:${targetExtension}`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
  execSync(`npm run lint:${targetExtension}`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
  if (targetExtension === 'qt-cpp' || targetExtension === 'all') {
    execSync(`npm run prepareNatvisFiles`, {
      cwd: extensionRoot,
      stdio: 'inherit'
    });
  }
  execSync(`npm run package:${targetExtension}`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });

  let profileArg = '';
  if (profile) {
    profileArg = ` --profile="${profile}"`;
  }
  const script = path.join(extensionRoot, 'scripts', 'install-ext.ts');
  if (targetExtension === 'all') {
    const extensions = [
      'qt-core',
      'qt-cpp',
      'qt-qml',
      'qt-ui',
      'qt-python',
      'qt-sm'
    ];
    for (const ext of extensions) {
      const targetRoot = path.join(extensionRoot, ext);
      execSync(
        `ts-node ${script} --dir="${targetRoot}" --name="${ext}"${profileArg}`,
        {
          cwd: extensionRoot,
          stdio: 'inherit'
        }
      );
    }
  } else {
    execSync(
      `ts-node ${script} --dir="${targetExtensionRoot}" --name="${targetExtension}"${profileArg}`,
      {
        cwd: extensionRoot,
        stdio: 'inherit'
      }
    );
  }
}

function buildLib(lib: string, extensionRoot: string) {
  execSync(`npm run ci:${lib}`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
  execSync(`npm run compile:${lib}`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
}
main();
