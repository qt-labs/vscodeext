// Copyright (C) 2023 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';

import * as vscode from 'vscode';

import { existing } from '../util/fs';
import * as qtpath from './get-qt-paths';
import * as versions from '../util/versions';

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
  cmakeSettings?: Record<string, string>;

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
  compilers?: Record<string, string>;

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

export class CMakeKitFiles {
  private _qtKitsFilePath: string;

  static readonly CMakeDefaultGenerator = 'Ninja Multi-Config';
  static readonly CMakeToolsDir = path.join(qtpath.UserLocalDir, 'CMakeTools');
  static readonly CMAKE_KITS_FILEPATH = path.join(
    CMakeKitFiles.CMakeToolsDir,
    'cmake-tools-kits.json'
  );
  static readonly DEFAULT_FALLBACK_QT_KITS_FILEPATH = path.join(
    CMakeKitFiles.CMakeToolsDir,
    'cmake-tools-kits.json'
  );
  static readonly MapMsvcPlatformToQt: Record<string, string> = {
    x64: '64',
    amd64_x86: '32',
    x86_amd64: '64',
    amd64: '64',
    win32: '32',
    x86: '32'
  };
  static readonly MsvcInfoRegexp = /msvc(\d\d\d\d)_(.+)/; // msvcYEAR_ARCH
  static readonly MsvcInfoNoArchRegexp = /msvc(\d\d\d\d)/; // msvcYEAR

  constructor(qtKitsStorage: string) {
    this._qtKitsFilePath =
      path.join(qtKitsStorage, 'qt-kits.json') ||
      CMakeKitFiles.DEFAULT_FALLBACK_QT_KITS_FILEPATH;
  }

  get qtKitsFilePath() {
    return this._qtKitsFilePath;
  }

  async specifyCMakeKitsJsonFileForQt() {
    const config = vscode.workspace.getConfiguration('cmake');
    const additionalKits = config.get<string[]>('additionalKits') ?? [];
    if (!additionalKits.includes(this._qtKitsFilePath)) {
      additionalKits.push(this._qtKitsFilePath);
    }
    const existingAdditionalKits = await Promise.all(
      additionalKits.map(existing)
    );
    const filteredAdditionalKits = existingAdditionalKits.filter(
      (path) => path
    );
    await config.update(
      'additionalKits',
      filteredAdditionalKits,
      vscode.ConfigurationTarget.Global
    );
  }

  static cmakeCompatiblePath(fsPath: string) {
    return path.normalize(fsPath).replace(/\\/g, '/');
  }

  static getCMakeGenerator() {
    const cmakeConfig = vscode.workspace.getConfiguration('cmake');
    const generator = cmakeConfig.get<string>('generator');
    return generator ? generator : CMakeKitFiles.CMakeDefaultGenerator;
  }

  static *generateMsvcKits(newKit: Kit, loadedCMakeKits: Kit[]) {
    const msvcInfoMatch =
      newKit.visualStudio?.match(CMakeKitFiles.MsvcInfoRegexp) ??
      newKit.visualStudio?.match(CMakeKitFiles.MsvcInfoNoArchRegexp);
    const vsYear = msvcInfoMatch?.at(1) ?? '';
    const architecture = msvcInfoMatch?.at(2) ?? '32';
    newKit.preferredGenerator = {
      ...newKit.preferredGenerator,
      ...{
        name: CMakeKitFiles.getCMakeGenerator()
        // toolset: 'host='+SupportedArchitectureMSVC
      }
    };
    if (architecture) {
      newKit = {
        ...newKit,
        ...{
          visualStudioArchitecture: architecture.toUpperCase()
        }
      };
    }
    const msvcKitsWithArchitectureMatch = loadedCMakeKits.filter((kit) => {
      const version = CMakeKitFiles.getMsvcYear(kit);
      const msvcTargetArch =
        kit.preferredGenerator?.platform ?? kit.visualStudioArchitecture ?? '';
      const targetArchitecture =
        CMakeKitFiles.MapMsvcPlatformToQt[msvcTargetArch];
      const isArchMatch = targetArchitecture == architecture;
      return isArchMatch && versions.compareVersions(version, vsYear) >= 0;
    });
    for (const kit of msvcKitsWithArchitectureMatch) {
      kit.name = qtpath.mangleQtInstallation(
        newKit.name + ' - ' + (kit.name || '')
      );
      if (kit.preferredGenerator) {
        if (newKit.preferredGenerator) {
          kit.preferredGenerator.name = newKit.preferredGenerator.name;
          if (
            kit.preferredGenerator.name == CMakeKitFiles.CMakeDefaultGenerator
          ) {
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
      } else {
        kit.preferredGenerator = newKit.preferredGenerator;
      }
      kit.environmentVariables = newKit.environmentVariables;
      kit.toolchainFile = newKit.toolchainFile;
      yield kit;
    }
  }

  static async loadCMakeKitsFileJSON(): Promise<Kit[]> {
    const data = await fs.readFile(this.CMAKE_KITS_FILEPATH);
    const stringData = data.toString();
    const json: unknown = JSON.parse(stringData);
    const kits = json as Kit[];
    return kits;
  }

  static readonly MsvcYearRegex = / (\d\d\d\d) /;
  static readonly MsvcMajorVersionNumberRegex = /VisualStudio\.(\d\d)\.\d /;
  static readonly MapMsvcMajorVersionToItsYear: Record<string, string> = {
    11: '2008',
    12: '2010',
    13: '2012',
    14: '2015',
    15: '2017',
    16: '2019',
    17: '2022'
  };
  static getMsvcYear(kit: Kit) {
    const year = kit.name.match(CMakeKitFiles.MsvcYearRegex)?.at(1);
    if (year) {
      return year;
    }
    const majorMsvcVersion = kit.name
      .match(CMakeKitFiles.MsvcMajorVersionNumberRegex)
      ?.at(1);
    if (majorMsvcVersion) {
      return CMakeKitFiles.MapMsvcMajorVersionToItsYear[majorMsvcVersion];
    }
    return '';
  }
}
