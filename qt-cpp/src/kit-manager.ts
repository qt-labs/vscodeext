// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as commandExists from 'command-exists';

import {
  PlatformExecutableExtension,
  UserLocalDir,
  createLogger,
  QtInsRootConfigName,
  AdditionalQtPathsName,
  GlobalWorkspace,
  compareVersions,
  findQtKits,
  isError,
  QtInfo
} from 'qt-lib';
import * as qtPath from '@util/get-qt-paths';
import { Project } from '@/project';
import { coreAPI } from '@/extension';
import { GlobalStateManager } from '@/state';

const logger = createLogger('kit-manager');

export const CMakeDefaultGenerator = 'Ninja Multi-Config';
const CMakeToolsDir = path.join(UserLocalDir, 'CMakeTools');
export const CMAKE_GLOBAL_KITS_FILEPATH = path.join(
  CMakeToolsDir,
  'cmake-tools-kits.json'
);

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
  projects = new Set<Project>();
  workspaceFile: vscode.Uri | undefined;
  globalStateManager: GlobalStateManager;
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

  public addProject(project: Project) {
    this.projects.add(project);
    void this.checkForQtInstallations(project);
  }

  public removeProject(project: Project) {
    this.projects.delete(project);
  }

  public async reset() {
    logger.info('Resetting KitManager');
    await this.updateQtKits('', []);
    await this.updateQtPathsQtKits([]);
    await this.globalStateManager.reset();
    for (const project of this.projects) {
      await this.updateQtKits('', [], project.getFolder());
      await this.updateQtPathsQtKits([], project.getFolder());
      await project.getStateManager().reset();
    }
  }

  public static getCMakeWorkspaceKitsFilepath(folder: vscode.WorkspaceFolder) {
    return path.join(folder.uri.fsPath, '.vscode', 'cmake-kits.json');
  }

  public async checkForAllQtInstallations() {
    await this.checkForGlobalQtInstallations();
    await this.checkForWorkspaceFolderQtInstallations();
  }

  // If the project parameter is undefined, it means that it is a global check
  // otherwise, it is a workspace folder check
  private async checkForQtInstallations(project?: Project) {
    const currentQtInsRoot = project
      ? KitManager.getWorkspaceFolderQtInsRoot(project.getFolder())
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
      ? KitManager.getWorkspaceFolderAdditionalQtPaths(project.getFolder())
      : getCurrentGlobalAdditionalQtPaths();

    if (project) {
      await this.updateQtKits(
        currentQtInsRoot,
        newQtInstallations,
        project.getFolder()
      );
      await this.updateQtPathsQtKits(additionalQtPaths, project.getFolder());
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
    const qtInstallations = await findQtKits(qtInsRoot);
    if (qtInsRoot) {
      KitManager.showQtInstallationsMessage(qtInsRoot, qtInstallations);
    }
    await this.updateQtKits(qtInsRoot, qtInstallations, workspaceFolder);
  }

  private static generateKitsFromQtPathsInfo(qtPaths: string[]) {
    const kits: Kit[] = [];
    for (const p of qtPaths) {
      const qtInfo = coreAPI?.getQtInfo(p);
      if (!qtInfo) {
        const warningMessage = `qtPaths info not found for "${p}".`;
        void vscode.window.showWarningMessage(warningMessage);
        logger.info(warningMessage);
        continue;
      }
      const kit = KitManager.generateKitFromQtInfo(qtInfo);
      if (kit) {
        logger.info('newKit: ' + JSON.stringify(kit));
        kits.push(kit);
      }
    }
    return kits;
  }

  private static generateKitFromQtInfo(qtInfo: QtInfo) {
    const kit: Kit = {
      name: '',
      isTrusted: true,
      cmakeSettings: {
        QT_QML_GENERATE_QMLLS_INI: 'ON'
      }
    };
    const version = qtInfo.get('QT_VERSION');
    kit.name = KitManager.kitNameFromQtInfo(qtInfo);
    const preferredGenerator = kit.name
      .toLowerCase()
      .includes('wasm-emscripten')
      ? 'Ninja'
      : CMakeDefaultGenerator;
    kit.preferredGenerator = {
      name: preferredGenerator
    };
    const isQt6 = version?.startsWith('6') ?? false;
    const libs = qtInfo.get('QT_INSTALL_LIBS');
    if (!libs) {
      return undefined;
    }
    const toolchainFile = path.join(
      libs,
      'cmake',
      isQt6 ? 'Qt6' : 'Qt5',
      `qt.toolchain.cmake`
    );
    kit.toolchainFile = toolchainFile;
    const tempPath: string[] = [];
    for (const [key, value] of qtInfo.qtpathsData) {
      if (key.startsWith('QMAKE_') || key === 'QT_VERSION' || !value) {
        continue;
      }
      tempPath.push(value);
    }
    tempPath.push('${env:PATH}');
    // Remove duplicates
    const pathEnv = Array.from(new Set(tempPath)).join(path.delimiter);
    kit.environmentVariables = {
      VSCODE_QT_QTPATHS_EXE: qtInfo.qtpathsExecutable,
      PATH: pathEnv
    };
    return kit;
  }

  public async updateQtPathsQtKits(
    paths: string[],
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    const generatedKits = KitManager.generateKitsFromQtPathsInfo(paths);
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
      await fs.writeFile(cmakeKitsFile, JSON.stringify(newKits, null, 2));
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
    const installationBinDir = path.join(installation, 'bin');
    const QtPathAddition = [
      installation,
      installationBinDir,
      '${env:PATH}'
    ].join(path.delimiter);
    return QtPathAddition;
  }

  private static async *generateCMakeKitsOfQtInstallationPath(
    qtInsRoot: string,
    installation: string,
    loadedCMakeKits: Kit[]
  ) {
    const promiseCmakeQtToolchainPath =
      qtPath.locateCMakeQtToolchainFile(installation);

    const qtRootDir = qtPath.qtRootByQtInstallation(installation);
    const promiseMingwPath = qtPath.locateMingwBinDirPath(qtRootDir);
    let qtPathEnv = KitManager.generateEnvPathForQtInstallation(installation);
    let locatedNinjaExePath = '';
    if (!commandExists.sync('ninja')) {
      const promiseNinjaExecutable = qtPath.locateNinjaExecutable(qtRootDir);
      locatedNinjaExePath = await promiseNinjaExecutable;
    }
    if (locatedNinjaExePath) {
      qtPathEnv += path.delimiter + path.dirname(locatedNinjaExePath);
    }
    const kitName = qtPath.mangleQtInstallation(qtInsRoot, installation);
    const kitPreferredGenerator = kitName.toLowerCase().includes('wasm_')
      ? 'Ninja'
      : CMakeDefaultGenerator;
    let newKit: Kit = {
      name: kitName,
      environmentVariables: {
        VSCODE_QT_INSTALLATION_ROOT: installation,
        PATH: qtPathEnv
      },
      isTrusted: true,
      preferredGenerator: {
        name: kitPreferredGenerator
      },
      cmakeSettings: {
        QT_QML_GENERATE_QMLLS_INI: 'ON'
      }
    };

    const toolchainFilePath = await promiseCmakeQtToolchainPath;
    if (toolchainFilePath) {
      newKit.toolchainFile = toolchainFilePath;
    }
    const toolchain = path.basename(installation);
    const tokens = toolchain.split('_');
    let platform = tokens[0] ?? '';
    if (platform != 'android') {
      if (platform.startsWith('msvc')) {
        newKit = {
          ...newKit,
          ...{
            visualStudio: toolchain,
            visualStudioArchitecture: tokens[-1]
          }
        };
        const msvcKitsClone: Kit[] = JSON.parse(
          JSON.stringify(loadedCMakeKits)
        ) as Kit[];
        logger.info(`MSVC kits clone: ${JSON.stringify(msvcKitsClone)}`);
        yield* KitManager.generateMsvcKits(newKit, msvcKitsClone);
        return;
      } else if (platform.startsWith('mingw')) {
        platform = os.platform();
        logger.info(`Platform: ${platform}`);
        const mingwDirPath = await promiseMingwPath;
        logger.info(`Mingw dir path: ${mingwDirPath}`);
        if (mingwDirPath) {
          if (newKit.environmentVariables == undefined) {
            newKit.environmentVariables = {};
          }
          newKit.environmentVariables.PATH = [
            newKit.environmentVariables.PATH,
            mingwDirPath
          ].join(path.delimiter);
          newKit = {
            ...newKit,
            ...{
              compilers: {
                C: path.join(mingwDirPath, 'gcc' + PlatformExecutableExtension),
                CXX: path.join(
                  mingwDirPath,
                  'g++' + PlatformExecutableExtension
                )
              }
            }
          };
        }
      } else if (platform.startsWith('linux')) {
        platform = 'linux';
      } else if (platform.startsWith('macos')) {
        platform = 'darwin';
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

  private static kitNameFromQtInfo(qtInfo: QtInfo) {
    const qtVersion = qtInfo.get('QT_VERSION');
    const targetMkSpec = qtInfo.get('QMAKE_XSPEC');
    return 'Qt-' + qtVersion + '-' + targetMkSpec;
  }

  private static async cmakeKitsFromQtInstallations(
    qtInstallationRoot: string,
    qtInstallations: string[]
  ) {
    const allCMakeKits = await KitManager.loadCMakeKitsFileJSON();
    logger.info(`qtInstallationRoot: "${qtInstallationRoot}"`);
    logger.info(`Loaded CMake kits: ${JSON.stringify(allCMakeKits)}`);
    // Filter out kits generated by us, since we only want to use Kits
    // that were created by the cmake extension as templates.
    const kitsFromCMakeExtension = allCMakeKits.filter(
      (kit) =>
        kit.environmentVariables?.VSCODE_QT_INSTALLATION_ROOT === undefined
    );
    logger.info(
      `Kits from CMake extension: ${JSON.stringify(kitsFromCMakeExtension)}`
    );
    logger.info(`Qt installations: ${JSON.stringify(qtInstallations)}`);
    const kits = [];
    for (const installation of qtInstallations)
      for await (const kit of KitManager.generateCMakeKitsOfQtInstallationPath(
        qtInstallationRoot,
        installation,
        kitsFromCMakeExtension
      ))
        kits.push(kit);
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
      // filter kits if previousQtKits contains the kit with the same name
      return !previousQtKits.find((prevKit) => prevKit.name === kit.name);
    });
    newKits.push(...newGeneratedKits);
    if (newKits.length !== 0 || fsSync.existsSync(cmakeKitsFile)) {
      await fs.writeFile(cmakeKitsFile, JSON.stringify(newKits, null, 2));
    }
  }

  private getProject(folder: vscode.WorkspaceFolder) {
    for (const project of this.projects) {
      if (project.getFolder() === folder) {
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

  private static *generateMsvcKits(newKit: Kit, loadedCMakeKits: Kit[]) {
    const msvcInfoMatch =
      newKit.visualStudio?.match(KitManager.MsvcInfoRegexp) ??
      newKit.visualStudio?.match(KitManager.MsvcInfoNoArchRegexp);
    const vsYear = msvcInfoMatch?.at(1) ?? '';
    logger.info('vsYear: ' + vsYear);
    logger.info('newKit.visualStudio: ' + newKit.visualStudio);
    const architecture = msvcInfoMatch?.at(2) ?? '32';
    newKit.preferredGenerator = {
      ...newKit.preferredGenerator,
      ...{
        name: KitManager.getCMakeGenerator()
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
    logger.info(
      'newKit.visualStudioArchitecture: ' + newKit.visualStudioArchitecture
    );
    const msvcKitsWithArchitectureMatch = loadedCMakeKits.filter((kit) => {
      const version = KitManager.getMsvcYear(kit);
      if (!version) {
        return false;
      }
      logger.info('version: ' + version);
      const msvcTargetArch =
        kit.preferredGenerator?.platform ?? kit.visualStudioArchitecture ?? '';
      logger.info('msvcTargetArch: ' + msvcTargetArch);
      const targetArchitecture = KitManager.MapMsvcPlatformToQt[msvcTargetArch];
      const isArchMatch = targetArchitecture == architecture;
      return isArchMatch && compareVersions(version, vsYear) >= 0;
    });
    for (const kit of msvcKitsWithArchitectureMatch) {
      // Replace `Visual Studio ` with `VS` in the kit name
      // Replace all ' ' with '_', '-' with '_' and multiple '_' with single '_'
      const tempKitName = kit.name
        .replace('Visual Studio ', 'VS')
        .replace(/[-_ ]+/g, '_');
      kit.name = qtPath.mangleMsvcKitName(newKit.name + '_' + tempKitName);
      if (kit.preferredGenerator) {
        if (newKit.preferredGenerator) {
          kit.preferredGenerator.name = newKit.preferredGenerator.name;
          if (kit.preferredGenerator.name == CMakeDefaultGenerator) {
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
    return coreAPI?.getValue<string[]>(folder, AdditionalQtPathsName) ?? [];
  }
}
export function getCurrentGlobalQtInstallationRoot(): string {
  return coreAPI?.getValue<string>(GlobalWorkspace, QtInsRootConfigName) ?? '';
}
export function getCurrentGlobalAdditionalQtPaths(): string[] {
  return (
    coreAPI?.getValue<string[]>(GlobalWorkspace, AdditionalQtPathsName) ?? []
  );
}
