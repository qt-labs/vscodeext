// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as vscode from 'vscode';
import {
  isExtensionActive,
  assertAllDependenciesAreActive,
  assertAllCommandsAreRegistered,
  getQtBridgeCSharpApi,
  type QtBridgeCSharpAPI
} from 'qt-lib';
import { resolveQtBridgeCSharpApi } from '../../../qt-lib/src/qtbridge-csharp-api-internal.js';

const packageJson = require('../../package.json');
const extensionId = 'theqtcompany.qt-bridge-csharp';

describe('API', () => {
  it('returns undefined when the extension is unavailable', async () => {
    expect(await resolveQtBridgeCSharpApi(undefined)).to.be.undefined;
  });

  it('returns undefined when extension activation fails', async () => {
    const extension = {
      isActive: false,
      activate: () => Promise.reject(new Error('activation failed'))
    } as unknown as vscode.Extension<unknown>;

    expect(await resolveQtBridgeCSharpApi(extension)).to.be.undefined;
  });

  it('activates an inactive extension', async () => {
    const api = {} as QtBridgeCSharpAPI;
    const extension = {
      isActive: false,
      activate: () => Promise.resolve(api)
    } as unknown as vscode.Extension<unknown>;

    expect(await resolveQtBridgeCSharpApi(extension)).to.equal(api);
  });

  it('returns the exports of an active extension', async () => {
    const api = {} as QtBridgeCSharpAPI;
    const extension = {
      isActive: true,
      exports: api
    } as unknown as vscode.Extension<unknown>;

    expect(await resolveQtBridgeCSharpApi(extension)).to.equal(api);
  });
});

describe('extension', () => {
  before('activate', async function () {
    this.timeout(30000);
    const extension = vscode.extensions.getExtension(extensionId);
    if (!extension) throw new Error('qt-bridge-csharp extension not found');
    await extension.activate();
  });

  it('activates the qt-bridge-csharp extension', () => {
    expect(isExtensionActive(extensionId)).to.be.true;
  });

  it('activates all declared extension dependencies', () => {
    assertAllDependenciesAreActive(packageJson);
  });

  it('registers all contributed commands', async () => {
    await assertAllCommandsAreRegistered(packageJson);
  });

  it('exports empty project state', async () => {
    const api = await getQtBridgeCSharpApi();
    const folder = {
      uri: vscode.Uri.file('empty-workspace'),
      name: 'empty-workspace',
      index: 0
    };

    expect(api).not.to.be.undefined;
    expect(api?.getProjects()).to.deep.equal([]);
    expect(api?.getProject(folder)).to.be.undefined;
    expect(api?.getProjectForUri(folder.uri)).to.be.undefined;
  });
});
