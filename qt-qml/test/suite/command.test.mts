// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtQml,
  createFetchStub
} from '../helper.mts';

describe('command: downloadQmlls', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtQml()
  );

  async function runDownloadQmllsCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-qml.downloadQmlls');
    await waitForVSCodeIdle();
  }

  it('given the qml extension is active when downloadQmlls is executed then it fetches release info and completes without hanging', async () => {
    // The command fetches qmlls release info over the network. Mocha does not
    // wait for global fetch, so it must be stubbed; otherwise the real request
    // runs and the test times out. Returning a release without a matching asset
    // drives the graceful "nothing to download" path (no real download).
    const fetchStub = createFetchStub(sb, { tag_name: 'v0.0.0', assets: [] });
    const showErrorMessage = sb.spy(vscode.window, 'showErrorMessage');

    await runDownloadQmllsCommand();

    // The command reached the network layer and handled the missing asset
    // gracefully instead of attempting a download.
    expect(fetchStub.called, 'fetch should be called').to.be.true;
    expect(
      showErrorMessage.called,
      'a graceful error should be surfaced when no asset is available'
    ).to.be.true;
  });
});

// describe('command: restartQmlls', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runRestartQmllsCommand(): Promise<void> {
//     await vscode.commands.executeCommand('qt-qml.restartQmlls');
//     await waitForVSCodeIdle();
//   }

//   it('given the qml extension is active when restartQmlls is executed then it performs the expected restart behavior', async () => {
//     await runRestartQmllsCommand();

//     // TODO:
//     // - spy/stub the service restart entry point
//     // - assert the restart logic is triggered
//     expect(true).to.be.true;
//   });
// });

// describe('command: checkQmllsUpdate', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runCheckQmllsUpdateCommand(): Promise<void> {
//     await vscode.commands.executeCommand('qt-qml.checkQmllsUpdate');
//     await waitForVSCodeIdle();
//   }

//   it('given the qml extension is active when checkQmllsUpdate is executed then it performs the expected update check behavior', async () => {
//     await runCheckQmllsUpdateCommand();

//     // TODO:
//     // - stub network/update service
//     // - assert expected message / action / command
//     expect(true).to.be.true;
//   });
// });

// describe('command: startQmlPreview', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runStartQmlPreviewCommand(): Promise<void> {
//     await vscode.commands.executeCommand('qt-qml.startQmlPreview');
//     await waitForVSCodeIdle();
//   }

//   it('given qml preview is available when startQmlPreview is executed then it starts qml preview', async () => {
//     await runStartQmlPreviewCommand();

//     // TODO:
//     // - stub preview launcher
//     // - assert launch/start behavior
//     expect(true).to.be.true;
//   });
// });

// describe('command: startQmlPreviewForCurrentFile', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runStartQmlPreviewForCurrentFileCommand(): Promise<void> {
//     await vscode.commands.executeCommand(
//       'qt-qml.startQmlPreviewForCurrentFile'
//     );
//     await waitForVSCodeIdle();
//   }

//   it('given a qml file is active when startQmlPreviewForCurrentFile is executed then it starts preview for the current file', async () => {
//     await runStartQmlPreviewForCurrentFileCommand();

//     // TODO:
//     // - create/mock active qml editor
//     // - stub preview launcher
//     // - assert file-specific launch arguments
//     expect(true).to.be.true;
//   });
// });

// describe('command: attachQmlPreview', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runAttachQmlPreviewCommand(): Promise<void> {
//     await vscode.commands.executeCommand('qt-qml.attachQmlPreview');
//     await waitForVSCodeIdle();
//   }

//   it('given qml preview is attachable when attachQmlPreview is executed then it performs the expected attach behavior', async () => {
//     await runAttachQmlPreviewCommand();

//     // TODO:
//     // - stub debug/attach entry point
//     // - assert attach flow
//     expect(true).to.be.true;
//   });
// });

// describe('command: stopQmlPreview', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runStopQmlPreviewCommand(): Promise<void> {
//     await vscode.commands.executeCommand('qt-qml.stopQmlPreview');
//     await waitForVSCodeIdle();
//   }

//   it('given qml preview is running when stopQmlPreview is executed then it stops qml preview', async () => {
//     await runStopQmlPreviewCommand();

//     // TODO:
//     // - stub preview stop entry point
//     // - assert stop behavior
//     expect(true).to.be.true;
//   });
// });

// describe('command: reloadQmlPreview', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runReloadQmlPreviewCommand(): Promise<void> {
//     await vscode.commands.executeCommand('qt-qml.reloadQmlPreview');
//     await waitForVSCodeIdle();
//   }

//   it('given qml preview is running when reloadQmlPreview is executed then it reloads qml preview', async () => {
//     await runReloadQmlPreviewCommand();

//     // TODO:
//     // - stub preview reload entry point
//     // - assert reload behavior
//     expect(true).to.be.true;
//   });
// });

// describe('command: clearQmlPreviewCache', () => {
//   let sb: sinon.SinonSandbox;
//   setupSandboxLifecycleHooks(
//     (_sb) => (sb = _sb),
//     async () => activateQtQml()
//   );

//   async function runClearQmlPreviewCacheCommand(): Promise<void> {
//     await vscode.commands.executeCommand('qt-qml.clearQmlPreviewCache');
//     await waitForVSCodeIdle();
//   }

//   it('given qml preview cache exists when clearQmlPreviewCache is executed then it clears the qml preview cache', async () => {
//     await runClearQmlPreviewCacheCommand();

//     // TODO:
//     // - stub cache clearing entry point
//     // - assert clear behavior
//     expect(true).to.be.true;
//   });
// });
