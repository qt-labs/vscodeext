// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  isMultiWorkspace,
  QtAdditionalPath,
  AdditionalQtPathsName,
  QtInsRootConfigName,
  generateDefaultQtPathsName,
  delay
} from 'qt-lib';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addQtPathToSettings } from '../../src/qtpaths.ts';
import * as texts from '../../src/texts.ts';
import { getDefaultQtRootCandidates } from '../../src/installation-root.ts';

import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  getMockConfiguration,
  createFetchStub,
  modifyFetchStub,
  stubExecuteCommandWithSpy,
  stubGetConfigurationWithUpdateSpy,
  stubShowOpenDialogWithSpy,
  testSearchCommandOpensExpectedQtDocPage,
  setupDialogAndConfig,
  activateQtCore,
  createFakeQtInfo,
  setupGetQtInfoStub,
  getCoreAPI,
  expectUpdateCalledWith,
  stubWarningMessage,
  expectCalledOnce,
  getSearchInputBoxStubWithArg,
  createMockTextEditorWithCurrentWord
} from '../helper.mts';

describe('command: documentation Homepage', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  const linkQtDoc = 'https://doc.qt.io';
  // Function to run the command and wait for VS Code to be idle
  async function runDocumentationHomePageCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.documentationHomepage');
    await waitForVSCodeIdle();
  }
  // Function to get the command arguments for opening the Qt documentation in a simple browser
  // This is used to check the command is called with the expected arguments
  // and to avoid opening the simple browser during the test
  function getArgForSimpleBrowserCommand(): [string, ...unknown[]] {
    return [
      'simpleBrowser.api.open',
      linkQtDoc,
      {
        viewColumn: vscode.ViewColumn.Beside
      }
    ] as [string, ...unknown[]];
  }
  // Function to stub the configuration to open the documentation in VSCode or external browser
  function stubConfigToOpenDocInBrowser(external: boolean): sinon.SinonStub {
    // Configuration key for opening the documentation in an external browser
    const externalBrowser = 'openOnlineDocumentationInExternalBrowser';
    return sb
      .stub(vscode.workspace, 'getConfiguration')
      .returns(getMockConfiguration(externalBrowser, external));
  }

  it('can open qt documentation home page within VS Code', async () => {
    // Stubbing the configuration to have doc open within VS Code
    stubConfigToOpenDocInBrowser(false);

    const openSimpleBrowser = stubExecuteCommandWithSpy(
      sb,
      getArgForSimpleBrowserCommand()
    );

    await runDocumentationHomePageCommand();

    expectCalledOnce(openSimpleBrowser, 'openSimpleBrowser');
  });

  it('can opens qt documentation home page in an external browser', async () => {
    // Stubbing the configuration to have doc open in external browser
    stubConfigToOpenDocInBrowser(true);

    // Using stub instead of spy to avoid opening the external browser
    const openExternal = sb.stub(vscode.env, 'openExternal');
    const openQtDocInExt = sb.stub(vscode.Uri, 'parse').withArgs(linkQtDoc);

    await runDocumentationHomePageCommand();

    expectCalledOnce(openExternal, 'openExternal');
    expectCalledOnce(openQtDocInExt, 'openQtDocInExt');
  });
});

describe('command: documentationSearchManually', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );
  beforeEach('closing all editor', async () =>
    vscode.commands.executeCommand('workbench.action.closeAllEditors')
  );
  afterEach('closing all editor', async () =>
    vscode.commands.executeCommand('workbench.action.closeAllEditors')
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runDocumentationSearchManually(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.documentationSearchManually');
    await waitForVSCodeIdle();
  }

  function stubFetchBehaviour(searchWord: string): void {
    const link = 'https://doc.qt.io/qt-6/' + searchWord + '.html';
    // Mocha does not wait for global fetch. Need to stub it to test what happens after
    // Default stub behaviour, fetch succeeds when called within searchWithEngine
    const responseBody = {
      items: [
        { title: '1', link: 'item1', snippet: 'snippet1' },
        { title: '2', link: 'item2', snippet: 'snippet2' }
      ]
    };
    const fetchStub = createFetchStub(sb, responseBody, 200);
    // Stub behaviour when called from tryToOpenDocumentationFor
    // trying to get the qt doc page for the search word
    modifyFetchStub(fetchStub, link, { error: 'Not found' }, 404);
  }

  it('opens an input box', async () => {
    const showInputBox = getSearchInputBoxStubWithArg(sb, '');

    await runDocumentationSearchManually();

    // Input box opens with the expected text
    expectCalledOnce(showInputBox, 'showInputBox');
  });

  it('opens an input box and offers selection after search word is entered', async () => {
    const searchWord = 'application';
    // Mimick entering a word to search
    const showInputBox = getSearchInputBoxStubWithArg(sb, '', searchWord);
    // Stub instead of spy to avoid picker
    const searchSelection = sb
      .stub(vscode.window, 'showQuickPick')
      .withArgs(sinon.match.any, {
        placeHolder: 'Select a search result'
      });

    // deal with global fetch
    stubFetchBehaviour(searchWord);

    await runDocumentationSearchManually();

    // Input box opens with the expected text
    expectCalledOnce(showInputBox, 'showInputBox');

    // Select a search result quick pick window opens
    expectCalledOnce(searchSelection, 'searchSelection');
  });

  it('opens an input box with editor selection', async () => {
    await testSearchCommandOpensExpectedQtDocPage(
      'qt-core.documentationSearchManually',
      sb,
      true
    );
  });
});

describe('command: documentationSearchForCurrentWord', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runDocumentationSearchForCurrentWordCommand(): Promise<void> {
    await vscode.commands.executeCommand(
      'qt-core.documentationSearchForCurrentWord'
    );
    await waitForVSCodeIdle();
  }

  it('shows that it is searching and that no result is found if current word is no Qt type (at all)', async () => {
    // Mocking an editor with document returning a non Qt Type
    const currentWord = 'fakepath';
    //const mockTextEditor = createMockTextEditor(currentWord);
    //sb.stub(vscode.window, 'activeTextEditor').value(mockTextEditor);
    createMockTextEditorWithCurrentWord(sb, currentWord);

    const options = {
      location: vscode.ProgressLocation.Notification,
      title: 'Searching...',
      cancellable: true
    };
    const withProgress = sb
      .spy(vscode.window, 'withProgress')
      .withArgs(options);
    const showNoSearchResult = sb
      .spy(vscode.window, 'showInformationMessage')
      .withArgs('No search results found.');

    const link = 'https://doc.qt.io/qt-6/' + currentWord + '.html';
    // Mocha does not wait for global fetch, need to stub it
    const fetchStub = createFetchStub(sb, {}, 200);
    modifyFetchStub(fetchStub, link, { error: 'Not found' }, 404);

    await runDocumentationSearchForCurrentWordCommand();

    expectCalledOnce(showNoSearchResult, 'showNoSearchResult');
    expectCalledOnce(withProgress, 'withProgress');
  });

  // If no current word
  it('tells that no word is found at the cursor', async () => {
    // Mocking an editor with document returning no current word
    createMockTextEditorWithCurrentWord(sb, '');

    const showInformationMessage = sb
      .spy(vscode.window, 'showInformationMessage')
      .withArgs('No word found at the cursor.');

    await runDocumentationSearchForCurrentWordCommand();

    expectCalledOnce(showInformationMessage, 'showInformationMessage');
  });
  // If a Qt type is at cursor
  it('opens a simple browser showing Qt documentation of the current word', async () => {
    await testSearchCommandOpensExpectedQtDocPage(
      'qt-core.documentationSearchForCurrentWord',
      sb,
      false
    );
  });
});

describe('command: openSettings', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runOpenSettingsCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.openSettings');
    await waitForVSCodeIdle();
  }

  it('leads to vscode workbench action openSettings', async () => {
    const commandArgs = [
      'workbench.action.openSettings',
      '@ext:theqtcompany.qt-cpp @ext:theqtcompany.qt-qml @ext:theqtcompany.qt-ui @ext:theqtcompany.qt-core'
    ] as [string, ...unknown[]];
    const openSettingsSpy = stubExecuteCommandWithSpy(sb, commandArgs);
    await runOpenSettingsCommand();

    expectCalledOnce(openSettingsSpy, 'openSettingsSpy');
  });
  // This is not checking that the settings content as should be.
  // The settins content should be tested in: settings-presentation.test.ts
});

describe('command: setRecommendedSettings', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runRecommandSettingsCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.setRecommendedSettings');
    await waitForVSCodeIdle();
  }

  it('updates the qt-core configuration with the RecommendedSetting', async () => {
    const recommendedSettingsSections: string[] = ['cmake'];
    const updateSpy = stubGetConfigurationWithUpdateSpy(
      sb,
      recommendedSettingsSections
    );

    await runRecommandSettingsCommand();

    expect(updateSpy.callCount).to.equal(3);
    const configurationTarget = isMultiWorkspace()
      ? vscode.ConfigurationTarget.Workspace
      : undefined;
    // TODO: reorganise if the recommended settings get bigger.
    // carefull, calledWith does not do deep equal, keep explicit values
    expect(
      updateSpy.calledWith(
        'options.statusBarVisibility',
        'visible',
        configurationTarget
      )
    ).to.be.true;
    expect(
      updateSpy.calledWith(
        'buildDirectory',
        `\${workspaceFolder}${path.sep}builds${path.sep}\${buildKit}${path.sep}\${buildType}`,
        configurationTarget
      )
    ).to.be.true;
    expect(
      updateSpy.calledWith('useCMakePresets', 'never', configurationTarget)
    ).to.be.true;
  });
});

describe('command: registerQt', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runRegisterCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.registerQt');
    await waitForVSCodeIdle();
  }

  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select Qt installation root',
    canSelectFiles: false,
    canSelectFolders: true
  };
  function assertConfigUpdateCalledWithQtInsRootConfigName(
    spy: sinon.SinonSpy,
    expected: string | Record<string, unknown> | Record<string, unknown>[],
    shouldMatch = true,
    verifyDeepEquality = true
  ): void {
    expectUpdateCalledWith(
      spy,
      QtInsRootConfigName,
      expected,
      vscode.ConfigurationTarget.Global,
      shouldMatch,
      verifyDeepEquality
    );
  }

  it('opens a dialog at the default path to please select Qt installation root', async () => {
    // undefined here cancels the dialog
    const { openDialogSpy, updateSpy } = setupDialogAndConfig(
      sb,
      options,
      undefined
    );

    // Pick one candidate and pretend it exists
    const candidates = getDefaultQtRootCandidates();
    const portable = path.join(os.homedir(), 'Qt');
    // Guard to ensure test stays aligned with production candidates
    expect(
      candidates.includes(portable),
      `portable default path ${portable} is not in candidates: ${JSON.stringify(candidates)}`
    ).to.be.true;
    // Create the directory if missing (needed for CI), and remember if we created it
    let createdHere = false;
    if (!fs.existsSync(portable)) {
      fs.mkdirSync(portable, { recursive: true });
      createdHere = true;
    }

    try {
      await runRegisterCommand();

      expectCalledOnce(openDialogSpy, 'openDialog');
      expect(
        openDialogSpy.calledWithMatch(
          sinon.match.has('defaultUri', sinon.match.instanceOf(vscode.Uri))
        ),
        'Expected showOpenDialog to include a defaultUri (vscode.Uri).'
      ).to.be.true;
      // Configuration is not updated
      expect(updateSpy.called, `config.update should be not be called`).to.be
        .false;
    } finally {
      // Clean up only if we created the folder
      if (createdHere) {
        try {
          fs.rmSync(portable, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  });
  // This does not check how the default path is built

  it('sets the global Qt installation root for the selected path', async () => {
    // this is done by updating the extension configuration
    const fakeUri: [vscode.Uri, ...vscode.Uri[]] = [
      vscode.Uri.file('myfakepath')
    ];
    const { openDialogSpy, updateSpy } = setupDialogAndConfig(
      sb,
      options,
      fakeUri
    );

    await runRegisterCommand();

    expectCalledOnce(openDialogSpy, 'openDialog');
    assertConfigUpdateCalledWithQtInsRootConfigName(
      updateSpy,
      fakeUri[0].fsPath
    );
  });
});

describe('command: registerQtByQtpaths', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runRegisterCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.registerQtByQtpaths');
    await waitForVSCodeIdle();
  }

  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select',
    title: 'Select a qtpaths or qmake executable',
    canSelectFiles: true,
    canSelectFolders: false
  };

  function assertConfigUpdateCalledWithAdditionalPaths(
    spy: sinon.SinonSpy,
    expected: string | Record<string, unknown> | Record<string, unknown>[],
    shouldMatch = true,
    verifyDeepEquality = true
  ): void {
    expectUpdateCalledWith(
      spy,
      AdditionalQtPathsName,
      expected,
      vscode.ConfigurationTarget.Global,
      shouldMatch,
      verifyDeepEquality
    );
  }
  stubGetConfigurationWithUpdateSpy;
  function overrideInspectForQtPaths(
    sectionName: string,
    existing: QtAdditionalPath
  ): void {
    const config = vscode.workspace.getConfiguration('qt-core');
    config.inspect = <T extends unknown>(_section: string) => {
      if (_section === sectionName) {
        return {
          key: _section,
          globalValue: [structuredClone(existing)] as unknown as T
        };
      }
      return undefined;
    };
  }

  function missingQtWarning(path: string): string {
    return `The specified additional Qt installation '${path}' does not exist.`;
  }

  it('opens the select Qt Installation dialog without default path', async () => {
    // no default Uri is provided
    // undefined mimicks user cancels the dialog
    const openDialogSpy = stubShowOpenDialogWithSpy(sb, options, undefined);

    await runRegisterCommand();

    expectCalledOnce(openDialogSpy, 'openDialog');
    expect(
      openDialogSpy.calledWithMatch(
        sinon.match.has('defaultUri', sinon.match.instanceOf(vscode.Uri))
      )
    ).to.be.false;
  });

  it('skips config update when QtInfo cannot be retrieved', async () => {
    const fakePath = 'myfakepath';
    const fakeUri: [vscode.Uri, ...vscode.Uri[]] = [vscode.Uri.file(fakePath)];
    const { openDialogSpy, updateSpy } = setupDialogAndConfig(
      sb,
      options,
      fakeUri
    );

    await runRegisterCommand();

    expectCalledOnce(openDialogSpy, 'openDialog');
    assertConfigUpdateCalledWithAdditionalPaths(
      updateSpy,
      fakeUri[0].fsPath,
      false
    );
    const qtPath: QtAdditionalPath = {
      name: undefined,
      path: fakePath,
      isVCPKG: false
    };
    expect(() => {
      addQtPathToSettings(qtPath);
    }).to.throw(`Failed to get Qt info for ${qtPath.path}`);
  });

  it('adds selected Qt path to config when QtInfo is found', async () => {
    const fakePath = 'myfakepath';
    const fakeUri: [vscode.Uri, ...vscode.Uri[]] = [vscode.Uri.file(fakePath)];

    const { openDialogSpy, updateSpy } = setupDialogAndConfig(
      sb,
      options,
      fakeUri
    );

    // Taking control of CoreAPIImpl.getQtInfo
    // needed to check the configuration is updated (regardless of the selected path)
    const qtInfo = createFakeQtInfo(fakePath);
    setupGetQtInfoStub(sb, await getCoreAPI(), qtInfo);

    const name = generateDefaultQtPathsName(qtInfo);
    const additionalQtPathToAdd = { name: name, path: fakeUri[0].fsPath };
    const expectedPathsInConfig = [additionalQtPathToAdd];

    // The fake path does not exist and should trigger a warning message
    const showWarningMessageStub = stubWarningMessage(
      sb,
      missingQtWarning(additionalQtPathToAdd.path)
    );

    await runRegisterCommand();

    expectCalledOnce(openDialogSpy, 'openDialog');
    assertConfigUpdateCalledWithAdditionalPaths(
      updateSpy,
      expectedPathsInConfig,
      true
    );
    expectCalledOnce(showWarningMessageStub, 'showWarningMessage');
  });

  it('appends Qt path to existing additional paths in config', async () => {
    // it does not replace it
    const fakePath = 'myfakepath2';
    const fakeUri: [vscode.Uri, ...vscode.Uri[]] = [vscode.Uri.file(fakePath)];
    const { openDialogSpy, updateSpy } = setupDialogAndConfig(
      sb,
      options,
      fakeUri
    );

    // Override the inspect method to pretend there is already a qthpath in config
    const existingPath = { name: 'PreExisting', path: '/existing/path' };
    overrideInspectForQtPaths(AdditionalQtPathsName, existingPath);

    // Taking control of CoreAPIImpl.getQtInfo
    // needed to check the configuration is updated (regardless of the selected path)
    const qtInfo = createFakeQtInfo(fakePath);
    setupGetQtInfoStub(sb, await getCoreAPI(), qtInfo);

    const name = generateDefaultQtPathsName(qtInfo);
    const additionalQtPathToAdd = { name: name, path: fakeUri[0].fsPath };
    const expectedPathsInConfig = [existingPath, additionalQtPathToAdd];

    // The fake path does not exist and should trigger a warning message
    const msg1 = missingQtWarning(existingPath.path);
    const msg2 = missingQtWarning(additionalQtPathToAdd.path);
    const showWarningMessageStub = stubWarningMessage(sb);

    await runRegisterCommand();

    expectCalledOnce(openDialogSpy, 'openDialog');
    assertConfigUpdateCalledWithAdditionalPaths(
      updateSpy,
      expectedPathsInConfig,
      true
    );
    expect(
      showWarningMessageStub.calledTwice,
      'Expected 2 warnings to be shown'
    ).to.be.true;
    expect(showWarningMessageStub.calledWith(msg1)).to.be.true;
    expect(showWarningMessageStub.calledWith(msg2)).to.be.true;
  });

  // To do in specific test file to:
  // check all behaviour in installation-roots.ts onAdditionalQtPathsUpdated
});

describe('command: reset', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runResetCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.reset');
    await waitForVSCodeIdle();
  }

  it('resets the coreApi and the CoreProjectManager', async () => {
    const coreAPIResetStub = sb.spy(await getCoreAPI(), 'reset');

    await runResetCommand();

    expect(
      coreAPIResetStub.calledOnce,
      'Expected coreAPI.reset to be called once'
    ).to.be.true;
  });
  // Does not test coreAPI logic, just that the command calls them
  // TO DO: create a scenario to test stateManager reset logic.

  it('resets all qt extension', async () => {
    const resetSpy = stubExecuteCommandWithSpy(sb, [
      ['qt-cpp.reset'],
      ['qt-qml.reset'],
      ['qt-ui.reset']
    ]);

    await runResetCommand();

    expect(resetSpy.calledThrice).to.be.true;
    expect(resetSpy.calledWith('qt-cpp.reset')).to.be.true;
    expect(resetSpy.calledWith('qt-qml.reset')).to.be.true;
    expect(resetSpy.calledWith('qt-ui.reset')).to.be.true;
  });
});

describe('command: createNewItem', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    () => activateQtCore()
  );
  // -- Helper for the current description------------------------
  // definitions for webview-panel
  const PanelColumn = vscode.ViewColumn.One;
  const PanelViewType = 'ViewTypeWizard';
  // Function to run the command and wait for VS Code to be idle
  async function runCreateNewItem(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.createNewItem');
    await waitForVSCodeIdle();
  }
  async function waitFor<T>(
    cond: () => T,
    timeoutMs = 5000,
    intervalMs = 50
  ): Promise<T> {
    const t0 = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const v = cond();
      if (v) return v;
      if (Date.now() - t0 > timeoutMs)
        throw new Error(`timeout waiting for condition`);
      await delay(intervalMs);
    }
  }

  it('creates a web view panel and a terminal', async () => {
    const createViewPanel = sb
      .spy(vscode.window, 'createWebviewPanel')
      .withArgs(PanelViewType, texts.newItem.tabText, PanelColumn);

    const createTerminalSpy = sb.spy(vscode.window, 'createTerminal');
    // Required fields (normalize for cross-platform consistency)
    const expectedCwd = path.normalize(os.homedir());
    // const qtcliCall = (createTerminalSpy as any).withArgs(
    //   sinon.match.object
    //     .and(sinon.match.has('name', 'qtcli'))
    //     .and(sinon.match.has('cwd', expectedCwd))
    // );

    // matcher that *safely* inspects the arg without typing 'cwd'
    const qtcliCall = createTerminalSpy.withArgs(
      sinon.match((arg: unknown) => {
        const o = arg as any;

        // name must be 'qtcli'
        if (!o || o.name !== 'qtcli') return false;

        // cwd may be string | vscode.Uri | undefined
        let cwd: string | undefined;
        if (typeof o.cwd === 'string') cwd = o.cwd;
        else if (o.cwd && typeof o.cwd === 'object' && 'fsPath' in o.cwd)
          cwd = (o.cwd as vscode.Uri).fsPath;

        // log when missing or mismatched
        if (!cwd) {
          console.log('[test] createTerminal arg has no cwd:', o);
          return false;
        }
        const got = path.normalize(cwd);
        const ok = got === expectedCwd;
        if (!ok) {
          console.log('[test] expected cwd:', expectedCwd);
          console.log('[test] got cwd     :', got);
          console.log('[test] full arg    :', o);
        }
        return ok;
      }, 'TerminalOptions[name=qtcli,cwd=expected]')
    );

    await runCreateNewItem();
    await waitFor(() => createTerminalSpy.called, 5000, 50);

    // If matcher didn't hit, dump all terminal calls once
    if (!qtcliCall.called) {
      const calls = createTerminalSpy.getCalls().map((c) => c.args[0]);
      console.log(
        '[test] createTerminal calls:',
        JSON.stringify(calls, null, 2)
      );
      console.log('[test] os.homedir():', os.homedir());
      console.log('[test] process.env.HOME:', process.env.HOME);
      console.log('[test] path.sep:', path.sep);
    }
    expect(
      qtcliCall.calledOnce,
      'qtcli terminal created once with correct name+cwd'
    ).to.be.true;
    //no extra calls in general
    expect(createTerminalSpy.calledOnce, 'createTerminal called exactly once')
      .to.be.true;
    await runCreateNewItem(); // run twice to check singleton behaviour for the panel
    expect(
      createViewPanel.calledOnce,
      'createWebviewPanel should be called once'
    ).to.be.true;
  });

  // This is not testing the content of the webview, just that it is created
});
// Does not test QtcliExeFinder logic. (unit tests needed)
// Does not test the interaction of the panel with qtcli server. (unit test needed)
// Does not test qtcli server logic. (unit tests needed)
