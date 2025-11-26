// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as cmakeApi from 'vscode-cmake-tools';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { isEmpty, isEqual } from 'lodash';

import { WorkspaceStateManager } from '@/state';
import { coreAPI, kitManager, projectManager } from '@/extension';
import {
  CoreKey,
  createLogger,
  findQtPathsInInstallationPath,
  IsLinux,
  IsMacOS,
  IsWindows,
  QtWorkspaceConfigMessage,
  QtWorkspaceFeatures,
  searchForQtPathsInVCPKG,
  telemetry
} from 'qt-lib';
import { Project, ProjectManager } from 'qt-lib';
import {
  getActiveFolder,
  getQtInsRoot,
  getQtPathsExe,
  getSelectedKit
} from '@cmd/register-qt-path';
import { analyzeKit } from '@/kit-manager';
import * as cmakeFileApi from '@/cmake-file-api';
import { getMajorQtVersion, isValidAndString } from '@/util/util';

const logger = createLogger('project');

interface target {
  name: string;
  filePath: string;
}

export async function createCppProject(
  folder: vscode.WorkspaceFolder,
  context: vscode.ExtensionContext
) {
  logger.info('Creating project:"' + folder.uri.fsPath + '"');
  const api = await cmakeApi.getCMakeToolsApi(cmakeApi.Version.latest);
  let cmakeProject: cmakeApi.Project | undefined;
  if (api) {
    cmakeProject = await api.getProject(folder.uri);
  }
  const buildDir = await cmakeProject?.getBuildDirectory();
  if (!cmakeProject) {
    logger.error('CMake project is not found for folder: ' + folder.uri.fsPath);
    throw new Error(
      'CMake project is not found for folder: ' + folder.uri.fsPath
    );
  }

  return Promise.resolve(
    new CppProject(folder, context, cmakeProject, buildDir)
  );
}

export async function getActiveProject() {
  const activeFolder = await getActiveFolder();
  if (!activeFolder) {
    return undefined;
  }
  return projectManager.getProject(activeFolder);
}

export enum CppProjectType {
  Kit = 'Kit',
  Presets = 'CMakePresets'
}

// Project class represents a workspace folder in the extension.
export class CppProject implements Project {
  private readonly _type: CppProjectType | undefined;
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _stateManager: WorkspaceStateManager;
  private readonly _cmakeProject: cmakeApi.Project | undefined;
  private _buildDir: string | undefined;
  constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext,
    cmakeProject: cmakeApi.Project,
    buildDir: string | undefined
  ) {
    this._cmakeProject = cmakeProject;
    this._stateManager = new WorkspaceStateManager(_context, _folder);
    this._buildDir = buildDir;

    const usePresets = this._cmakeProject.useCMakePresets;

    if (usePresets) {
      logger.info('Using CMake presets');
      this._type = CppProjectType.Presets;
    } else {
      logger.info('Using Kit configuration');
      this._type = CppProjectType.Kit;
    }
    logger.info(
      `Project type for ${this._folder.uri.fsPath} is ${this._type.toString()}`
    );
    const onSelectedConfigurationChangedHandler =
      this._cmakeProject.onSelectedConfigurationChanged(
        async (configurationType: cmakeApi.ConfigurationType) => {
          await this.onSelectedConfigurationChanged(configurationType);
        }
      );
    const onCodeModelChangedHandler = this._cmakeProject.onCodeModelChanged(
      async () => {
        await this.onCodeModelChanged();
      }
    );

    this._disposables.push(onCodeModelChangedHandler);
    this._disposables.push(onSelectedConfigurationChangedHandler);
  }
  private async onCodeModelChanged() {
    if (!this._cmakeProject) {
      throw new Error('CMake project is not defined');
    }
    const prevbuildDir = this._buildDir;
    const currentBuildDir = await this._cmakeProject.getBuildDirectory();
    if (prevbuildDir !== currentBuildDir) {
      logger.info('Build directory changed:', currentBuildDir ?? 'undefined');
      this._buildDir = currentBuildDir;
      const message = new QtWorkspaceConfigMessage(this.folder);
      coreAPI?.setValue(this.folder, 'buildDir', currentBuildDir);
      message.config.add('buildDir');
      logger.info(`Notifying coreAPI with message: ${message.toString()}`);
      coreAPI?.notify(message);
    }
    // Obtain used Qt modules if telemetry is enabled
    if (vscode.env.isTelemetryEnabled) {
      await this.obtainUsedQtModules();
    }
  }
  private async onSelectedConfigurationChanged(
    configurationType: cmakeApi.ConfigurationType
  ) {
    logger.info(
      `Selected configuration changed: ${configurationType.toString()} for project: ${this._folder.uri.fsPath}`
    );
    logger.info(
      `useCMakePresets: ${this._cmakeProject?.useCMakePresets} for project: ${this._folder.uri.fsPath}`
    );
    switch (configurationType) {
      case cmakeApi.ConfigurationType.Kit:
        await this.onKitConfigurationChanged();
        break;
      case cmakeApi.ConfigurationType.ConfigurePreset:
        await this.onConfigurePresetsChanged();
        break;
      case cmakeApi.ConfigurationType.BuildPreset:
        // Do nothing for build preset change
        break;
    }
  }
  get type() {
    return this._type;
  }
  private async onConfigurePresetsChanged() {
    if (!this._cmakeProject?.configurePreset) {
      throw new Error('Configure preset is not defined');
    }
    const message = new QtWorkspaceConfigMessage(this.folder);
    const configEntries: [string, string | undefined][] = [
      [CoreKey.INSTALLATION_PATH, await this.getInstallationPathFromPreset()],
      [CoreKey.SELECTED_QT_PATHS, await this.getQtPathsExeFromPreset()],
      [CoreKey.BUILD_DIR, await this._cmakeProject.getBuildDirectory()]
    ];
    for (const [key, value] of configEntries) {
      coreAPI?.setValue(this.folder, key, value);
      message.config.add(key);
      logger.info(
        `Setting ${key} for ${this.folder.uri.fsPath} to ${typeof value === 'object' ? JSON.stringify(value) : value}`
      );
    }
    coreAPI?.notify(message);
  }
  async getToolchainFile() {
    if (this._type === CppProjectType.Kit) {
      const kit = await getSelectedKit(this._folder);
      if (kit) {
        return kit.toolchainFile;
      }
    } else if (this._type === CppProjectType.Presets) {
      const presets = this._cmakeProject?.configurePreset;
      if (!presets) {
        return undefined;
      }
      const toolchainFile =
        presets.toolchainFile ??
        presets.cacheVariables?.CMAKE_TOOLCHAIN_FILE ??
        presets.environment?.CMAKE_TOOLCHAIN_FILE;
      if (toolchainFile && typeof toolchainFile === 'string') {
        return toolchainFile;
      }
    }
    return undefined;
  }

  async getInstallationPathFromPreset() {
    const preset = this._cmakeProject?.configurePreset;
    if (!preset) {
      return undefined;
    }
    const qtInstallationPath = CppProject.getVendorValue(
      this._cmakeProject.configurePreset,
      'VSCODE_QT_INSTALLATION'
    ) as string | undefined;
    if (qtInstallationPath) {
      if (isValidAndString(qtInstallationPath)) {
        return qtInstallationPath;
      }
    }
    const keys = [
      'CMAKE_PREFIX_PATH',
      'QT_ADDITIONAL_PACKAGES_PREFIX_PATH',
      'QT_PACKAGES_PREFIX_PATH',
      'Qt6_ROOT',
      'Qt_ROOT',
      'QTDIR'
    ];

    for (const key of keys) {
      const value = preset.cacheVariables?.[key];
      if (value && typeof value === 'string') {
        return value;
      }
    }
    if (preset.environment) {
      for (const key of keys) {
        const value = preset.environment[key];
        if (value && typeof value === 'string') {
          return value;
        }
      }
    }

    for (const version of ['Qt6', 'Qt5']) {
      const dirKey = `${version}_DIR`;
      // Example D:/Qt/6.7.2/msvc2019_64/lib/cmake/Qt6
      // /home/orkun/Qt/6.9.0/gcc_64/lib/cmake/Qt6
      const isValidQtDir = (dir: string) => {
        if (dir && typeof dir === 'string') {
          if (dir.endsWith(pathToRemove)) {
            return dir.slice(0, dir.length - pathToRemove.length - 1);
          }
        }
        return undefined;
      };

      const pathToRemove = path.join('lib', 'cmake', version);
      const dirValue = preset.cacheVariables?.[dirKey];
      if (dirValue && typeof dirValue === 'string') {
        const validDir = isValidQtDir(dirValue);
        if (validDir) {
          return validDir;
        }
      }
      if (preset.environment) {
        const envDirValue = preset.environment[dirKey];
        if (envDirValue && typeof envDirValue === 'string') {
          if (envDirValue.endsWith(pathToRemove)) {
            return envDirValue.slice(
              0,
              envDirValue.length - pathToRemove.length - 1
            );
          }
        }
      }
    }
    // Try to find Qt installation from toolchain file
    const officialToolchainFileName = 'qt.toolchain.cmake';
    const toolchainFile = await this.getToolchainFile();
    if (toolchainFile) {
      const toolchainFileName = path.basename(toolchainFile);
      if (toolchainFileName === officialToolchainFileName) {
        const pathToRemove = path.join('lib', 'cmake', 'Qt6');
        const toolchainDir = path.dirname(toolchainFile);
        const installationPath = toolchainDir.slice(
          0,
          toolchainDir.length - pathToRemove.length - 1
        );
        return installationPath;
      }
    }

    return undefined;
  }

  private async onKitConfigurationChanged() {
    const kit = await getSelectedKit(this.folder);
    if (vscode.env.isTelemetryEnabled && kit) {
      analyzeKit(kit);
    }
    const installationPath = await this.getInstallationPathFromKit();
    const message = new QtWorkspaceConfigMessage(this.folder);
    coreAPI?.setValue(this.folder, CoreKey.INSTALLATION_PATH, installationPath);
    message.config.add(CoreKey.INSTALLATION_PATH);

    const selectedQtPaths = await this.getQtPaths();
    coreAPI?.setValue(this.folder, CoreKey.SELECTED_QT_PATHS, selectedQtPaths);
    message.config.add(CoreKey.SELECTED_QT_PATHS);
    logger.info(`Notifying coreAPI with message: ${message.toString()}`);
    coreAPI?.notify(message);
  }

  private async obtainUsedQtModules() {
    if (!this._cmakeProject) {
      throw new Error('CMake project is not defined');
    }
    if (!this._cmakeProject.codeModel) {
      throw new Error('Code model is not defined');
    }
    // Obtain used Qt modules
    const buildDir = await this._cmakeProject.getBuildDirectory();
    if (!buildDir) {
      logger.warn(
        'Build directory is not defined. Cannot obtain used Qt modules.'
      );
      return;
    }
    const buildType = await this._cmakeProject.getActiveBuildType();
    if (!buildType) {
      logger.warn('Build type is not defined. Cannot obtain used Qt modules.');
      return;
    }

    const configurations = this._cmakeProject.codeModel.configurations;
    // Get all projects from configurations
    const projects = configurations.flatMap((c) => c.projects);

    // Filter out targets which are not UTILITY, and assign wtih name as string
    const targets: string[] = [];
    for (const project of projects) {
      targets.push(
        ...project.targets
          .filter((t) => t.type !== 'UTILITY')
          .map((t) => t.name)
      );
    }

    // .cmake/api/v1/reply
    const cmakeFileApiPath = path.join(
      buildDir,
      '.cmake',
      'api',
      'v1',
      'reply'
    );
    // Filter out json files in cmakeFileApiPath
    const jsonFiles = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(cmakeFileApiPath)
    );

    // Filter out json files starting with "target-<targetName>-<buildType>"
    const targetJsonFiles: target[] = [];
    for (const file of jsonFiles) {
      for (const target of targets) {
        if (file[0].startsWith(`target-${target}-${buildType}`)) {
          targetJsonFiles.push({
            name: target,
            filePath: path.join(cmakeFileApiPath, file[0])
          });
        }
      }
    }
    let changed = false;
    for (const t of targetJsonFiles) {
      let modules = CppProject.parseCmakeFileApi(t.filePath, buildType);
      if (isEmpty(modules)) {
        continue;
      }
      if (IsMacOS && this._type === CppProjectType.Kit) {
        const majorVersion = await getMajorQtVersion();
        if (majorVersion) {
          modules = modules.map((module) => {
            module = module.replace('Qt', `Qt${majorVersion}`);
            return module;
          });
        }
      }
      const prevModules = this.getStateManager().getModules();
      const targetModules = prevModules.get(t.name);
      // First time setting modules or modules changed
      if (!targetModules || !isEqual(targetModules, modules)) {
        prevModules.set(t.name, modules);
        const targetId = crypto
          .createHash('sha1')
          .update(this.folder.uri.fsPath + t.name)
          .digest('hex');

        telemetry.sendEvent('QtModules', {
          targetId: targetId,
          qtmodules: modules.join(',')
        });
        changed = true;
        await this.getStateManager().setModules(prevModules);
      }
    }
    if (changed) {
      await this.CleanupTargetsForTelemetry(targets);
    }
  }
  private async CleanupTargetsForTelemetry(targets: string[]) {
    // Delete non-existing targets from state
    const currentModules = this.getStateManager().getModules();
    const currentTargets = Array.from(currentModules.keys());
    const targetsToDelete = currentTargets.filter(
      (target) => !targets.includes(target)
    );
    for (const target of targetsToDelete) {
      currentModules.delete(target);
    }
    if (targetsToDelete.length > 0) {
      await this.getStateManager().setModules(currentModules);
    }
  }
  private static parseCmakeFileApi(file: string, buildType: string) {
    try {
      const fileContent = fs.readFileSync(file, 'utf8');
      const jsonContent = JSON.parse(fileContent) as cmakeFileApi.Target;
      let frameworks: string[] = [];
      if (IsMacOS) {
        frameworks = CppProject.parseCmakeFileApiContentMacOS(jsonContent);
      } else if (IsLinux) {
        frameworks = CppProject.parseCmakeFileApiContentLinux(jsonContent);
      } else if (IsWindows) {
        frameworks = CppProject.parseCmakeFileApiContentWindows(
          jsonContent,
          buildType
        );
      }

      // Remove duplicates
      frameworks = [...new Set(frameworks)];
      return frameworks;
    } catch (error) {
      logger.info(
        `Cannot parse CMake file API JSON file: ${file}. ${String(error)}`
      );
      return [];
    }
  }
  private static parseCmakeFileApiContentLinux(content: cmakeFileApi.Target) {
    try {
      const frameworks: string[] = [];
      for (const commandFragment of content.link.commandFragments) {
        if (commandFragment.role !== 'libraries') {
          continue;
        }
        const splitFragment = commandFragment.fragment.split(',');
        const filteredFragment = splitFragment.filter((fragment) => {
          return fragment.includes('libQt');
        });
        if (filteredFragment.length === 0) {
          continue;
        }
        const refinedFragments = filteredFragment.map((fragment) => {
          // Remove the path and extension and get the name without lib prefix
          const name = path.parse(fragment).name;
          const refinedName = name.replace('lib', '');
          // Cut until the first dot
          const dotIndex = refinedName.indexOf('.');
          const finalName =
            dotIndex !== -1 ? refinedName.slice(0, dotIndex) : refinedName;
          return finalName;
        });
        frameworks.push(...refinedFragments);
      }
      return frameworks;
    } catch (error) {
      logger.warn(
        `Error parsing CMake file API JSON content. Error: ${String(error)}`
      );
      return [];
    }
  }
  private static parseCmakeFileApiContentWindows(
    content: cmakeFileApi.Target,
    buildType: string
  ) {
    try {
      const frameworks: string[] = [];
      for (const commandFragment of content.link.commandFragments) {
        if (commandFragment.role !== 'libraries') {
          continue;
        }
        const splitFragment = commandFragment.fragment.split(',');
        const filteredFragment = splitFragment.filter((fragment) => {
          return fragment.includes('Qt6') || fragment.includes('Qt5');
        });
        const refinedFragments = filteredFragment.map((fragment) => {
          // Remove the path and extension and get the name without lib prefix
          const name = path.parse(fragment).name;
          if (buildType === 'Debug' || buildType === 'RelWithDebInfo') {
            // Check if the name contains 'd' at the end
            if (name.endsWith('d')) {
              return name.slice(0, -1);
            }
          }
          return name;
        });
        frameworks.push(...refinedFragments);
      }
      return frameworks;
    } catch (error) {
      logger.warn(
        `Error parsing CMake file API JSON content. Error: ${String(error)}`
      );
      return [];
    }
  }
  private static parseCmakeFileApiContentMacOS(content: cmakeFileApi.Target) {
    try {
      const frameworks: string[] = [];
      for (const compileGroup of content.compileGroups) {
        for (const framework of compileGroup.frameworks) {
          if (framework.path) {
            const name = path.parse(framework.path).name;
            // Check if the framework is a Qt module
            if (name.startsWith('Qt')) {
              frameworks.push(name);
            }
          }
        }
      }
      return frameworks;
    } catch (error) {
      logger.warn(
        `Error parsing CMake file API JSON content. Error: ${String(error)}`
      );
      return [];
    }
  }
  async getInstallationPathFromKit() {
    const folder = this.folder;
    const kit = await getSelectedKit(folder, true);
    if (!kit) {
      return undefined;
    }
    const installationPath = getQtInsRoot(kit);
    if (installationPath) {
      return installationPath;
    }
    return undefined;
  }
  async getInstallationPath() {
    if (this._type === CppProjectType.Kit) {
      const selectedKitPath = await this.getInstallationPathFromKit();
      if (selectedKitPath) {
        return selectedKitPath;
      }
    } else if (this._type === CppProjectType.Presets) {
      return this.getInstallationPathFromPreset();
    }
    return undefined;
  }
  async getQtPathsExeFromKit() {
    const folder = this.folder;
    const kit = await getSelectedKit(folder, true);
    if (!kit) {
      return undefined;
    }
    const qtPathsExe = getQtPathsExe(kit);
    if (qtPathsExe) {
      return qtPathsExe;
    }
    return undefined;
  }
  private static getVendorValue(preset: cmakeApi.ConfigurePreset, key: string) {
    const qtCppVendor = preset.vendor?.['qt-cpp'] as
      | cmakeApi.VendorType
      | undefined;
    if (qtCppVendor) {
      const value = qtCppVendor[key] as unknown;
      return value;
    }
    return undefined;
  }
  async getQtPathsExeFromPreset({
    includeInstallationPathSearch = false
  } = {}) {
    const presets = this._cmakeProject?.configurePreset;
    if (!presets) {
      return undefined;
    }
    // Example:
    //"configurePresets": [
    //   {
    //    "vendor": {
    //       "qt-cpp": {
    //           "VSCODE_QT_INSTALLATION": "/home/orkun/qt_work/qt5/build/qtbase",
    //            or
    //           "VSCODE_QT_QTPATHS_EXE": "/home/orkun/Qt/6.7.3/gcc_64/bin/qtpaths"
    //       },
    //    }
    // ]
    const qtpathsVendor = CppProject.getVendorValue(
      this._cmakeProject.configurePreset,
      'VSCODE_QT_QTPATHS_EXE'
    ) as string | undefined;
    if (qtpathsVendor) {
      if (isValidAndString(qtpathsVendor)) {
        return qtpathsVendor;
      }
    }
    // Try to find Qt paths from cacheVariables and environment variables
    if (includeInstallationPathSearch) {
      const installationPath = await this.getInstallationPathFromPreset();
      if (installationPath) {
        const qtpaths = findQtPathsInInstallationPath(installationPath);
        if (qtpaths) {
          return qtpaths;
        }
      }
    }
    // Check VCPKG_ROOT in environment variables and cache variables
    // const vcpkgRoot =
    //   presets.environment?.VCPKG_ROOT ?? presets.cacheVariables?.VCPKG_ROOT;
    // if (isValidAndString(vcpkgRoot)) {
    //   const qtPaths = searchForQtPathsInVCPKG(vcpkgRoot);
    //   if (qtPaths) {
    //     return qtPaths;
    //   }
    // }
    const vcpkgToolchain = await this.getToolchainFile();
    if (
      isValidAndString(vcpkgToolchain) &&
      vcpkgToolchain.endsWith('vcpkg.cmake')
    ) {
      // Examples:
      // /home/<username>/vcpkg/scripts/buildsystems/vcpkg.cmake
      // D:/vcpkg/scripts/buildsystems/vcpkg.cmake
      // Extract vcpkg root from toolchain file path
      const pathToRemove = path.join('scripts', 'buildsystems', 'vcpkg.cmake');
      const vcpkgRootFromToolchain = vcpkgToolchain.slice(
        0,
        vcpkgToolchain.length - pathToRemove.length - 1
      );
      const qtPaths = searchForQtPathsInVCPKG(vcpkgRootFromToolchain);
      if (qtPaths) {
        return qtPaths;
      }
    }
    return undefined;
  }
  async getQtPaths({ includeInstallationPathSearch = false } = {}) {
    if (this._type === CppProjectType.Kit) {
      const qtPathsExe = await this.getQtPathsExeFromKit();
      if (qtPathsExe) {
        return qtPathsExe;
      }
    } else if (this._type === CppProjectType.Presets) {
      const qtPathsExe = await this.getQtPathsExeFromPreset({
        includeInstallationPathSearch
      });
      if (qtPathsExe) {
        return qtPathsExe;
      }
    }
    return undefined;
  }
  async initConfigValues() {
    if (!coreAPI) {
      throw new Error('CoreAPI is not initialized');
    }

    if (!this._cmakeProject) {
      throw new Error('CMake project is not defined');
    }
    const folder = this.folder;
    let features = coreAPI.getValue<QtWorkspaceFeatures>(
      folder,
      CoreKey.WORKSPACE_FEATURES
    );
    features ??= { projectTypes: {} };
    features.projectTypes.cmake = true;
    const message = new QtWorkspaceConfigMessage(this.folder);
    const configEntries: [string, string | undefined | QtWorkspaceFeatures][] =
      [
        [CoreKey.INSTALLATION_PATH, await this.getInstallationPath()],
        [CoreKey.SELECTED_QT_PATHS, await this.getQtPaths()],
        [CoreKey.BUILD_DIR, await this._cmakeProject.getBuildDirectory()],
        [CoreKey.WORKSPACE_FEATURES, features]
      ];
    for (const [key, value] of configEntries) {
      coreAPI.setValue(this.folder, key, value);
      message.config.add(key);
      logger.info(
        `Setting ${key} for ${this.folder.uri.fsPath} to ${typeof value === 'object' ? JSON.stringify(value) : value}`
      );
    }
    coreAPI.notify(message);
  }
  public getStateManager() {
    return this._stateManager;
  }
  get folder() {
    return this._folder;
  }
  get buildDir() {
    return this._buildDir;
  }

  dispose() {
    logger.info('Disposing project:', this._folder.uri.fsPath);
    for (const d of this._disposables) {
      d.dispose();
    }
  }
}

export class CppProjectManager extends ProjectManager<CppProject> {
  constructor(override readonly context: vscode.ExtensionContext) {
    super(context, createCppProject);

    this._disposables.push(
      this.onProjectAdded(async (project: CppProject) => {
        logger.info('Adding project:', project.folder.uri.fsPath);
        await project.initConfigValues();
        kitManager.addProject(project);
        void kitManager.checkForQtInstallations(project);
      })
    );

    this._disposables.push(
      this.onProjectRemoved((project: CppProject) => {
        kitManager.removeProject(project);
      })
    );
  }
  initConfigValues() {
    for (const project of this.getProjects()) {
      void project.initConfigValues();
    }
  }
}
