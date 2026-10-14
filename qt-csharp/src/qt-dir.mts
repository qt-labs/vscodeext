// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  CoreKey,
  createLogger,
  findQtKits,
  resolveConfiguration,
  type CoreAPI,
  type QtAdditionalPath
} from 'qt-lib';
import { EXTENSION_ID } from '@/constants.js';

const logger = createLogger('qt-dir');

const QT_DIR_SETTING = 'qtDir';
const QT_DIR_VARIABLE = 'QtDir';

/**
 * Read the architectures a Qt installation was built for, with the same
 * precedence as getArchInfoFromQtInfo: QT_TARGET_ARCH, then QT_ARCHS, which
 * lists all architectures of a multi-architecture build such as the
 * universal macOS packages, then QT_ARCH.
 */
function readQtArchs(qtDir: string): string[] | undefined {
  let qconfig: string;
  try {
    qconfig = fs.readFileSync(
      path.join(qtDir, 'mkspecs', 'qconfig.pri'),
      'utf8'
    );
  } catch {
    return undefined;
  }
  const valueOf = (key: string) => {
    const value = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm')
      .exec(qconfig)?.[1]
      ?.trim();
    // Skip values that reference other qmake variables.
    return value && !value.includes('$$') ? value : undefined;
  };
  const archs =
    valueOf('QT_TARGET_ARCH') ?? valueOf('QT_ARCHS') ?? valueOf('QT_ARCH');
  return archs?.split(/\s+/);
}

function hostQtArch(arch: string) {
  return arch === 'x64' ? 'x86_64' : arch;
}

/**
 * Check whether a Qt installation can be used to build a Qt Bridge project on
 * this host. Returns the reason why not, or undefined if it can be used.
 */
export function checkQtDirForBuild(
  qtDir: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string | undefined {
  if (
    !fs.existsSync(path.join(qtDir, 'lib', 'cmake', 'Qt6', 'Qt6Config.cmake'))
  ) {
    return 'not a Qt 6 installation (lib/cmake/Qt6/Qt6Config.cmake is missing)';
  }
  if (fs.existsSync(path.join(qtDir, 'bin', 'target_qt.conf'))) {
    return 'Qt for a different target platform';
  }
  const qtArchs = readQtArchs(qtDir);
  if (qtArchs && !qtArchs.includes(hostQtArch(arch))) {
    return `Qt for ${qtArchs.join(', ')}, but this machine is ${hostQtArch(arch)}`;
  }
  // MSVC builds have import libraries, Qt6Cored.lib for debug-only builds.
  // MinGW builds have libQt6Core.a instead.
  if (
    platform === 'win32' &&
    !['Qt6Core.lib', 'Qt6Cored.lib'].some((lib) =>
      fs.existsSync(path.join(qtDir, 'lib', lib))
    )
  ) {
    return 'not an MSVC build of Qt';
  }
  return undefined;
}

export interface QtDirCandidate {
  readonly qtDir: string;
  readonly origin: string;
}

function qtDirFromQtPaths(coreApi: CoreAPI, qtPathsExe: string | undefined) {
  if (!qtPathsExe) {
    return undefined;
  }
  try {
    return coreApi.getQtInfoFromPath(qtPathsExe).info?.get('QT_INSTALL_PREFIX');
  } catch {
    return undefined;
  }
}

/**
 * Collect the Qt installations known to Qt Core that can build a Qt Bridge
 * project on this host: the selected Qt, the installations below the Qt
 * installation root, and the additional Qt paths.
 */
export async function findQtDirCandidates(
  coreApi: CoreAPI | undefined,
  folder: vscode.WorkspaceFolder | undefined
): Promise<QtDirCandidate[]> {
  if (!coreApi) {
    return [];
  }
  const scopes: (vscode.WorkspaceFolder | string)[] = folder
    ? [folder, CoreKey.GLOBAL_WORKSPACE]
    : [CoreKey.GLOBAL_WORKSPACE];
  const getValue = <T,>(key: string) =>
    scopes
      .map((scope) => coreApi.getValue<T>(scope, key))
      .find((value) => value !== undefined);

  const candidates: QtDirCandidate[] = [];
  const selected = qtDirFromQtPaths(
    coreApi,
    getValue<string>(CoreKey.SELECTED_QT_PATHS)
  );
  if (selected) {
    candidates.push({ qtDir: selected, origin: 'selected in Qt Core' });
  }
  const root = getValue<string>(CoreKey.QT_INSTALLATION_ROOT);
  for (const qtDir of root ? await findQtKits(root) : []) {
    candidates.push({ qtDir, origin: 'Qt installation root' });
  }
  for (const additional of getValue<QtAdditionalPath[]>(
    CoreKey.ADDITIONAL_QT_PATHS
  ) ?? []) {
    const qtDir = qtDirFromQtPaths(coreApi, additional.path);
    if (qtDir) {
      candidates.push({ qtDir, origin: 'additional Qt path' });
    }
  }

  const seen = new Set<string>();
  return candidates.filter(({ qtDir }) => {
    const key = path.resolve(qtDir).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    const reason = checkQtDirForBuild(qtDir);
    if (reason) {
      logger.info(`Skipping Qt candidate ${qtDir}: ${reason}`);
    }
    return reason === undefined;
  });
}

/**
 * Let the user pick the Qt installation for Qt Bridge projects and store it
 * in the qt-csharp.qtDir user setting.
 */
export async function selectQtDir(
  coreApi: CoreAPI | undefined,
  folder: vscode.WorkspaceFolder | undefined
): Promise<string | undefined> {
  type Item = vscode.QuickPickItem & { qtDir?: string };
  const candidates = await findQtDirCandidates(coreApi, folder);
  const items: Item[] = candidates.map(({ qtDir, origin }) => ({
    label: path.basename(path.dirname(qtDir)) + ' ' + path.basename(qtDir),
    description: origin,
    detail: qtDir,
    qtDir
  }));
  items.push({
    label: '$(folder-opened) Browse...',
    detail:
      'Select the Qt installation prefix, the folder that contains bin and lib'
  });
  const picked = await vscode.window.showQuickPick(items, {
    title: 'Qt Bridge C#: Select the Qt installation to build with',
    placeHolder:
      candidates.length > 0
        ? 'Qt installations known to Qt Core that match this machine'
        : 'No matching Qt installation is registered in Qt Core'
  });
  if (!picked) {
    return undefined;
  }

  let qtDir = picked.qtDir;
  if (!qtDir) {
    const folders = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Select the Qt installation prefix'
    });
    qtDir = folders?.[0]?.fsPath;
    if (!qtDir) {
      return undefined;
    }
    const reason = checkQtDirForBuild(qtDir);
    if (reason) {
      void vscode.window.showErrorMessage(
        `Cannot use ${qtDir} for Qt Bridge C#: ${reason}.`
      );
      return undefined;
    }
  }

  await vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .update(QT_DIR_SETTING, qtDir, vscode.ConfigurationTarget.Global);
  logger.info(`Selected Qt for Qt Bridge projects: ${qtDir}`);
  return qtDir;
}

/**
 * Export the qt-csharp.qtDir setting as QtDir to the integrated terminal, so
 * that builds started there use the same Qt as the extensions.
 */
export class QtDirTerminalEnvironment implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly collection: vscode.GlobalEnvironmentVariableCollection
  ) {
    this.update();
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(`${EXTENSION_ID}.${QT_DIR_SETTING}`)) {
          this.update();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.update();
      })
    );
  }

  private update() {
    this.collection.clear();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const scoped = this.collection.getScoped({ workspaceFolder: folder });
      scoped.clear();
      const configured = vscode.workspace
        .getConfiguration(EXTENSION_ID, folder.uri)
        .get<string>(QT_DIR_SETTING)
        ?.trim();
      if (!configured) {
        continue;
      }
      const qtDir = resolveConfiguration(configured);
      scoped.description = `QtDir from the ${EXTENSION_ID}.${QT_DIR_SETTING} setting`;
      scoped.replace(QT_DIR_VARIABLE, qtDir);
      logger.info(`Exporting QtDir=${qtDir} to terminals of ${folder.name}`);
    }
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
