// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as vscode from 'vscode';

/**
 * Returns true if the given extension is active.
 */
export function isExtensionActive(extensionId: string): boolean {
    return vscode.extensions.getExtension(extensionId)?.isActive === true;
  }
/**
 * Asserts that all declared extension dependencies in package.json are active.
 */
export function assertAllDependenciesAreActive(packageJson: any): void {
    const dependencies: string[] = packageJson.extensionDependencies ?? [];
  
    for (const extensionId of dependencies) {
      const isActive = vscode.extensions.getExtension(extensionId)?.isActive;
      expect(isActive, `Dependency not active: ${extensionId}`).to.be.true;
    }
  }
/**
 * Asserts that all contributed commands in package.json are registered with VS Code.
 */
export async function assertAllCommandsAreRegistered(packageJson: any): Promise<void> {
    const vscodeCommands = await vscode.commands.getCommands(true);
    const contributedCommands: { command: string }[] = packageJson.contributes?.commands ?? [];
  
    for (const { command } of contributedCommands) {
      expect(vscodeCommands, `Missing command: ${command}`).to.include(command);
    }
  }