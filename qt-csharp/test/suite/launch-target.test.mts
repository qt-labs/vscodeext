// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { QtBridgeProject } from 'qt-lib';
import { resolveLaunchTargetPath } from '@/launch-target.mjs';

describe('Qt Bridge launch target command', () => {
  let directory: string;
  let projects: QtBridgeProject[];
  let errors: string[];
  let picked: readonly QtBridgeProject[] | undefined;
  let selection: QtBridgeProject | undefined;
  let activeProject: QtBridgeProject | undefined;
  const api = {
    getProjects: () => projects,
    getProjectForUri: () => activeProject
  };
  const services = {
    getActiveUri: (): vscode.Uri | undefined => activeProject?.projectFile,
    async pickProject(candidates: readonly QtBridgeProject[]) {
      picked = candidates;
      return selection;
    },
    showError(message: string) {
      errors.push(message);
    }
  };

  beforeEach(async () => {
    directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'bridge-launch-')
    );
    projects = [];
    errors = [];
    picked = undefined;
    selection = undefined;
    activeProject = undefined;
  });

  afterEach(async () => {
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  async function project(
    name: string,
    configuration = 'Debug',
    framework = 'net8.0'
  ) {
    const managedHostPath = path.join(
      directory,
      name,
      'bin',
      configuration,
      framework,
      name
    );
    const nativeHostPath = path.join(directory, name, 'obj', 'native-template');
    await fs.promises.mkdir(path.dirname(managedHostPath), { recursive: true });
    await fs.promises.mkdir(path.dirname(nativeHostPath), { recursive: true });
    await fs.promises.writeFile(managedHostPath, 'application');
    await fs.promises.writeFile(nativeHostPath, 'unpatched native template');
    const value = {
      projectFile: vscode.Uri.file(
        path.join(directory, name, `${name}.csproj`)
      ),
      isMetadataReady: true,
      metadata: {
        configuration,
        targetFramework: framework,
        application: { managedHostPath, nativeHostPath }
      }
    } as unknown as QtBridgeProject;
    projects.push(value);
    return value;
  }

  it('returns the built application rather than the native template', async () => {
    const only = await project('App');
    expect(await resolveLaunchTargetPath(api, services)).to.equal(
      only.metadata?.application?.managedHostPath
    );
    expect(picked).to.equal(undefined);
    expect(errors).to.deep.equal([]);
  });

  it('uses the selected configuration and framework, preserving spaces in paths', async () => {
    const only = await project('My App', 'Release', 'net10.0');
    expect(await resolveLaunchTargetPath(api, services)).to.equal(
      only.metadata?.application?.managedHostPath
    );
  });

  it('prefers the project containing the active file', async () => {
    await project('First');
    activeProject = await project('Second');
    expect(await resolveLaunchTargetPath(api, services)).to.equal(
      activeProject.metadata?.application?.managedHostPath
    );
    expect(picked).to.equal(undefined);
  });

  it('asks which project to debug when the active file cannot select one', async () => {
    await project('First');
    selection = await project('Second');
    expect(await resolveLaunchTargetPath(api, services)).to.equal(
      selection.metadata?.application?.managedHostPath
    );
    expect(picked).to.deep.equal(projects);
  });

  it('cancels without falling back to another project', async () => {
    await project('First');
    await project('Second');
    expect(await resolveLaunchTargetPath(api, services)).to.equal(undefined);
    expect(errors).to.deep.equal([]);
  });

  it('reports an empty workspace', async () => {
    expect(await resolveLaunchTargetPath(api, services)).to.equal(undefined);
    expect(errors).to.have.length(1);
    expect(errors[0]).to.include('No Qt Bridge C# project');
  });

  it('asks for a build or metadata selection when application metadata is missing', async () => {
    const only = await project('App');
    (only as { metadata: undefined }).metadata = undefined;
    expect(await resolveLaunchTargetPath(api, services)).to.equal(undefined);
    expect(errors[0])
      .to.include('Build the project')
      .and.include('Select QML Build Metadata');
  });

  it('does not use another project when the active project has no metadata', async () => {
    await project('Built');
    activeProject = await project('Unbuilt');
    (activeProject as { metadata: undefined }).metadata = undefined;
    expect(await resolveLaunchTargetPath(api, services)).to.equal(undefined);
    expect(picked).to.equal(undefined);
    expect(errors[0]).to.include('Unbuilt.csproj');
  });

  it('does not require QML tooling readiness for an existing executable', async () => {
    const only = await project('App');
    (only as { isMetadataReady: boolean }).isMetadataReady = false;
    expect(await resolveLaunchTargetPath(api, services)).to.equal(
      only.metadata?.application?.managedHostPath
    );
  });

  it('reports a cleaned executable without falling back to the native template', async () => {
    const only = await project('App');
    const host = only.metadata?.application?.managedHostPath;
    if (!host) {
      throw new Error('Expected an application host');
    }
    await fs.promises.unlink(host);
    expect(await resolveLaunchTargetPath(api, services)).to.equal(undefined);
    expect(errors[0]).to.include('host not found').and.include(host);
  });

  it('rejects a directory at the executable path', async () => {
    const only = await project('App');
    const host = only.metadata?.application?.managedHostPath;
    if (!host) {
      throw new Error('Expected an application host');
    }
    await fs.promises.unlink(host);
    await fs.promises.mkdir(host);
    expect(await resolveLaunchTargetPath(api, services)).to.equal(undefined);
    expect(errors[0]).to.include('host not found');
  });
});
