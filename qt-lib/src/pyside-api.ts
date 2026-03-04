// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import { type ChildProcess } from 'child_process';

const PYTHON_EXTENSION_ID = 'qt-python';

/**
 * Minimum PySide version that supports passing additional arguments
 * to `pyside6-project run` via `-- <args>`.
 */
export const PYSIDE_MIN_VERSION_RUN_ARGS = '6.10.3';

/**
 * The interface provided by the qt-python extension during activation.
 * Allows other VS Code extensions to interact with PySide projects.
 */
export interface PySideAPI {
  /**
   * Gets the PySide project associated with the given workspace folder,
   * if it exists.
   * @param folder The workspace folder to get the project for.
   * @returns The PySide project for the folder, or undefined if no project
   *          exists in that folder.
   */
  getProject(folder: vscode.WorkspaceFolder): PySideProject | undefined;
}

/**
 * Represents a PySide project within a workspace folder.
 * Provides operations for running, querying, and inspecting the project.
 */
export interface PySideProject {
  /**
   * Run the PySide project using `pyside6-project run`.
   * For PySide >= 6.10.3, additional arguments are passed via `-- <args>`.
   * @param args Additional arguments to pass to the running application.
   * @returns The spawned child process, or undefined if the project is invalid.
   */
  runProject(args?: string[]): ChildProcess | undefined;

  /**
   * Build the PySide project using `pyside6-project build`.
   * @returns A promise that resolves to true on success, false on failure.
   */
  build(): Promise<number>;

  /**
   * Run a specific Python file with optional arguments.
   * Used as a fallback when `pyside6-project run` does not support extra args
   * (PySide < 6.10.3).
   * @param filePath Absolute path to the Python file to run.
   * @param args Additional arguments to pass to the Python script.
   * @returns The spawned child process, or undefined on failure.
   */
  runFile(filePath: string, args?: string[]): ChildProcess | undefined;

  /**
   * Find all Python files within the project's workspace folder.
   * Used as a fallback entry-point picker when PySide < 6.10.3.
   * @returns Relative paths of all `.py` files found.
   */
  findPythonFiles(): Promise<string[]>;

  /**
   * Get the installed PySide6 version for this project.
   * @returns Version string (e.g., "6.10.3") or undefined if not available.
   */
  getPySideVersion(): string | undefined;

  /**
   * Check if the PySide version for this project supports passing
   * additional arguments to `pyside6-project run` (>= 6.10.3).
   * @returns true if `pyside6-project run -- <args>` is supported.
   */
  supportsProjectRunArgs(): boolean;
}

/**
 * Get the PySideAPI from the qt-python extension.
 * Activates the extension if it is not already active.
 * @returns The PySideAPI or undefined if the extension is not installed.
 */
export async function getPySideApi(): Promise<PySideAPI | undefined> {
  const extension = vscode.extensions.getExtension(
    `theqtcompany.${PYTHON_EXTENSION_ID}`
  );
  if (!extension) {
    return undefined;
  }

  let exports: PySideAPI | undefined;
  if (!extension.isActive) {
    try {
      exports = (await extension.activate()) as PySideAPI;
    } catch {
      return undefined;
    }
  } else {
    exports = extension.exports as PySideAPI;
  }

  return exports;
}
