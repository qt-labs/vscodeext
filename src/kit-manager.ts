// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as commandExists from 'command-exists';

import * as qtPath from '@util/get-qt-paths';
import * as versions from '@util/versions';
import * as util from '@util/util';
import { Project } from '@/project';
import { GlobalStateManager, WorkspaceStateManager } from '@/state';
import { createLogger } from '@/logger';

const logger = createLogger('kit-manager');

export const CMakeDefaultGenerator = 'Ninja Multi-Config';
const CMakeToolsDir = path.join(qtPath.UserLocalDir, 'CMakeTools');
export const CMAKE_GLOBAL_KITS_FILEPATH = path.join(
  CMakeToolsDir,
  'cmake-tools-kits.json'
);

type CompilerVendorEnum = 'Clang' | 'GCC' | 'MSVC';

type Environment = Record<string, string | undefined>;

interface CMakeGenerator {
  name: string;
  toolset?: string;
  platform?: string;
}

interface KitDetect {
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
  environmentVariables?: Environment;

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

export class KitManager {
  projects = new Set<Project>();
  workspaceFile: vscode.Uri | undefined;
  globalStateManager: GlobalStateManager;
  static readonly QtFolderConfig = 'qtFolder';
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
    this.watchGlobalConfig(context);
  }

  public addProject(project: Project) {
    this.projects.add(project);
    this.watchWorkspaceFolderConfig(this.context, project.getFolder());
    void this.checkForQtInstallations(project);
  }

  public addWorkspaceFile(workspaceFile: vscode.Uri) {
    this.workspaceFile = workspaceFile;
    this.watchWorkspaceFileConfig(this.context);
  }

  public removeProject(project: Project) {
    this.projects.delete(project);
  }

  public static getCurrentGlobalQtFolder(): string {
    const qtFolderConfig = this.getConfiguration().inspect<string>(
      KitManager.QtFolderConfig
    );
    return qtFolderConfig?.globalValue ?? '';
  }

  public async reset() {
    logger.info('Resetting KitManager');
    await this.updateQtInstallations('', []);
    await this.globalStateManager.reset();
    for (const project of this.projects) {
      await this.updateQtInstallations('', [], project.getFolder());
      await project.getStateManager().reset();
    }
  }

  static async setGlobalQtFolder(qtFolder: string) {
    logger.info(`Setting global Qt folder to: ${qtFolder}`);
    const config = vscode.workspace.getConfiguration('qt-official');
    const configTarget = util.isTestMode()
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await config.update(KitManager.QtFolderConfig, qtFolder, configTarget);
  }

  public static getCMakeWorkspaceKitsFilepath(folder: vscode.WorkspaceFolder) {
    return path.join(folder.uri.fsPath, '.vscode', 'cmake-kits.json');
  }

  public async checkForAllQtInstallations() {
    await this.checkForGlobalQtInstallations();
    await this.checkForWorkspaceFolderQtInstallations();
  }

  private watchWorkspaceFileConfig(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        (e: vscode.ConfigurationChangeEvent) => {
          void e;
          if (this.getWorkspaceFileQtFolder() !== '') {
            void vscode.window.showWarningMessage(
              `Qt folder specified in workspace file is not supported.`
            );
          }
        }
      )
    );
  }

  // If the project parameter is undefined, it means that it is a global check
  // otherwise, it is a workspace folder check
  private async checkForQtInstallations(project?: Project) {
    const currentQtFolder = project
      ? KitManager.getWorkspaceFolderQtFolder(project.getFolder())
      : KitManager.getCurrentGlobalQtFolder();

    const previousQtFolder = project
      ? project.getStateManager().getQtFolder()
      : this.globalStateManager.getQtFolder();
    if (currentQtFolder !== previousQtFolder) {
      project
        ? await this.onQtFolderUpdated(currentQtFolder, project.getFolder())
        : await this.onQtFolderUpdated(currentQtFolder);
    }
    const newQtInstallations = currentQtFolder
      ? await KitManager.findQtInstallations(currentQtFolder)
      : [];
    project
      ? await this.updateQtInstallations(
          currentQtFolder,
          newQtInstallations,
          project.getFolder()
        )
      : await this.updateQtInstallations(currentQtFolder, newQtInstallations);
  }

  private async checkForGlobalQtInstallations() {
    await this.checkForQtInstallations();
  }

  private async checkForWorkspaceFolderQtInstallations() {
    for (const project of this.projects) {
      await this.checkForQtInstallations(project);
    }
  }

  static async findQtInstallations(dir: string): Promise<string[]> {
    if (!dir || !fsSync.existsSync(dir)) {
      return [];
    }
    const qtInstallations: string[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && qtPath.matchesVersionPattern(item.name)) {
        const installationItemPath = path.join(dir, item.name);
        const installationItemDirContent = await fs.readdir(
          installationItemPath,
          { withFileTypes: true }
        );
        for (const subitem of installationItemDirContent) {
          if (subitem.isDirectory() && subitem.name.toLowerCase() != 'src') {
            const subdirFullPath = path.join(
              installationItemPath,
              subitem.name
            );
            const qtConfPath = path.join(subdirFullPath, 'bin', 'qt.conf');
            try {
              await fs.access(qtConfPath).then(() => {
                qtInstallations.push(subdirFullPath);
              });
            } catch (err) {
              if (util.isError(err)) {
                logger.error(err.message);
              }
            }
          }
        }
      }
    }
    return qtInstallations;
  }

  private async saveSelectedQt(
    qtFolder: string,
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    const qtInstallations = await KitManager.findQtInstallations(qtFolder);
    if (qtFolder) {
      if (qtInstallations.length === 0) {
        const warningMessage = `Cannot find a Qt installation in "${qtFolder}".`;
        void vscode.window.showWarningMessage(warningMessage);
        logger.info(warningMessage);
      } else {
        const infoMessage = `Found ${qtInstallations.length} Qt installation(s) in "${qtFolder}".`;
        void vscode.window.showInformationMessage(infoMessage);
        logger.info(infoMessage);
      }
    }
    await this.updateQtInstallations(
      qtFolder,
      qtInstallations,
      workspaceFolder
    );
    if (workspaceFolder) {
      await this.getProject(workspaceFolder)
        ?.getStateManager()
        .setQtFolder(qtFolder);
      return;
    }
    await this.globalStateManager.setQtFolder(qtFolder);
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
      if (util.isError(error)) {
        logger.error('Error parsing cmake-kits.json:', error.message);
      }
    }
    return kits;
  }

  private static async *generateCMakeKitsOfQtInstallationPath(
    qtFolder: string,
    installation: string,
    loadedCMakeKits: Kit[]
  ) {
    const promiseCmakeQtToolchainPath =
      qtPath.locateCMakeQtToolchainFile(installation);

    const qtRootDir = qtPath.qtRootByQtInstallation(installation);
    const promiseMingwPath = qtPath.locateMingwBinDirPath(qtRootDir);
    let qtPathEnv = qtPath.generateEnvPathForQtInstallation(installation);
    let locatedNinjaExePath = '';
    if (!commandExists.sync('ninja')) {
      const promiseNinjaExecutable = qtPath.locateNinjaExecutable(qtRootDir);
      locatedNinjaExePath = await promiseNinjaExecutable;
    }
    if (locatedNinjaExePath) {
      qtPathEnv += path.delimiter + path.dirname(locatedNinjaExePath);
    }
    const kitName = qtPath.mangleQtInstallation(qtFolder, installation);
    const kitPreferredGenerator = kitName.toLowerCase().includes('wasm_')
      ? 'Ninja'
      : CMakeDefaultGenerator;
    let newKit: Kit = {
      name: kitName,
      environmentVariables: {
        VSCODE_QT_FOLDER: installation,
        PATH: qtPathEnv
      },
      isTrusted: true,
      preferredGenerator: {
        name: kitPreferredGenerator
      }
    };

    const toolchainFilePath = await promiseCmakeQtToolchainPath;
    if (toolchainFilePath) {
      newKit.toolchainFile = toolchainFilePath;
    }
    const toolchain = path.basename(installation);
    const tokens = toolchain.split('_');
    let platform = tokens[0];
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
                C: path.join(
                  mingwDirPath,
                  'gcc' + qtPath.PlatformExecutableExtension
                ),
                CXX: path.join(
                  mingwDirPath,
                  'g++' + qtPath.PlatformExecutableExtension
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

  private static async cmakeKitsFromQtInstallations(
    qtFolder: string,
    qtInstallations: string[]
  ) {
    const loadedCMakeKits = await KitManager.loadCMakeKitsFileJSON();
    logger.info(`qtFolder: "${qtFolder}"`);
    logger.info(`Loaded CMake kits: ${JSON.stringify(loadedCMakeKits)}`);
    logger.info(`Qt installations: ${JSON.stringify(qtInstallations)}`);
    const kits = [];
    for (const installation of qtInstallations)
      for await (const kit of KitManager.generateCMakeKitsOfQtInstallationPath(
        qtFolder,
        installation,
        loadedCMakeKits
      ))
        kits.push(kit);
    return kits;
  }

  private async updateQtInstallations(
    qtFolder: string,
    qtInstallations: string[],
    workspaceFolder?: vscode.WorkspaceFolder
  ) {
    const newGeneratedKits = await KitManager.cmakeKitsFromQtInstallations(
      qtFolder,
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
    const cmakeKitsFileContent = fsSync.existsSync(cmakeKitsFile)
      ? await fs.readFile(cmakeKitsFile, 'utf8')
      : '[]';
    let currentKits: Kit[] = [];
    try {
      currentKits = JSON.parse(cmakeKitsFileContent) as Kit[];
    } catch (error) {
      if (util.isError(error)) {
        logger.error('Error parsing cmake-kits.json:', error.message);
      }
    }
    const newKits = currentKits.filter((kit) => {
      // filter kits if previousQtKits contains the kit with the same name
      return !previousQtKits.find((prevKit) => prevKit.name === kit.name);
    });
    newKits.push(...newGeneratedKits);
    if (newKits.length !== 0 || fsSync.existsSync(cmakeKitsFile)) {
      await fs.writeFile(cmakeKitsFile, JSON.stringify(newKits, null, 2));
    }
  }

  private watchGlobalConfig(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        (e: vscode.ConfigurationChangeEvent) => {
          void e;
          const previousQtFolder = this.globalStateManager.getQtFolder();
          const currentQtFolder = KitManager.getCurrentGlobalQtFolder();
          if (currentQtFolder !== previousQtFolder) {
            void this.onQtFolderUpdated(currentQtFolder);
          }
        }
      )
    );
  }

  private getProject(folder: vscode.WorkspaceFolder) {
    for (const project of this.projects) {
      if (project.getFolder() === folder) {
        return project;
      }
    }
    return undefined;
  }

  private watchWorkspaceFolderConfig(
    context: vscode.ExtensionContext,
    folder: vscode.WorkspaceFolder
  ) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(
        (e: vscode.ConfigurationChangeEvent) => {
          void e;
          let projectStateManager: WorkspaceStateManager | undefined;
          // TODO use map instead of array
          this.projects.forEach((project) => {
            if (project.getFolder() === folder) {
              projectStateManager = project.getStateManager();
            }
          });
          const previousQtFolder = projectStateManager?.getQtFolder() ?? '';
          const currentQtFolder = KitManager.getWorkspaceFolderQtFolder(folder);
          if (currentQtFolder !== previousQtFolder) {
            void this.onQtFolderUpdated(currentQtFolder, folder);
          }
        }
      )
    );
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
      logger.info('version: ' + version);
      const msvcTargetArch =
        kit.preferredGenerator?.platform ?? kit.visualStudioArchitecture ?? '';
      logger.info('msvcTargetArch: ' + msvcTargetArch);
      const targetArchitecture = KitManager.MapMsvcPlatformToQt[msvcTargetArch];
      const isArchMatch = targetArchitecture == architecture;
      return isArchMatch && versions.compareVersions(version, vsYear) >= 0;
    });
    for (const kit of msvcKitsWithArchitectureMatch) {
      kit.name = qtPath.mangleMsvcKitName(
        newKit.name + ' - ' + (kit.name || '')
      );
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
    const year = kit.name.match(KitManager.MsvcYearRegex)?.at(1);
    if (year) {
      return year;
    }
    const majorMsvcVersion = kit.name
      .match(KitManager.MsvcMajorVersionNumberRegex)
      ?.at(1);
    if (majorMsvcVersion) {
      return KitManager.MapMsvcMajorVersionToItsYear[majorMsvcVersion];
    }
    return '';
  }

  private async onQtFolderUpdated(
    newQtFolder: string,
    folder?: vscode.WorkspaceFolder
  ) {
    if (newQtFolder) {
      if (!fsSync.existsSync(newQtFolder)) {
        logger.warn(`The specified Qt installation path does not exist.`);
        void vscode.window.showWarningMessage(
          `The specified Qt installation path does not exist.`
        );
      }
    }
    logger.info(`Qt folder updated: "${newQtFolder}"`);
    await this.saveSelectedQt(newQtFolder, folder);
  }

  public static getWorkspaceFolderQtFolder(folder: vscode.WorkspaceFolder) {
    const qtFolderConfig = KitManager.getConfiguration(folder).inspect<string>(
      KitManager.QtFolderConfig
    );
    return qtFolderConfig?.workspaceFolderValue ?? '';
  }

  private getWorkspaceFileQtFolder() {
    const qtFolderConfig = KitManager.getConfiguration(
      this.workspaceFile
    ).inspect<string>(KitManager.QtFolderConfig);
    return qtFolderConfig?.workspaceValue ?? '';
  }

  private static getConfiguration(scope?: vscode.ConfigurationScope) {
    return vscode.workspace.getConfiguration('qt-official', scope);
  }
}
