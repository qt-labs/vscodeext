// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';

import * as vscode from 'vscode';

import * as qtpath from './get-qt-paths';
import * as versions from '../util/versions';

export const CMakeDefaultGenerator = 'Ninja Multi-Config';

export const CMakeToolsDir = path.join(qtpath.userLocalDir, 'CMakeTools');
// CMake CMAKE_KITS_FILEPATH var that store json config file path with CMake detected kits enumerated there
export const CMAKE_KITS_FILEPATH = path.join(
  CMakeToolsDir,
  'cmake-tools-kits.json'
);
export const USER_KITS_FILEPATH = path.join(
  CMakeToolsDir,
  'Qt-CMake-toolskits.json'
);

export async function specifyCMakeKitsJsonFileForQt() {
  const config = vscode.workspace.getConfiguration('cmake');
  const additionalKits = config.get<string[]>('additionalKits', []) || [];
  if (!additionalKits.includes(USER_KITS_FILEPATH)) {
    additionalKits.push(USER_KITS_FILEPATH);
  }
  await config.update(
    'additionalKits',
    additionalKits,
    vscode.ConfigurationTarget.Global
  );
}

export function cmakeCompatiblePath(fsPath: string) {
  return path.normalize(fsPath).replace(/\\/g, '/');
}

export type CompilerVendorEnum = 'Clang' | 'GCC' | 'MSVC';

export type Environment = Record<string, string | undefined>;

export interface CMakeGenerator {
  name: string;
  toolset?: string;
  platform?: string;
}

export interface KitDetect {
  /**
   * The vendor name of the kit
   */
  vendor?: CompilerVendorEnum;

  /**
   * The triple the kit
   */
  triple?: string;

  /**
   * The version of the kit
   */
  version?: string;

  /**
   * The version of the C runtime for the kit
   * In most case it's equal to version, but for `Clang for MSVC`
   * The Clang version are version
   * The MSVC version are versionRuntime
   */
  versionRuntime?: string;
}

export interface Kit extends KitDetect {
  /**
   * The name of the kit
   */
  name: string;

  /**
   * A description of the kit
   */
  description?: string;

  /**
   * The preferred CMake generator for this kit
   */
  preferredGenerator?: CMakeGenerator;

  /**
   * Additional settings to pass to CMake
   */
  cmakeSettings?: { [key: string]: string };

  /**
   * Additional environment variables for the kit
   */
  environmentVariables: Environment;

  /**
   * The language compilers.
   *
   * The key `lang` is the language, as in `CMAKE_<lang>_COMPILER`.
   * The corresponding value is a path to a compiler for that language.
   */
  compilers?: { [lang: string]: string };

  /**
   * The visual studio name. This corresponds to the installationId returned by `vswhere`.
   */
  visualStudio?: string;

  /**
   * The architecture for the kit. This is used when asking for the architecture
   * from the dev environment batch file.
   */
  visualStudioArchitecture?: string;

  /**
   * Filename of a shell script which sets environment variables for the kit
   */
  environmentSetupScript?: string;

  /**
   * Path to a CMake toolchain file.
   */
  toolchainFile?: string;

  /**
   * If `true`, keep this kit around even if it seems out-of-date
   */
  keep?: boolean;

  /**
   * If `true`, this kit comes from a trusted path.
   */
  isTrusted: boolean;
}

export const MapMsvcPlatformToQt: { [name: string]: string } = {
  x64: '64',
  amd64_x86: '32',
  x86_amd64: '64',
  amd64: '64',
  win32: '32'
};

const MsvcInfoRegexp = /msvc(\d\d\d\d)_(.+)/; // msvcYEAR_ARCH

export function getCMakeGenerator() {
  const cmakeConfig = vscode.workspace.getConfiguration('cmake');
  const generator = cmakeConfig.get<string>('generator');
  return generator ? generator : CMakeDefaultGenerator;
}

export async function* generateMsvcKits(newKit: Kit) {
  const promiseCMakeKits = loadCMakeKitsFileJSON();
  const msvcInfoMatch = newKit.visualStudio?.match(MsvcInfoRegexp);
  const vsYear = msvcInfoMatch?.at(1) as string;
  const architecture = msvcInfoMatch?.at(2) as string;
  newKit.preferredGenerator = {
    ...newKit.preferredGenerator,
    ...{
      name: getCMakeGenerator()
      // toolset: 'host='+SupportedArchitectureMSVC
    }
  };
  newKit = {
    ...newKit,
    ...{
      visualStudioArchitecture: architecture.toUpperCase()
    }
  };

  const loadedCMakeKits = await promiseCMakeKits;
  const msvcKitsWithArchitectureMatch = loadedCMakeKits.filter((kit) => {
    const version = kit.name?.match(/ (\d\d\d\d) /)?.at(1) as string;
    const targetArchitecture =
      MapMsvcPlatformToQt[kit.preferredGenerator?.platform as string];
    const isArchMatch = targetArchitecture == architecture;
    return isArchMatch && versions.compareVersions(version, vsYear) >= 0;
  });
  for (const kit of msvcKitsWithArchitectureMatch) {
    kit.name = qtpath.mangleQtInstallation(
      newKit.name + ' - ' + (kit.name || '')
    );
    if (kit.preferredGenerator && newKit.preferredGenerator) {
      kit.preferredGenerator.name = newKit.preferredGenerator?.name;
      if (kit.preferredGenerator.name == 'Ninja Multi-Config') {
        if (newKit.cmakeSettings) {
          if (kit.cmakeSettings == undefined) {
            kit.cmakeSettings = {};
          }
          kit.cmakeSettings = {
            ...newKit.cmakeSettings,
            ...kit.cmakeSettings
          };
        }
        // Generator 'Ninja Multi-Config' does not support platform & toolset specification
        kit.preferredGenerator.platform = undefined;
        kit.preferredGenerator.toolset = undefined;
      }
    }
    kit.environmentVariables = newKit.environmentVariables;
    kit.toolchainFile = newKit.toolchainFile;
    yield kit;
  }
}
export async function saveCMakeKitsFileJSON(data: Kit[]) {
  await fs.writeFile(CMAKE_KITS_FILEPATH, JSON.stringify(data, null, 2));
}

export async function loadCMakeKitsFileJSON(): Promise<Kit[]> {
  const data = await fs.readFile(CMAKE_KITS_FILEPATH);
  const stringData = data.toString();
  const json: unknown = JSON.parse(stringData);
  const kits = json as Kit[];
  return kits;
}

export function watchCMakeKitsFileUpdates(callback: (uri: vscode.Uri) => void) {
  const watcher = vscode.workspace.createFileSystemWatcher(CMAKE_KITS_FILEPATH);
  watcher.onDidChange(callback);
  watcher.onDidCreate(callback);
  watcher.onDidDelete(callback);
  return watcher;
}
