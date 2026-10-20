// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

function pathExists(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  platform: NodeJS.Platform
) {
  if (platform !== 'win32') {
    return environment[name];
  }
  const entry = Object.entries(environment).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return entry?.[1];
}

/**
 * Find the directory of the dotnet executable when it is not on PATH, for
 * example after an installation with the dotnet-install script whose PATH
 * entry the extension host does not see. Returns undefined if dotnet is on
 * PATH or cannot be found. Applications started with this directory on PATH
 * can find .NET.
 */
export function findDotNetPathEntry(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  architecture = process.arch
) {
  const executableName = platform === 'win32' ? 'dotnet.exe' : 'dotnet';
  const delimiter = platform === 'win32' ? ';' : ':';
  const inheritedPath = getEnvironmentValue(environment, 'PATH', platform);
  const inheritedEntries = (inheritedPath ?? '')
    .split(delimiter)
    .filter((entry) => entry.length > 0);
  if (
    inheritedEntries.some((entry) =>
      pathExists(path.join(entry, executableName))
    )
  ) {
    return undefined;
  }

  const dotNetHostPath = getEnvironmentValue(
    environment,
    'DOTNET_HOST_PATH',
    platform
  );
  if (dotNetHostPath && pathExists(dotNetHostPath)) {
    return path.dirname(path.resolve(dotNetHostPath));
  }

  let architectureRootName = 'DOTNET_ROOT_X64';
  if (architecture === 'arm64') {
    architectureRootName = 'DOTNET_ROOT_ARM64';
  } else if (architecture === 'ia32') {
    architectureRootName = 'DOTNET_ROOT_X86';
  }
  const candidates = [
    getEnvironmentValue(environment, architectureRootName, platform)
  ];
  if (platform === 'win32' && architecture === 'ia32') {
    candidates.push(
      getEnvironmentValue(environment, 'DOTNET_ROOT(x86)', platform)
    );
  }
  candidates.push(getEnvironmentValue(environment, 'DOTNET_ROOT', platform));
  if (platform === 'win32') {
    const programFiles =
      getEnvironmentValue(environment, 'ProgramFiles', platform) ??
      'C:\\Program Files';
    const programFilesX86 =
      getEnvironmentValue(environment, 'ProgramFiles(x86)', platform) ??
      'C:\\Program Files (x86)';
    const dotNetProgramFiles =
      architecture === 'ia32' ? programFilesX86 : programFiles;
    if (architecture === 'x64') {
      candidates.push(path.join(dotNetProgramFiles, 'dotnet', 'x64'));
    }
    candidates.push(path.join(dotNetProgramFiles, 'dotnet'));
  } else if (platform === 'darwin') {
    if (architecture === 'x64') {
      candidates.push('/usr/local/share/dotnet/x64');
    }
    candidates.push('/usr/local/share/dotnet', '/opt/homebrew/share/dotnet');
  } else {
    candidates.push(
      '/usr/share/dotnet',
      '/usr/lib/dotnet',
      '/usr/local/share/dotnet'
    );
  }
  // The default locations of the dotnet-install script, which are usually
  // only added to PATH by the shell profile.
  if (platform === 'win32') {
    const localAppData = getEnvironmentValue(
      environment,
      'LOCALAPPDATA',
      platform
    );
    if (localAppData) {
      candidates.push(path.join(localAppData, 'Microsoft', 'dotnet'));
    }
  } else {
    const home = getEnvironmentValue(environment, 'HOME', platform);
    if (home) {
      candidates.push(path.join(home, '.dotnet'));
    }
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const normalized = path.resolve(candidate);
    if (pathExists(path.join(normalized, executableName))) {
      return normalized;
    }
  }
  return undefined;
}
