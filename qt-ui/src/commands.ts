// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';

import {
  findQtKits,
  createLogger,
  GlobalWorkspace,
  CORE_EXTENSION_ID
} from 'qt-lib';
import { coreAPI, projectManager } from '@/extension';
import { locateQtDesignerExePath } from '@/util';

const logger = createLogger('commands');

export async function openWidgetDesigner() {
  logger.info('Opening Qt Designer');
  // Find the latest Qt installation in both global and project settings
  // and run the designer
  const qtInsRoots: string[] = [];

  const globalQtInstallationRoot = coreAPI?.getValue<string>(
    GlobalWorkspace,
    'qtInstallationRoot'
  );
  if (globalQtInstallationRoot) {
    qtInsRoots.push(globalQtInstallationRoot);
  }
  for (const project of projectManager.getProjects()) {
    const qtInsRoot = coreAPI?.getValue<string>(
      project.folder,
      'qtInstallationRoot'
    );
    if (qtInsRoot) {
      qtInsRoots.push(qtInsRoot);
    }
  }

  if (qtInsRoots.length === 0) {
    void vscode.window
      .showWarningMessage(
        'No Qt installations root found. Please set an Qt installation root.',
        'Set Qt installation root'
      )
      .then((selection) => {
        if (selection === 'Set Qt installation root') {
          void vscode.commands.executeCommand(
            `${CORE_EXTENSION_ID}.registerQt`
          );
        }
      });
    return;
  }
  const tempQtInstallationsPromises: Promise<string[]>[] = [];
  // remove duplicates
  const uniqueQtInsRoots = Array.from(new Set(qtInsRoots.flat()));
  for (const qtInsRoot of uniqueQtInsRoots) {
    tempQtInstallationsPromises.push(findQtKits(qtInsRoot));
  }
  const qtInstallations = await Promise.all(tempQtInstallationsPromises);
  // remove duplicates
  const uniqueQtInstallations = Array.from(new Set(qtInstallations.flat()));
  // Example path /home/orkun/Qt/6.7.2/android_armv7
  // sort by version number
  const getInstallationVersion = (installationPath: string) => {
    return path.basename(path.dirname(installationPath));
  };
  uniqueQtInstallations.sort((a, b) => {
    const aVersion = getInstallationVersion(a);
    const bVersion = getInstallationVersion(b);
    return aVersion.localeCompare(bVersion, undefined, { numeric: true });
  });
  // group by version number like 6.7.2 6.6.0
  const groupedQtInstallations: Record<string, string[]> = {};
  for (const qtInstallation of uniqueQtInstallations) {
    const version = getInstallationVersion(qtInstallation);
    if (!groupedQtInstallations[version]) {
      groupedQtInstallations[version] = [];
    }
    groupedQtInstallations[version].push(qtInstallation);
  }
  // gonvert groupedQtInstallations to array<<version, locatedPath>>
  const versions: { version: string; locatedPath: string }[] = [];
  for (const version in groupedQtInstallations) {
    if (!groupedQtInstallations[version]) {
      continue;
    }
    // get the first path for each version
    if (!groupedQtInstallations[version][0]) {
      continue;
    }
    const locatedPath = await locateQtDesignerExePath(
      groupedQtInstallations[version][0]
    );
    if (!locatedPath) {
      continue;
    }
    versions.push({ version, locatedPath });
  }
  if (versions.length === 0) {
    const message = `No Qt Designer found in ${uniqueQtInstallations.join(', ')}`;
    void vscode.window.showWarningMessage(message);
    return;
  }
  // Each version has the same Qt Widget Designer even if they are different
  // installations so we can just show the version number
  const selectedQtDesigner = await vscode.window.showQuickPick(
    versions.map((version) => {
      return {
        label: version.version,
        description: version.locatedPath
      };
    }),
    {
      placeHolder: 'Select a Qt Widget Designer version'
    }
  );

  if (!selectedQtDesigner) {
    return;
  }
  logger.info('Designer exe path:', selectedQtDesigner.description);
  if (selectedQtDesigner.description) {
    const process = child_process.spawn(selectedQtDesigner.description, [], {
      shell: true
    });
    process.on('error', (err) => {
      void vscode.window.showErrorMessage(
        `Error while opening Qt Designer: ${err.message}`
      );
    });
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', (data) => {
      void vscode.window.showErrorMessage(`Qt Designer error: ${String(data)}`);
    });
    return;
  }
}
