import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { glob } from 'glob';

import * as consts from '@/constants';
import { projectManager } from './extension';
import {
  PYSIDE_MIN_VERSION_RUN_ARGS,
  compareVersions,
  PySideAPI,
  PySideProject as PySideProjectAPI,
  createLogger
} from 'qt-lib';
import { PySideCommandBuilder } from './builder';
import { PySideProject } from './project';

const logger = createLogger('api');

export class PySideAPIImpl implements PySideAPI {
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  getProject(folder: vscode.WorkspaceFolder): PySideProjectAPI | undefined {
    const project = projectManager.getProject(folder);
    if (!project) {
      logger.error(`No PySide project in: ${folder.uri.fsPath}`);
      return undefined;
    }
    return new PySideProjectWrapper(project, folder);
  }
}

class PySideProjectWrapper implements PySideProjectAPI {
  constructor(
    private readonly project: PySideProject,
    private readonly folder: vscode.WorkspaceFolder
  ) {}

  runProject(args?: string[]): childProcess.ChildProcess | undefined {
    if (!this.project.isValid()) {
      logger.error(`No valid PySide project in: ${this.folder.uri.fsPath}`);
      return undefined;
    }

    let command = `${consts.PYSIDE_PROJECT_TOOL} run`;
    if (args?.length) {
      command += ` ${args.join(' ')}`;
    }

    const cmd = new PySideCommandBuilder()
      .useVenv(true)
      .venvBinPath(this.project.env.venvBinPath)
      .build(command);

    logger.info(`runProject: ${cmd.commandLine}`);
    return childProcess.spawn(cmd.commandLine, {
      shell: cmd.shellPath,
      cwd: this.folder.uri.fsPath
    });
  }

  async build(): Promise<number> {
    return new Promise((resolve) => {
      const cmd = new PySideCommandBuilder()
        .useVenv(true)
        .venvBinPath(this.project.env.venvBinPath)
        .build(`${consts.PYSIDE_PROJECT_TOOL} build`);

      logger.info(`build: ${cmd.commandLine}`);
      const proc = childProcess.spawn(cmd.commandLine, {
        shell: cmd.shellPath,
        cwd: this.folder.uri.fsPath
      });
      proc.on('exit', (code) => {
        resolve(code ?? -1);
      });
      proc.on('error', () => {
        resolve(-1);
      });
    });
  }

  runFile(
    filePath: string,
    args?: string[]
  ): childProcess.ChildProcess | undefined {
    let command = `python "${filePath}"`;
    if (args?.length) {
      command += ` ${args.join(' ')}`;
    }

    const cmd = new PySideCommandBuilder()
      .useVenv(true)
      .venvBinPath(this.project.env.venvBinPath)
      .build(command);

    logger.info(`runFile: ${cmd.commandLine}`);
    return childProcess.spawn(cmd.commandLine, {
      shell: cmd.shellPath,
      cwd: this.folder.uri.fsPath
    });
  }

  async findPythonFiles(): Promise<string[]> {
    return glob('**/*.py', {
      cwd: this.folder.uri.fsPath,
      ignore: ['**/.*/**', '**/__pycache__/**', '**/node_modules/**']
    });
  }

  getPySideVersion(): string | undefined {
    return this.project.pySideVersion;
  }

  supportsProjectRunArgs(): boolean {
    const version = this.getPySideVersion();
    if (!version) {
      return false;
    }
    return compareVersions(version, PYSIDE_MIN_VERSION_RUN_ARGS) >= 0;
  }
}
