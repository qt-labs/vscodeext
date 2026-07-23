// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import type { QtBridgeProject } from 'qt-lib';
import { selectQtBridgePreviewProject } from '@/preview/qtbridge-preview-project.mjs';
import { prependPathEntries } from '@/utils.mjs';

function workspaceFolder(name: string, index: number): vscode.WorkspaceFolder {
  return {
    name,
    index,
    uri: vscode.Uri.file(`/workspace/${name}`)
  };
}

function bridgeProject(
  folder: vscode.WorkspaceFolder,
  name: string
): QtBridgeProject {
  return {
    folder,
    projectFile: vscode.Uri.joinPath(folder.uri, name, `${name}.csproj`)
  } as QtBridgeProject;
}

describe('Qt Bridge QML Preview project selection', () => {
  it('uses the project containing the active file in the selected folder', async () => {
    const folder = workspaceFolder('selected', 0);
    const first = bridgeProject(folder, 'First');
    const second = bridgeProject(folder, 'Second');
    const activeUri = vscode.Uri.joinPath(folder.uri, 'Second', 'Main.qml');
    const picker = sinon.stub().resolves(undefined);

    const selected = await selectQtBridgePreviewProject(folder, activeUri, {
      getProjects: () => [first, second],
      getProjectForUri: () => second,
      getWorkspaceFolder: () => folder,
      pickProject: picker
    });

    expect(selected).to.equal(second);
    expect(picker.called).to.equal(false);
  });

  it('does not use an active project from another workspace folder', async () => {
    const selectedFolder = workspaceFolder('selected', 0);
    const activeFolder = workspaceFolder('active', 1);
    const first = bridgeProject(selectedFolder, 'First');
    const second = bridgeProject(selectedFolder, 'Second');
    const other = bridgeProject(activeFolder, 'Other');
    const activeUri = vscode.Uri.joinPath(
      activeFolder.uri,
      'Other',
      'Main.qml'
    );
    const projectForUri = sinon.stub().returns(other);
    const picker = sinon.stub().resolves(first);

    const selected = await selectQtBridgePreviewProject(
      selectedFolder,
      activeUri,
      {
        getProjects: () => [first, second],
        getProjectForUri: projectForUri,
        getWorkspaceFolder: () => activeFolder,
        pickProject: picker
      }
    );

    expect(selected).to.equal(first);
    expect(projectForUri.called).to.equal(false);
    expect(picker.calledOnceWithExactly([first, second])).to.equal(true);
  });

  it('returns the only project without prompting', async () => {
    const folder = workspaceFolder('selected', 0);
    const project = bridgeProject(folder, 'Application');
    const picker = sinon.stub().resolves(undefined);

    const selected = await selectQtBridgePreviewProject(folder, undefined, {
      getProjects: () => [project],
      getProjectForUri: () => undefined,
      getWorkspaceFolder: () => undefined,
      pickProject: picker
    });

    expect(selected).to.equal(project);
    expect(picker.called).to.equal(false);
  });
});

describe('Qt Bridge QML Preview launch environment', () => {
  it('preserves the case-insensitive Windows Path value', () => {
    const environment = {
      Path: 'C:\\Windows;C:\\Program Files\\dotnet'
    };

    prependPathEntries(environment, ['C:\\Qt\\bin'], 'win32');

    expect(environment.Path).to.equal(
      'C:\\Qt\\bin;C:\\Windows;C:\\Program Files\\dotnet'
    );
    expect(environment).not.to.have.property('PATH');
  });
});
