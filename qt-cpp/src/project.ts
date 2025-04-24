// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as cmakeApi from 'vscode-cmake-tools';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { isEmpty, isEqual } from 'lodash';

import { WorkspaceStateManager } from '@/state';
import { coreAPI, kitManager } from '@/extension';
import {
  createLogger,
  IsLinux,
  IsMacOS,
  IsWindows,
  QtWorkspaceConfigMessage,
  QtWorkspaceType,
  telemetry
} from 'qt-lib';
import { Project, ProjectManager } from 'qt-lib';
import {
  getQtInsRoot,
  getQtPathsExe,
  getSelectedKit
} from '@cmd/register-qt-path';
import { analyzeKit } from '@/kit-manager';
import * as cmakeFileApi from '@/cmake-file-api';
import { getMajorQtVersion } from '@/util/util';

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
  return Promise.resolve(
    new CppProject(folder, context, cmakeProject, buildDir)
  );
}

// Project class represents a workspace folder in the extension.
export class CppProject implements Project {
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _stateManager: WorkspaceStateManager;
  private readonly _cmakeProject: cmakeApi.Project | undefined;
  private _buildDir: string | undefined;
  constructor(
    private readonly _folder: vscode.WorkspaceFolder,
    readonly _context: vscode.ExtensionContext,
    cmakeProject: cmakeApi.Project | undefined,
    buildDir: string | undefined
  ) {
    this._cmakeProject = cmakeProject;
    this._stateManager = new WorkspaceStateManager(_context, _folder);
    this._buildDir = buildDir;

    if (this._cmakeProject) {
      const onSelectedConfigurationChangedHandler =
        this._cmakeProject.onSelectedConfigurationChanged(
          async (configurationType: cmakeApi.ConfigurationType) => {
            if (configurationType === cmakeApi.ConfigurationType.Kit) {
              const kit = await getSelectedKit(this.folder);
              if (vscode.env.isTelemetryEnabled && kit) {
                analyzeKit(kit);
              }
              const selectedKitPath = kit ? getQtInsRoot(kit) : undefined;
              const message = new QtWorkspaceConfigMessage(this.folder);
              coreAPI?.setValue(
                this.folder,
                'selectedKitPath',
                selectedKitPath
              );
              message.config.add('selectedKitPath');

              const selectedQtPaths = kit ? getQtPathsExe(kit) : undefined;
              coreAPI?.setValue(
                this.folder,
                'selectedQtPaths',
                selectedQtPaths
              );
              message.config.add('selectedQtPaths');
              logger.info(
                `Notifying coreAPI with message: ${message.toString()}`
              );
              coreAPI?.notify(message);
            }
          }
        );
      const onCodeModelChangedHandler = this._cmakeProject.onCodeModelChanged(
        async () => {
          if (!this._cmakeProject) {
            throw new Error('CMake project is not defined');
          }
          const prevbuildDir = this._buildDir;
          const currentBuildDir = await this._cmakeProject.getBuildDirectory();
          if (prevbuildDir !== currentBuildDir) {
            logger.info(
              'Build directory changed:',
              currentBuildDir ?? 'undefined'
            );
            this._buildDir = currentBuildDir;
            const message = new QtWorkspaceConfigMessage(this.folder);
            coreAPI?.setValue(this.folder, 'buildDir', currentBuildDir);
            message.config.add('buildDir');
            logger.info(
              `Notifying coreAPI with message: ${message.toString()}`
            );
            coreAPI?.notify(message);
          }
          // Obtain used Qt modules if telemetry is enabled
          if (vscode.env.isTelemetryEnabled) {
            await this.obtainUsedQtModules();
          }
        }
      );
      this._disposables.push(onCodeModelChangedHandler);
      this._disposables.push(onSelectedConfigurationChangedHandler);
    }
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
      if (IsMacOS) {
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
  async initConfigValues() {
    if (!coreAPI) {
      throw new Error('CoreAPI is not initialized');
    }
    const folder = this.folder;
    const kit = await getSelectedKit(folder, true);
    const selectedKitPath = kit ? getQtInsRoot(kit) : undefined;
    logger.info(
      `Setting selected kit path for ${folder.uri.fsPath} to ${selectedKitPath}`
    );
    coreAPI.setValue(folder, 'selectedKitPath', selectedKitPath);
    const selectedQtPaths = kit ? getQtPathsExe(kit) : undefined;
    coreAPI.setValue(folder, 'selectedQtPaths', selectedQtPaths);
    logger.info(
      `Setting selected Qt paths for ${folder.uri.fsPath} to ${selectedQtPaths}`
    );
    coreAPI.setValue(folder, 'workspaceType', QtWorkspaceType.CMakeExt);
    logger.info(
      `Setting workspace type for ${folder.uri.fsPath} to ${QtWorkspaceType.CMakeExt}`
    );
    coreAPI.setValue(folder, 'buildDir', this.buildDir);
    logger.info(
      `Setting build directory for ${folder.uri.fsPath} to ${this.buildDir}`
    );
    logger.info('Config values initialized for:', folder.uri.fsPath);
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
