// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { QtBridgeProject, QtBridgeQmlMetadata } from 'qt-lib';
import {
  createQtBridgeSourceRedirect,
  getQtBridgePreviewProjects,
  isQtBridgePreviewAvailable,
  resolveQmlLaunchProject,
  selectQtBridgePreviewProject
} from '@/preview/qtbridge-preview-project.mjs';
import {
  createKeyedDebouncer,
  normalizePathForComparison,
  prependPathEntries
} from '@/utils.mjs';

function workspaceFolder(name: string, index: number): vscode.WorkspaceFolder {
  return {
    name,
    index,
    uri: vscode.Uri.file(`/workspace/${name}`)
  };
}

function bridgeProject(
  folder: vscode.WorkspaceFolder,
  name: string,
  ready = true
): QtBridgeProject {
  return {
    folder,
    projectFile: vscode.Uri.joinPath(folder.uri, name, `${name}.csproj`),
    isMetadataReady: ready,
    metadata: ready
      ? {
          application: {},
          qml: { files: [{}] }
        }
      : undefined
  } as unknown as QtBridgeProject;
}

describe('Qt Bridge QML Preview project selection', () => {
  it('normalizes paths used for Preview file matching', () => {
    const normalized = normalizePathForComparison('Source\\Main.qml');
    const expected =
      process.platform === 'win32' ? 'source/main.qml' : 'Source/Main.qml';

    expect(normalized).to.equal(expected);
  });

  it('requires ready application metadata before enabling preview', () => {
    const folder = workspaceFolder('selected', 0);
    const unready = bridgeProject(folder, 'Unready', false);
    const ready = bridgeProject(folder, 'Ready');

    expect(isQtBridgePreviewAvailable(unready)).to.equal(false);
    expect(isQtBridgePreviewAvailable(ready)).to.equal(true);
  });

  it('excludes unready projects from Preview selection', async () => {
    const folder = workspaceFolder('selected', 0);
    const first = bridgeProject(folder, 'First');
    const second = bridgeProject(folder, 'Second');
    const unready = bridgeProject(folder, 'Unready', false);
    const picker = sinon.stub().resolves(second);

    const selected = await selectQtBridgePreviewProject(folder, undefined, {
      getProjects: () => [first, unready, second],
      getProjectForUri: () => undefined,
      getWorkspaceFolder: () => undefined,
      pickProject: picker
    });

    expect(selected).to.equal(second);
    expect(getQtBridgePreviewProjects([first, unready, second])).to.deep.equal([
      first,
      second
    ]);
    expect(picker.calledOnceWithExactly([first, second])).to.equal(true);
  });

  it('does not prompt when no Bridge project is ready for Preview', async () => {
    const folder = workspaceFolder('selected', 0);
    const first = bridgeProject(folder, 'First', false);
    const second = bridgeProject(folder, 'Second', false);
    const picker = sinon.stub().resolves(undefined);

    const selected = await selectQtBridgePreviewProject(folder, undefined, {
      getProjects: () => [first, second],
      getProjectForUri: () => undefined,
      getWorkspaceFolder: () => undefined,
      pickProject: picker
    });

    expect(selected).to.equal(undefined);
    expect(picker.called).to.equal(false);
  });

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

describe('QML Preview and Profiler launch project', () => {
  const noFeatures = { pySideProject: false, cmake: false, pyside: false };
  const cmakeFeatures = { ...noFeatures, cmake: true };

  it('prefers a Bridge project over a generated CMake project', async () => {
    const folder = workspaceFolder('selected', 0);
    const project = bridgeProject(folder, 'Application');

    const launch = await resolveQmlLaunchProject(
      folder,
      undefined,
      cmakeFeatures,
      {
        getProjects: () => [project],
        getProjectForUri: () => undefined,
        getWorkspaceFolder: () => undefined,
        pickProject: sinon.stub().resolves(undefined)
      }
    );

    expect(launch).to.deep.equal({ type: 'bridge', bridgeProject: project });
  });

  it('uses the Bridge project of the active file in a CMake folder', async () => {
    const folder = workspaceFolder('selected', 0);
    const first = bridgeProject(folder, 'First');
    const second = bridgeProject(folder, 'Second');
    const activeUri = vscode.Uri.joinPath(folder.uri, 'Second', 'Main.qml');
    const picker = sinon.stub().resolves(first);

    const launch = await resolveQmlLaunchProject(
      folder,
      activeUri,
      cmakeFeatures,
      {
        getProjects: () => [first, second],
        getProjectForUri: () => second,
        getWorkspaceFolder: () => folder,
        pickProject: picker
      }
    );

    expect(launch).to.deep.equal({ type: 'bridge', bridgeProject: second });
    expect(picker.called).to.equal(false);
  });

  it('keeps CMake for an active file outside the Bridge projects', async () => {
    const folder = workspaceFolder('selected', 0);
    const project = bridgeProject(folder, 'Application');
    const activeUri = vscode.Uri.joinPath(folder.uri, 'cpp', 'Main.qml');

    const launch = await resolveQmlLaunchProject(
      folder,
      activeUri,
      cmakeFeatures,
      {
        getProjects: () => [project],
        getProjectForUri: () => undefined,
        getWorkspaceFolder: () => folder,
        pickProject: sinon.stub().resolves(undefined)
      }
    );

    expect(launch).to.deep.equal({ type: 'cmake' });
  });

  it('keeps an existing PySide project first', async () => {
    const folder = workspaceFolder('selected', 0);
    const project = bridgeProject(folder, 'Application');

    const launch = await resolveQmlLaunchProject(
      folder,
      undefined,
      { ...noFeatures, pySideProject: true },
      {
        getProjects: () => [project],
        getProjectForUri: () => undefined,
        getWorkspaceFolder: () => undefined,
        pickProject: sinon.stub().resolves(undefined)
      }
    );

    expect(launch).to.deep.equal({ type: 'pyside' });
  });

  it('falls back to the detected type without ready Bridge projects', async () => {
    const folder = workspaceFolder('selected', 0);
    const unready = bridgeProject(folder, 'Application', false);

    const launch = await resolveQmlLaunchProject(
      folder,
      undefined,
      cmakeFeatures,
      {
        getProjects: () => [unready],
        getProjectForUri: () => undefined,
        getWorkspaceFolder: () => undefined,
        pickProject: sinon.stub().resolves(undefined)
      }
    );

    expect(launch).to.deep.equal({ type: 'cmake' });
  });

  it('reports unbuilt Bridge projects instead of falling back to CMake', async () => {
    const folder = workspaceFolder('selected', 0);
    const unready = bridgeProject(folder, 'Application', false);
    const services = {
      getProjects: () => [unready],
      getProjectForUri: () => undefined,
      getWorkspaceFolder: () => undefined,
      pickProject: sinon.stub().resolves(undefined)
    };

    expect(
      await resolveQmlLaunchProject(folder, undefined, noFeatures, services)
    ).to.deep.equal({ type: 'bridge' });
    expect(
      await resolveQmlLaunchProject(folder, undefined, noFeatures, {
        ...services,
        getProjects: () => []
      })
    ).to.deep.equal({ type: undefined });
  });

  it('reports a cancelled Bridge project selection', async () => {
    const folder = workspaceFolder('selected', 0);
    const first = bridgeProject(folder, 'First');
    const second = bridgeProject(folder, 'Second');

    const launch = await resolveQmlLaunchProject(
      folder,
      undefined,
      cmakeFeatures,
      {
        getProjects: () => [first, second],
        getProjectForUri: () => undefined,
        getWorkspaceFolder: () => undefined,
        pickProject: sinon.stub().resolves(undefined)
      }
    );

    expect(launch).to.equal(undefined);
  });
});

describe('Qt Bridge QML Preview source redirect', () => {
  const project = path.resolve('/work/App');
  const staged = path.resolve('/tmp/preview/launch');
  const metadata = {
    application: { managedOutputDir: path.join(project, 'bin', 'Debug') },
    qml: {
      sourceDir: path.join(project, 'obj', 'qt', 'native', 'source'),
      files: [
        {
          sourcePath: path.join(project, 'Main.qml'),
          modulePath: 'Application/'
        },
        {
          sourcePath: path.join(project, 'controls', 'ColorBox.qml'),
          modulePath: 'controls/'
        }
      ]
    }
  } as unknown as QtBridgeQmlMetadata;

  it('serves the sources for the build copies of QML files', () => {
    const redirect = createQtBridgeSourceRedirect(metadata, staged);
    const colorBox = path.join(project, 'controls', 'ColorBox.qml');

    expect(redirect(path.join(staged, 'controls', 'ColorBox.qml'))).to.equal(
      colorBox
    );
    expect(
      redirect(
        path.join(metadata.qml.sourceDir, 'qml', 'controls', 'ColorBox.qml')
      )
    ).to.equal(colorBox);
    expect(
      redirect(path.join(project, 'bin', 'Debug', 'Application', 'Main.qml'))
    ).to.equal(path.join(project, 'Main.qml'));
  });

  it('keeps files that are not copies of project QML files', () => {
    const redirect = createQtBridgeSourceRedirect(metadata, staged);

    expect(redirect(path.join(staged, 'Application', 'qmldir'))).to.equal(
      undefined
    );
    expect(redirect(path.join(staged, 'Application', 'ColorBox.qml'))).to.equal(
      undefined
    );
  });

  it('redirects canonical staging paths when the staging root is a symlink', async function () {
    if (process.platform === 'win32') {
      this.skip();
    }
    const directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'qml-redirect-')
    );
    try {
      const real = path.join(directory, 'real');
      const alias = path.join(directory, 'alias');
      await fs.promises.mkdir(real);
      await fs.promises.symlink(real, alias, 'dir');
      const redirect = createQtBridgeSourceRedirect(metadata, alias);
      const source = path.join(project, 'Main.qml');
      expect(redirect(path.join(alias, 'Application', 'Main.qml'))).to.equal(
        source
      );
      expect(
        redirect(
          path.join(fs.realpathSync.native(alias), 'Application', 'Main.qml')
        )
      ).to.equal(source);
    } finally {
      await fs.promises.rm(directory, { recursive: true, force: true });
    }
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

describe('QML Preview file change handling', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('handles a burst of change events for a file once', () => {
    const handler = sinon.spy();
    const changes = createKeyedDebouncer(50, handler);

    changes.trigger('main.qml');
    clock.tick(2);
    changes.trigger('main.qml');
    changes.trigger('box.qml');
    clock.tick(49);
    expect(handler.called).to.equal(false);

    clock.tick(1);
    expect(handler.args).to.deep.equal([['main.qml'], ['box.qml']]);

    changes.trigger('main.qml');
    clock.tick(50);
    expect(handler.callCount).to.equal(3);
  });

  it('drops pending changes when disposed', () => {
    const handler = sinon.spy();
    const changes = createKeyedDebouncer(50, handler);

    changes.trigger('main.qml');
    changes.dispose();
    clock.tick(100);
    expect(handler.called).to.equal(false);
  });
});
