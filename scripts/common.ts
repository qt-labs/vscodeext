// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface RootPackage {
  version: string;
}

export function getExtensionVersion(extensionRoot: string): string {
  const packageJsonPath = path.join(extensionRoot, 'package.json');
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8')
  ) as RootPackage;
  return packageJson.version;
}

export function pushTag(
  extensionRoot: string,
  extension: string,
  version: string,
  remote: string
) {
  const tag = `${extension}/${version}`;
  execSync(`git tag -am "${tag}" ${tag}`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
  execSync(`git push ${remote} ${tag}`, {
    cwd: extensionRoot,
    stdio: 'inherit'
  });
}

export function checkForUncommittedChanges() {
  const status = execSync('git status --porcelain').toString();
  if (status.trim().length > 0) {
    throw new Error(
      'Uncommitted changes found. Please commit or stash them before proceeding.'
    );
  }
}

export function checkForTagCommit(extension: string, version: string) {
  const commitMessageTitle = execSync('git show -s --format=%s HEAD')
    .toString()
    .trim();

  if (
    !commitMessageTitle.startsWith(extension) ||
    !commitMessageTitle.endsWith(version)
  ) {
    throw new Error(
      `Please checkout to the release commit for ${extension} version ${version} before proceeding.`
    );
  }
}
