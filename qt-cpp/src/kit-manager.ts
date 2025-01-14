// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import commandExists from 'command-exists';

import {
  OSExeSuffix,
  UserLocalDir,
  createLogger,
  QtInsRootConfigName,
  AdditionalQtPathsName,
  GlobalWorkspace,
  compareVersions,
  findQtKits,
  isError,
  QtInfo,
  QtAdditionalPath,
  generateDefaultQtPathsName,
  IsWindows,
  getVCPKGRoot,
  telemetry,
  TelemetryEventProperties,
  fileWriter
} from 'qt-lib';
import * as qtPath from '@util/get-qt-paths';
import { CppProject } from '@/project';
import { coreAPI } from '@/extension';
import { GlobalStateManager } from '@/state';
import { IsQtKit } from '@cmd/register-qt-path';
import { EXTENSION_ID } from '@/constants';
import { QtVersionFromKit } from '@util/util';

const logger = createLogger('kit-manager');

export const CMakeDefaultGenerator = 'Ninja';
const CMakeToolsDir = path.join(UserLocalDir, 'CMakeTools');
export const CMAKE_GLOBAL_KITS_FILEPATH = path.join(
  CMakeToolsDir,
  'cmake-tools-kits.json'
);

const envPath = '${env:PATH}';
type Environment = Record<string, string | undefined>;

interface CMakeGenerator {
  name: string;
  toolset?: string | undefined;
  platform?: string | undefined;
}

export interface Kit {
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
  preferredGenerator?: CMakeGenerator | undefined;

  /**
   * Additional settings to pass to CMake
   */
  cmakeSettings?: Record<string, string>;

  /**
   * Additional environment variables for the kit
   */
  environmentVariables?: Environment | undefined;

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
  visualStudioArchitecture?: string | undefined;

  /**
   * Filename of a shell script which sets environment variables for the kit
   */
  environmentSetupScript?: string;

  /**
   * Path to a CMake toolchain file.
   */
  toolchainFile?: string | undefined;

  /**
   * If `true`, keep this kit around even if it seems out-of-date
   */
  keep?: boolean;

  /**
   * If `true`, this kit comes from a trusted path.
   */
  isTrusted: boolean;
}

export class KitManager {
  projects = new Set<CppProject>();
  workspaceFile: vscode.Uri | undefined;
  globalStateManager: GlobalStateManager;
  static readonly MapMsvcPlatformToQt: Record<string, string> = {
    x64: '64',
    amd64_x86: '32',
    x86_amd64: '64',
    amd64: '64',
    win32: '32',
    x86: '32',
    x86_64: '64',
    i386: '32'
  };
  static readonly MsvcInfoRegexp = /msvc(\d\d\d\d)_(.+)/; // msvcYEAR_ARCH
  static readonly MsvcInfoNoArchRegexp = /msvc(\d\d\d\d)/; // msvcYEAR
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

  constructor(readonly context: vscode.ExtensionContext) {
    this.globalStateManager = new GlobalStateManager(context);
  }

  public addProject(project: CppProject) {
    this.projects.add(project);
  }

  public removeProject(project: CppProject) {
    this.projects.delete(project);
  }

  public async reset() {
    logger.info('Resetting KitManager');
    await this.updateQtKits('', []);
    await this.updateQtPathsQtKits([]);
    await this.globalStateManager.reset();
    for (const project of this.projects) {
      await this.updateQtKits('', [], project.folder);
      await this.updateQtPathsQtKits([], project.folder);
      await project.getStateManager().reset();
    }
  }

  public static getCMakeWorkspaceKitsFilepath(folder: vscode.WorkspaceFolder) {
    return path.join(folder.uri.fsPath, '.vscode', 'cmake-kits.json');
  }

  public async checkForAllQtInstallations() {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Updating kits'
      },
      async () => {
        await this.checkForGlobalQtInstallations();
        await this.checkForWorkspaceFolderQtInstallations();
      }
    );
  }

  // If the project parameter is undefined, it means that it is a global check
  // otherwise, it is a workspace folder check
  public async checkForQtInstallations(project?: CppProject) {
    const currentQtInsRoot = project
      ? KitManager.getWorkspaceFolderQtInsRoot(project.folder)
      : getCurrentGlobalQtInstallationRoot();
    const newQtInstallations = currentQtInsRoot
      ? await findQtKits(currentQtInsRoot)
      : [];
    if (currentQtInsRoot) {
      KitManager.showQtInstallationsMessage(
        currentQtInsRoot,
        newQtInstallations
      );
    }
    const additionalQtPaths = project
      ? KitManager.getWorkspaceFolderAdditionalQtPaths(project.folder)
      : getCurrentGlobalAdditionalQtPaths();

    if (project) {
      await this.updateQtKits(
        currentQtInsRoot,
        newQtInstallations,
        project.folder
      );
      await this.updateQtPathsQtKits(additionalQtPaths, project.folder);
    } else {
      await this.updateQtKits(currentQtInsRoot, newQtInstallations);
      await this.updateQtPathsQtKits(additionalQtPaths);
    }
  }

  private async checkForGlobalQtInstallations() {
    await this.checkForQtInstallations();
  }

  private async checkForWorkspaceFolderQtInstallations() {
    for (const project of this.projects) {
      await this.checkForQtInstallations(project);
    }
  }

  private static showQtInstallationsMessage(
    qtInsRoot: string,
    qtInstallations: string[]
  ) {
    if (qtInstallations.length === 0) {
      const warningMessage = `Cannot find a Qt installation in "${qtInsRoot}".`;
      void vscode.window.showWarningMessage(warningMessage);
      logger.info(warningMessage);
    } else {
      const infoMessage = `Found ${qtInstallations.length} Qt installation(s) in "${qtInsRoot}".`;
      void vscode.window.showInformationMessage(infoMessage);
      logger.info(infoMessage);
    }
  }

  public async onQtInstallationRootChanged(
    qtInsRoot: string,
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    // Set only for the global workspace
    if (!workspaceFolder && qtInsRoot) {
      void tryToUseCMakeFromQtTools();
    }
    const qtInstallations = await findQtKits(qtInsRoot);
    if (qtInsRoot) {
      KitManager.showQtInstallationsMessage(qtInsRoot, qtInstallations);
    }
    void vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Updating kits'
      },
      async () => {
        await this.updateQtKits(qtInsRoot, qtInstallations, workspaceFolder);
      }
    );
  }
  public async onQtPathsChanged(
    additionalQtPaths: QtAdditionalPath[],
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Updating kits'
      },
      async () => {
        return this.updateQtPathsQtKits(additionalQtPaths, workspaceFolder);
      }
    );
  }

  private static async generateKitsFromQtPathsInfo(
    qtPaths: QtAdditionalPath[]
  ) {
    const kits: Kit[] = [];
    const cmakeKits = IsWindows
      ? KitManager.getKitsByCMakeExtension()
      : undefined;
    for (const p of qtPaths) {
      const qtInfo = coreAPI?.getQtInfo(p);
      if (!qtInfo) {
        const warningMessage = `qtPaths info not found for "${p.path}".`;
        void vscode.window.showWarningMessage(warningMessage);
        logger.info(warningMessage);
        continue;
      }
      const kit = KitManager.generateKitFromQtInfo(qtInfo, await cmakeKits);
      for await (const k of kit) {
        logger.info('newKit: ' + JSON.stringify(k));
        if (k) {
          kits.push(k);
        }
      }
    }
    return kits;
  }
  private static initKitWithCommonSettings() {
    const kit: Kit = {
      name: '',
      isTrusted: true,
      preferredGenerator: {
        name: CMakeDefaultGenerator
      },
      cmakeSettings: {
        QT_QML_GENERATE_QMLLS_INI: 'ON',
        CMAKE_CXX_FLAGS_DEBUG_INIT: '-DQT_QML_DEBUG -DQT_DECLARATIVE_DEBUG',
        CMAKE_CXX_FLAGS_RELWITHDEBINFO_INIT:
          '-DQT_QML_DEBUG -DQT_DECLARATIVE_DEBUG'
      }
    };
    return kit;
  }

  private static *generateKitFromQtInfo(qtInfo: QtInfo, cmakeOnlyKits?: Kit[]) {
    const kit = KitManager.initKitWithCommonSettings();
    const version = qtInfo.get('QT_VERSION');
    kit.name = qtInfo.name ? qtInfo.name : generateDefaultQtPathsName(qtInfo);
    const libs = qtInfo.get('QT_INSTALL_LIBS');
    if (!libs) {
      return undefined;
    }

    const isQt6 = version?.startsWith('6') ?? false;
    if (isQt6) {
      const toolchainFile = qtInfo.isVCPKG
        ? KitManager.getVCPKGToolchainFile()
        : path.join(libs, 'cmake', 'Qt6', `qt.toolchain.cmake`);
      if (!toolchainFile || !fsSync.existsSync(toolchainFile)) {
        const warn = `Toolchain file not found: ${toolchainFile}`;
        void vscode.window.showWarningMessage(warn);
        logger.error(warn);
        return undefined;
      }
      kit.toolchainFile = toolchainFile;
    }

    const tempPath: string[] = [];
    for (const [key, value] of qtInfo.data) {
      if (
        key.startsWith('QMAKE_') ||
        key === 'QT_VERSION' ||
        !value ||
        !key.startsWith('QT_')
      ) {
        continue;
      }
      tempPath.push(value);
    }
    tempPath.push(envPath);
    // Remove duplicates
    const pathEnv = Array.from(new Set(tempPath)).join(path.delimiter);
    kit.environmentVariables = {
      VSCODE_QT_QTPATHS_EXE: qtInfo.qtPathsBin,
      PATH: pathEnv
    };
    if (qtInfo.get('QMAKE_XSPEC')?.includes('-msvc')) {
      const msvcKitsClone: Kit[] = JSON.parse(
        JSON.stringify(cmakeOnlyKits)
      ) as Kit[];
      logger.info(`MSVC kits clone: ${JSON.stringify(msvcKitsClone)}`);
      const msvcMajor = Number(qtInfo.get(`MSVC_MAJOR_VERSION`) ?? '-1') * 100;
      const msvcMinor = Number(qtInfo.get(`MSVC_MINOR_VERSION`) ?? '-1');
      if (msvcMajor < 0 || msvcMinor < 0) {
        logger.warn(`MSVC version: ${msvcMajor}.${msvcMinor}`);
        yield undefined;
        return;
      }
      const vsyear = KitManager.convertMSCVERToYear(msvcMajor + msvcMinor);
      if (!vsyear) {
        logger.warn(`vsyear: ${vsyear}`);
        yield undefined;
        return;
      }
      const arch = KitManager.MapMsvcPlatformToQt[qtInfo.get('ARCH') ?? ''];
      if (!arch) {
        logger.warn(`arch: ${arch}`);
        yield undefined;
        return;
      }
      yield* KitManager.generateMsvcKits(
        kit,
        msvcKitsClone,
        arch,
        vsyear,
        qtInfo.name
      );
      return;
    }
    yield kit;
  }
  private static convertMSCVERToYear(mscver: number) {
    switch (mscver) {
      case 1600:
        return '2010';
      case 1700:
        return '2012';
      case 1800:
        return '2013';
      case 1900:
        return '2015';
    }
    if (mscver >= 1910 && mscver <= 1916) {
      return '2017';
    }
    if (mscver >= 1920 && mscver <= 1929) {
      return '2019';
    }
    if (mscver >= 1930 && mscver <= 1939) {
      return '2022';
    }
    return undefined;
  }

  public async updateQtPathsQtKits(
    paths: QtAdditionalPath[],
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    const generatedKits = await KitManager.generateKitsFromQtPathsInfo(paths);
    logger.info(`QtPaths Generated kits: ${JSON.stringify(generatedKits)}`);
    await this.updateCMakeKitsJsonForQtPathsQtKits(
      generatedKits,
      workspaceFolder
    );
    if (workspaceFolder) {
      await this.getProject(workspaceFolder)
        ?.getStateManager()
        .setWorkspaceQtPathsQtKits(generatedKits);
      return;
    }
    await this.globalStateManager.setGlobalQtPathsQtKits(generatedKits);
  }

  private static async parseCMakeKitsFile(cmakeKitsFile: string) {
    if (!fsSync.existsSync(cmakeKitsFile)) {
      return [];
    }
    const cmakeKitsFileContent = await fs.readFile(cmakeKitsFile, 'utf8');
    let currentKits: Kit[] = [];
    currentKits = JSON.parse(cmakeKitsFileContent) as Kit[];
    return currentKits;
  }

  private async updateCMakeKitsJsonForQtPathsQtKits(
    newGeneratedKits: Kit[],
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    let previousQtKits: Kit[] = [];
    if (workspaceFolder) {
      const projectStateManager =
        this.getProject(workspaceFolder)?.getStateManager();
      if (projectStateManager) {
        previousQtKits = projectStateManager.getWorkspaceQtPathsQtKits();
      }
    } else {
      previousQtKits = this.globalStateManager.getGlobalQtPathsQtKits();
    }
    const cmakeKitsFile = workspaceFolder
      ? path.join(workspaceFolder.uri.fsPath, '.vscode', 'cmake-kits.json')
      : CMAKE_GLOBAL_KITS_FILEPATH;
    const currentKits = await KitManager.parseCMakeKitsFile(cmakeKitsFile);
    const newKits = currentKits.filter((kit) => {
      // filter kits if previousQtKits contains the kit with the same name
      return !previousQtKits.find((prevKit) => prevKit.name === kit.name);
    });
    newKits.push(...newGeneratedKits);
    if (newKits.length !== 0 || fsSync.existsSync(cmakeKitsFile)) {
      await fileWriter.push(
        cmakeKitsFile,
        JSON.stringify(newKits, null, 2),
        (err: Error | null | undefined) => {
          if (err) {
            logger.error('Error writing to cmake-kits.json:', err.message);
            throw err;
          } else {
            logger.info(`Successfully wrote to ${cmakeKitsFile}`);
          }
        }
      );
    }
  }

  private static async loadCMakeKitsFileJSON(): Promise<Kit[]> {
    if (!fsSync.existsSync(CMAKE_GLOBAL_KITS_FILEPATH)) {
      return [];
    }
    const data = await fs.readFile(CMAKE_GLOBAL_KITS_FILEPATH);
    const stringData = data.toString();
    let kits: Kit[] = [];
    try {
      kits = JSON.parse(stringData) as Kit[];
    } catch (error) {
      if (isError(error)) {
        logger.error('Error parsing cmake-kits.json:', error.message);
      }
    }
    return kits;
  }

  private static generateEnvPathForQtInstallation(installation: string) {
    if (!IsWindows) {
      return undefined;
    }
    const installationBinDir = path.join(installation, 'bin');
    const QtPathAddition = [installationBinDir, envPath].join(path.delimiter);
    return QtPathAddition;
  }

  private static async *generateCMakeKitsOfQtInstallationPath(
    qtInsRoot: string,
    installation: string,
    loadedCMakeKits: Kit[]
  ) {
    const promiseCmakeQtToolchainPath =
      qtPath.locateCMakeQtToolchainFile(installation);

    const promiseMingwPath = qtPath.locateMingwBinDirPath(qtInsRoot);
    let qtPathEnv = KitManager.generateEnvPathForQtInstallation(installation);
    let locatedNinjaExePath = '';
    if (!commandExists.sync('ninja')) {
      const promiseNinjaExecutable = qtPath.locateNinjaExecutable(qtInsRoot);
      locatedNinjaExePath = await promiseNinjaExecutable;
    }
    if (locatedNinjaExePath) {
      if (qtPathEnv) {
        qtPathEnv += path.delimiter + path.dirname(locatedNinjaExePath);
      } else {
        qtPathEnv = path.dirname(locatedNinjaExePath);
      }
    }
    const kitName = qtPath.mangleQtInstallation(qtInsRoot, installation);
    let newKit = KitManager.initKitWithCommonSettings();
    newKit.name = kitName;
    newKit.environmentVariables = {
      VSCODE_QT_INSTALLATION: installation,
      PATH: qtPathEnv
    };

    const toolchainFilePath = await promiseCmakeQtToolchainPath;
    if (toolchainFilePath) {
      newKit.toolchainFile = toolchainFilePath;
    }
    const toolchain = path.basename(installation);
    const tokens = toolchain.split('_');
    const platform = tokens[0] ?? '';
    if (platform != 'android') {
      if (platform.startsWith('msvc')) {
        const msvcKitsClone: Kit[] = JSON.parse(
          JSON.stringify(loadedCMakeKits)
        ) as Kit[];
        logger.info(`MSVC kits clone: ${JSON.stringify(msvcKitsClone)}`);
        const msvcInfoMatch =
          toolchain.match(KitManager.MsvcInfoRegexp) ??
          toolchain.match(KitManager.MsvcInfoNoArchRegexp);
        const vsYear = msvcInfoMatch?.at(1) ?? '';
        const architecture = msvcInfoMatch?.at(2) ?? '32';
        yield* KitManager.generateMsvcKits(
          newKit,
          msvcKitsClone,
          architecture,
          vsYear
        );
        return;
      } else if (platform.startsWith('mingw')) {
        const mingwDirPath = await promiseMingwPath;
        logger.info(`Mingw dir path: ${mingwDirPath}`);
        if (mingwDirPath) {
          newKit.environmentVariables.PATH = [
            newKit.environmentVariables.PATH,
            mingwDirPath
          ].join(path.delimiter);
          newKit = {
            ...newKit,
            ...{
              compilers: {
                C: path.join(mingwDirPath, 'gcc' + OSExeSuffix),
                CXX: path.join(mingwDirPath, 'g++' + OSExeSuffix)
              }
            }
          };
        }
      } else if (platform.startsWith('macos')) {
        newKit = {
          ...newKit,
          ...{
            compilers: {
              C: '/usr/bin/clang',
              CXX: '/usr/bin/clang++'
            }
          }
        };
      } else if (platform.startsWith('ios')) {
        newKit.preferredGenerator = {
          name: 'Xcode'
        };

        const iosSimulatorKit = {
          ...newKit,
          ...{
            name: newKit.name + '-simulator',
            cmakeSettings: {
              ...newKit.cmakeSettings,
              CMAKE_OSX_ARCHITECTURES: 'x86_64',
              CMAKE_OSX_SYSROOT: 'iphonesimulator'
            }
          }
        };
        yield* [newKit, iosSimulatorKit];
        return;
      }
    }
    logger.info('newKit: ' + JSON.stringify(newKit));
    yield newKit;
  }

  private static async getKitsByCMakeExtension() {
    const allCMakeKits = await KitManager.loadCMakeKitsFileJSON();
    logger.info(`Loaded CMake kits: ${JSON.stringify(allCMakeKits)}`);
    // Filter out kits generated by us, since we only want to use Kits
    // that were created by the cmake extension as templates.
    return allCMakeKits.filter((kit) => !IsQtKit(kit));
  }

  private static async cmakeKitsFromQtInstallations(
    qtInstallationRoot: string,
    qtInstallations: string[]
  ) {
    logger.info(`qtInstallationRoot: "${qtInstallationRoot}"`);
    const kitsFromCMakeExtension = await KitManager.getKitsByCMakeExtension();
    logger.info(
      `Kits from CMake extension: ${JSON.stringify(kitsFromCMakeExtension)}`
    );
    logger.info(`Qt installations: ${JSON.stringify(qtInstallations)}`);
    const kits = [];
    for (const installation of qtInstallations) {
      for await (const kit of KitManager.generateCMakeKitsOfQtInstallationPath(
        qtInstallationRoot,
        installation,
        kitsFromCMakeExtension
      )) {
        kits.push(kit);
      }
    }
    return kits;
  }

  private async updateQtKits(
    qtInstallationRoot: string,
    qtInstallations: string[],
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    const newGeneratedKits = await KitManager.cmakeKitsFromQtInstallations(
      qtInstallationRoot,
      qtInstallations
    );
    logger.info(`New generated kits: ${JSON.stringify(newGeneratedKits)}`);
    await this.updateCMakeKitsJson(newGeneratedKits, workspaceFolder);

    if (workspaceFolder) {
      await this.getProject(workspaceFolder)
        ?.getStateManager()
        .setWorkspaceQtKits(newGeneratedKits);
      return;
    }
    await this.globalStateManager.setGlobalQtKits(newGeneratedKits);
  }

  private async updateCMakeKitsJson(
    newGeneratedKits: Kit[],
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    let previousQtKits: Kit[] = [];
    if (workspaceFolder) {
      const projectStateManager =
        this.getProject(workspaceFolder)?.getStateManager();
      if (projectStateManager) {
        previousQtKits = projectStateManager.getWorkspaceQtKits();
      }
    } else {
      previousQtKits = this.globalStateManager.getGlobalQtKits();
    }
    const cmakeKitsFile = workspaceFolder
      ? path.join(workspaceFolder.uri.fsPath, '.vscode', 'cmake-kits.json')
      : CMAKE_GLOBAL_KITS_FILEPATH;
    const currentKits = await KitManager.parseCMakeKitsFile(cmakeKitsFile);
    const newKits = currentKits.filter((kit) => {
      // Filter kits if previousQtKits contains the kit with the same name
      // Otherwise, we will have duplicate Qt kits.
      return !previousQtKits.find((prevKit) => prevKit.name === kit.name);
    });
    newKits.push(...newGeneratedKits);
    if (newKits.length !== 0 || fsSync.existsSync(cmakeKitsFile)) {
      await fileWriter.push(
        cmakeKitsFile,
        JSON.stringify(newKits, null, 2),
        (err: Error | null | undefined) => {
          if (err) {
            logger.error('Error writing to cmake-kits.json:', err.message);
            throw err;
          } else {
            logger.info(`Successfully wrote to ${cmakeKitsFile}`);
          }
        }
      );
    }
  }

  private getProject(folder: vscode.WorkspaceFolder) {
    for (const project of this.projects) {
      if (project.folder === folder) {
        return project;
      }
    }
    return undefined;
  }

  private static getCMakeGenerator() {
    const cmakeConfig = vscode.workspace.getConfiguration('cmake');
    const generator = cmakeConfig.get<string>('generator');
    return generator ? generator : CMakeDefaultGenerator;
  }

  private static *generateMsvcKits(
    newKit: Kit,
    loadedCMakeKits: Kit[],
    architecture: string,
    vsYear: string,
    kitName?: string
  ) {
    logger.info('vsYear: ' + vsYear);
    logger.info('architecture: ' + architecture);
    newKit.preferredGenerator = {
      ...newKit.preferredGenerator,
      ...{
        name: KitManager.getCMakeGenerator()
        // toolset: 'host='+SupportedArchitectureMSVC
      }
    };
    const msvcKitsWithArchitectureMatch = loadedCMakeKits.filter((kit) => {
      const version = KitManager.getMsvcYear(kit);
      if (!version) {
        return false;
      }
      logger.info('version: ' + version);
      const msvcTargetArch = kit.visualStudioArchitecture ?? '';
      const msvcTargetPlatformArch = kit.preferredGenerator?.platform ?? '';
      logger.info('msvcTargetArch: ' + msvcTargetArch);
      const targetArchitecture = KitManager.MapMsvcPlatformToQt[msvcTargetArch];
      const targetPlatformArch =
        KitManager.MapMsvcPlatformToQt[msvcTargetPlatformArch];
      const isArchMatch =
        targetArchitecture == architecture &&
        targetPlatformArch == architecture;
      return isArchMatch && compareVersions(version, vsYear) >= 0;
    });
    for (const kit of msvcKitsWithArchitectureMatch) {
      // Replace `Visual Studio ` with `VS` in the kit name
      // Replace all ' ' with '_', '-' with '_' and multiple '_' with single '_'
      const kitNameSuffix = kit.name
        .replace('Visual Studio ', 'VS')
        .replace(/[-_ ]+/g, '_');
      kit.name = qtPath.mangleMsvcKitName(
        (kitName ?? newKit.name) + '_' + kitNameSuffix
      );
      if (kit.preferredGenerator) {
        kit.preferredGenerator.name = newKit.preferredGenerator.name;
        if (kit.preferredGenerator.name.startsWith('Ninja')) {
          if (newKit.cmakeSettings) {
            if (kit.cmakeSettings == undefined) {
              kit.cmakeSettings = {};
            }
            kit.cmakeSettings = {
              ...newKit.cmakeSettings,
              ...kit.cmakeSettings
            };
          }
          // Ninja generators do not support platform & toolset specification.
          kit.preferredGenerator.platform = undefined;
          kit.preferredGenerator.toolset = undefined;
        }
      } else {
        kit.preferredGenerator = newKit.preferredGenerator;
      }
      kit.environmentVariables = newKit.environmentVariables;
      kit.toolchainFile = newKit.toolchainFile;
      logger.info('kit: ' + JSON.stringify(kit));
      yield kit;
    }
  }

  private static getMsvcYear(kit: Kit) {
    const year = kit.name.match(KitManager.MsvcYearRegex)?.at(1) ?? '';
    if (year) {
      return year;
    }
    const majorMsvcVersion = kit.name
      .match(KitManager.MsvcMajorVersionNumberRegex)
      ?.at(1);
    if (majorMsvcVersion) {
      return KitManager.MapMsvcMajorVersionToItsYear[majorMsvcVersion] ?? '';
    }
    return '';
  }

  public static getWorkspaceFolderQtInsRoot(folder: vscode.WorkspaceFolder) {
    return coreAPI?.getValue<string>(folder, QtInsRootConfigName) ?? '';
  }
  public static getWorkspaceFolderAdditionalQtPaths(
    folder: vscode.WorkspaceFolder
  ) {
    return (
      coreAPI?.getValue<QtAdditionalPath[]>(folder, AdditionalQtPathsName) ?? []
    );
  }
  private static getVCPKGToolchainFile() {
    const vckpgRoot = getVCPKGRoot();
    if (!vckpgRoot) {
      return undefined;
    }
    return path.join(vckpgRoot, 'scripts', 'buildsystems', 'vcpkg.cmake');
  }
}
export function getCurrentGlobalQtInstallationRoot(): string {
  return coreAPI?.getValue<string>(GlobalWorkspace, QtInsRootConfigName) ?? '';
}
export function getCurrentGlobalAdditionalQtPaths(): QtAdditionalPath[] {
  return (
    coreAPI?.getValue<QtAdditionalPath[]>(
      GlobalWorkspace,
      AdditionalQtPathsName
    ) ?? []
  );
}

export async function tryToUseCMakeFromQtTools() {
  if (getDoNotAskForCMakePath()) {
    logger.info('doNotAskForCMakePath is set');
    return;
  }
  // check if cmake.cmakePath is set
  const cmakePathConfig = 'cmakePath';
  const cmakeConfig = vscode.workspace.getConfiguration('cmake');

  const IsCustomCmakePath =
    cmakeConfig.get<string>(cmakePathConfig) !== 'cmake';
  if (IsCustomCmakePath || commandExists.sync('cmake')) {
    return;
  }

  const cmakeExePath = await qtPath.locateCMakeExecutable(
    getCurrentGlobalQtInstallationRoot()
  );
  if (!cmakeExePath) {
    return;
  }
  const setCMakePath = () => {
    logger.info(`Setting cmakePath to ${cmakeExePath}`);
    void cmakeConfig.update(
      cmakePathConfig,
      cmakeExePath,
      vscode.ConfigurationTarget.Global
    );
  };
  // Ask users if they want to set cmakePath to the cmake executable found in Qt installation
  const message = `CMake executable found in Qt installation: "${cmakeExePath}"`;
  logger.info(message);
  const use = 'Use';
  void vscode.window
    .showInformationMessage(
      `${message}, would you like to use it?`,
      use,
      'Do not ask again'
    )
    .then((selection) => {
      if (selection === use) {
        setCMakePath();
      } else if (selection === 'Do not ask again') {
        void setDoNotAskForCMakePath(true);
      }
    });
}
export function analyzeKit(kit: Kit) {
  let result: TelemetryEventProperties | undefined;
  const toolchainType = analyzeToolchain(kit);
  if (toolchainType) {
    result = {
      toolchainType: toolchainType
    };
  }
  const version = QtVersionFromKit(kit);
  if (version) {
    result = {
      ...result,
      version: version
    };
  }
  if (result) {
    telemetry.sendConfig('kitInfo', result);
  }
}

function analyzeToolchain(kit: Kit) {
  const insPath = kit.environmentVariables?.VSCODE_QT_INSTALLATION;
  const qtpaths = kit.environmentVariables?.VSCODE_QT_QTPATHS_EXE;

  let toolchainType: string | undefined;

  if (insPath) {
    const split = insPath.split(path.sep);
    toolchainType = split[split.length - 1];
  } else if (qtpaths) {
    // If the toolchain file is vcpkg.cmake, we can infer that it's a vcpkg toolchain
    if (kit.toolchainFile) {
      const parsed = path.parse(kit.toolchainFile);
      if (parsed.base === 'vcpkg.cmake') {
        toolchainType = 'vcpkg';
      }
    }
    // TODO: parse qconfig.pri to get more detailed info
    if (!toolchainType) {
      const qtInfo = coreAPI?.getQtInfoFromPath(qtpaths);
      toolchainType = qtInfo?.get('QMAKE_XSPEC');
    }
  }

  if (toolchainType) {
    return toolchainType;
  }

  return undefined;
}
async function setDoNotAskForCMakePath(value: boolean) {
  await vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .update('doNotAskForCMakePath', value, vscode.ConfigurationTarget.Global);
}

function getDoNotAskForCMakePath(): boolean {
  return (
    vscode.workspace
      .getConfiguration(EXTENSION_ID)
      .get<boolean>('doNotAskForCMakePath') ?? false
  );
}
