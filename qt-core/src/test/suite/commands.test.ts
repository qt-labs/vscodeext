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
  generateDefaultQtPathsName
} from 'qt-lib';
import * as path from 'path';
//import isEqual from 'lodash/isEqual';
import { addQtPathToSettings } from '../../qtpaths';
//type NonEmptyArray<T> = [T, ...T[]];
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
  getCoreProjectManager,
  expectUpdateCalledWith,
  stubWarningMessage,
  expectCalledOnce,
  getSearchInputBoxStubWithArg,
  createMockTextEditorWithCurrentWord
} from '../helper';

describe('command: documentation Homepage', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    () => activateQtCore()
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
    () => activateQtCore()
  );
  beforeEach(
    'closing all editor',
    async () =>
      await vscode.commands.executeCommand('workbench.action.closeAllEditors')
  );
  afterEach(
    'closing all editor',
    async () =>
      await vscode.commands.executeCommand('workbench.action.closeAllEditors')
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
    () => activateQtCore()
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
    () => activateQtCore()
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
    () => activateQtCore()
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
    () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runRegisterCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.registerQt');
    await waitForVSCodeIdle();
  }

  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select Qt installation root please',
    canSelectFiles: false,
    canSelectFolders: true
  };
  function assertConfigUpdateCalledWithQtInsRootConfigName(
    spy: sinon.SinonSpy,
    expected: string | Record<string, unknown> | Array<Record<string, unknown>>,
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
    await runRegisterCommand();

    expectCalledOnce(openDialogSpy, 'openDialog');
    expect(
      openDialogSpy.calledWithMatch(
        sinon.match.has('defaultUri', sinon.match.instanceOf(vscode.Uri))
      )
    ).to.be.true;
    // Configuration is not updated
    expect(updateSpy.called, `config.update should be not be called`).to.be
      .false;
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
      fakeUri[0]!.fsPath
    );
  });
});

describe('command: registerQtByQtpaths', () => {
  let sb: sinon.SinonSandbox;
  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    () => activateQtCore()
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
    expected: string | Record<string, unknown> | Array<Record<string, unknown>>,
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
    const config = vscode.workspace.getConfiguration(
      'qt-core'
    ) as vscode.WorkspaceConfiguration;
    config.inspect = <T>(_section: string) => {
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
      fakeUri[0]!.fsPath,
      false
    );
    const qtPath: QtAdditionalPath = {
      name: undefined,
      path: fakePath,
      isVCPKG: false
    };
    expect(() => addQtPathToSettings(qtPath)).to.throw(
      `Failed to get Qt info for ${qtPath.path}`
    );
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
    () => activateQtCore()
  );

  // -- Helper for the current description------------------------
  // Function to run the command and wait for VS Code to be idle
  async function runResetCommand(): Promise<void> {
    await vscode.commands.executeCommand('qt-core.reset');
    await waitForVSCodeIdle();
  }

  it('resets the coreApi and the CoreProjectManager', async () => {
    const coreAPIResetStub = sb.spy(await getCoreAPI(), 'reset');
    const projectManagerResetStub = sb.spy(
      await getCoreProjectManager(),
      'reset'
    );

    await runResetCommand();

    expect(
      coreAPIResetStub.calledOnce,
      'Expected coreAPI.reset to be called once'
    ).to.be.true;
    expect(
      projectManagerResetStub.calledOnce,
      'Expected coreProjectManager.reset to be called once'
    ).to.be.true;
  });
  // Does not test coreAPI nor projectManager logic, just that the command calls them

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

// describe('command: createNewFile', () => {
// let sb: sinon.SinonSandbox;
// setupSandboxLifecycleHooks(
//   (_sb) => (sb = _sb),
//   () => activateQtCore()
// );
//   it('', async () => {
//   });

// });

// describe('command: createNewProject', () => {
// let sb: sinon.SinonSandbox;
// setupSandboxLifecycleHooks(
//   (_sb) => (sb = _sb),
//   () => activateQtCore()
// );
//   it('', async () => {
//   });

// });
