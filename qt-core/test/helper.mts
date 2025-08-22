// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { QtInfo, CoreAPI } from 'qt-lib';
import type { CoreAPIImpl } from '../src/api.ts';
import { isEqual } from 'lodash-es';
type NonEmptyArray<T> = [T, ...T[]];

/**
 * Sets up Mocha lifecycle hooks to manage a Sinon sandbox throughout a test suite.
 *
 * This helper abstracts the standard pattern of initializing a Sinon sandbox in `before` and `beforeEach`,
 * and restoring/verifying it in `afterEach`. It also optionally activates the extension or other asynchronous
 * setup logic once before all tests in the suite.
 *
 * @param assign - A callback that receives the freshly created sandbox and allows assignment to a variable in scope.
 * @param activate - Optional function that performs asynchronous setup (e.g., extension activation) once before all tests.
 *
 * @example
 * let sb: sinon.SinonSandbox;
 *
 * setupSandboxLifecycleHooks(_sb => (sb = _sb), () =>
 *   vscode.extensions.getExtension('theqtcompany.qt-core')?.activate()
 * );
 */
export function setupSandboxLifecycleHooks(
  assign: (sb: sinon.SinonSandbox) => void,
  activate?: () => Thenable<unknown> | void
): void {
  let sb: sinon.SinonSandbox;

  before('create sandbox', () => {
    sb = sinon.createSandbox();
    assign(sb);
  });

  if (activate) {
    before('activate extension', activate);
  }

  beforeEach('reset sandbox', () => {
    sb = sinon.createSandbox();
    assign(sb);
  });

  afterEach('verify and restore sandbox', () => {
    sb.verifyAndRestore();
  });
}

/**
 * Defers execution until the current event loop is idle.
 *
 * This ensures that all pending microtasks (e.g., promise `.then()` callbacks)
 * and VS Code extension state updates have completed before continuing.
 * Useful in tests to wait for VS Code to finish processing internal operations.
 */
export async function waitForVSCodeIdle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Creates a mock implementation of `vscode.TextEditor` for testing purposes.
 *
 * This mock simulates a text editor with a predefined document URI, content, and selection.
 * Useful for unit tests that rely on the active editor or selected text without requiring an actual VS Code window.
 *
 * @param currentWord - The mock text returned by `getText()`, typically representing selected or current word.
 * @param filePath - The file path associated with the mock document. Defaults to `/fakepath/test.txt`.
 * @param selection - The text selection range within the editor. Defaults to a selection from (0,0) to (0,5).
 * @returns A mock `vscode.TextEditor` object with minimal properties needed for typical editor-related tests.
 */
export function createMockTextEditor(
  currentWord: string,
  filePath = '/fakepath/test.txt',
  selection: vscode.Selection = new vscode.Selection(0, 0, 0, 5)
): vscode.TextEditor {
  return {
    document: {
      uri: vscode.Uri.file(filePath),
      getText: () => currentWord,
      fileName: filePath.split('/').pop() ?? 'test.txt'
    },
    selection
  } as unknown as vscode.TextEditor;
}

/**
 * Creates a mock `vscode.WorkspaceConfiguration` object for testing configuration-based behavior.
 *
 * This helper function stubs the `get()` method to return a specific `expectedValue` when queried with a particular key,
 * while preserving real behavior for all other keys. Other methods (`has`, `inspect`, `update`) are delegated to the real
 * configuration object to maintain compatibility with strict typing and runtime expectations.
 *
 * This mock is useful for unit tests that validate extension behavior depending on specific workspace settings.
 *
 * @param configKey - The configuration key to intercept.
 * @param expectedValue - The value to return when the intercepted key is queried using `get()`.
 * @returns A mock implementation of `vscode.WorkspaceConfiguration`, safe for use with strict settings.
 */
export function getMockConfiguration(
  configKey: string,
  expectedValue: boolean
): vscode.WorkspaceConfiguration {
  const realConfig = vscode.workspace.getConfiguration();

  const getStub = sinon.stub();
  getStub.callsFake((...args: [string, any?]) => {
    if (args[0] === configKey) {
      return expectedValue;
    }
    return realConfig.get(...args);
  });

  return {
    get: getStub,
    has: (...args) => realConfig.has(...args),
    inspect: (...args) => realConfig.inspect(...args),
    update: (...args) => realConfig.update(...args)
  };
}

/**
 * Creates a Sinon stub for the global `fetch` function, returning a mock JSON response.
 *
 * This helper is useful for testing code that performs HTTP requests using `fetch`, allowing you to simulate
 * controlled responses without making real network calls. The stubbed response will behave like a real `Response`
 * object with `.ok`, `.json()`, and status code handling.
 *
 * @param sandbox - The active Sinon sandbox used to manage the stub.
 * @param responseBody - The JSON-serializable object to return as the response body.
 * @param status - The HTTP status code to simulate (defaults to 200). Set to a non-2xx value to simulate errors.
 * @returns A Sinon stub replacing `globalThis.fetch`, configured to return the mocked response.
 */
export function createFetchStub(
  sandbox: sinon.SinonSandbox,
  responseBody: any,
  status = 200
): sinon.SinonStub {
  return sandbox.stub(globalThis, 'fetch').resolves(
    new Response(JSON.stringify(responseBody), {
      status, // Any non-2xx status makes response.ok === false
      headers: { 'Content-Type': 'application/json' }
    })
  );
}

/**
 * Modifies an existing Sinon `fetch` stub to return a specific mocked JSON response
 * when called with a given URL or argument.
 *
 * This helper allows you to define different responses based on the request input,
 * enabling fine-grained control of mocked `fetch` behavior in your tests.
 *
 * @param fetchStub - The existing Sinon stub of `globalThis.fetch` to modify.
 * @param linkArg - The URL or fetch input argument to match. Only calls with this value will return the provided response.
 * @param responseBody - The JSON-serializable object to return as the mocked response body.
 * @param status - The HTTP status code to simulate (defaults to 200). Use a non-2xx status to simulate errors.
 * @returns The modified fetch stub, now returning the specified response for the given argument.
 */
export function modifyFetchStub(
  fetchStub: sinon.SinonStub,
  linkArg: string,
  responseBody: any,
  status = 200
): sinon.SinonStub {
  fetchStub.withArgs(linkArg).resolves(
    new Response(JSON.stringify(responseBody), {
      status, // Any non-2xx status makes response.ok === false
      headers: { 'Content-Type': 'application/json' }
    })
  );
  return fetchStub;
}

export type CommandArgs = [string, ...unknown[]];
export type CommandInput = CommandArgs | CommandArgs[];
/**
 * Stubs `vscode.commands.executeCommand` to intercept specific command invocations
 * and records them with a Sinon spy. All other commands fall through to the original implementation.
 *
 * This utility is useful for verifying that certain VS Code commands were triggered with
 * expected arguments—especially in scenarios where multiple commands might be invoked.
 *
 * @param sb - The active Sinon sandbox used to apply the stub.
 * @param input - A single command-args tuple (e.g., ['my.command', arg1, arg2]) or an array of such tuples.
 *                These define which commands and argument combinations the spy should intercept.
 * @returns A Sinon spy that records all matching command calls. You can use it to assert call count, arguments, etc.
 *
 * @example
 * const spy = stubExecuteCommandWithSpy(sb, ['my.command', expectedArg]);
 * await someExtensionFunction();
 * expect(spy.calledOnce).to.be.true;
 */
export function stubExecuteCommandWithSpy(
  sb: sinon.SinonSandbox,
  input: CommandInput
): sinon.SinonSpy {
  const realExecuteCommand = vscode.commands.executeCommand.bind(
    vscode.commands
  );
  const commandList = Array.isArray(input[0])
    ? (input as CommandArgs[])
    : [input as CommandArgs];
  const spy = sinon.spy();

  sb.stub(vscode.commands, 'executeCommand').callsFake(
    (cmd: string, ...args: unknown[]) => {
      for (const [expectedCommand, ...expectedArgs] of commandList) {
        if (
          cmd === expectedCommand &&
          expectedArgs.every((expected, i) => isEqual(expected, args[i]))
        ) {
          spy(cmd, ...args);
          return Promise.resolve();
        }
      }
      return realExecuteCommand(cmd, ...args);
    }
  );

  return spy;
}

/**
 * Stubs `vscode.workspace.getConfiguration` to return a fake configuration object
 * for specific sections, and captures all `update(...)` calls with a Sinon spy.
 *
 * This is useful for testing commands or features that modify configuration settings
 * via `update()`, without affecting real workspace settings. The returned stub mimics
 * the shape of a `WorkspaceConfiguration` object with no-op `get`, `has`, and `inspect`,
 * and a spy-wrapped `update` method for verification.
 *
 * @param sb - The Sinon sandbox used to apply the stub.
 * @param stubbedSections - A list of section names for which the stub should return the fake configuration.
 *                           Other sections will fall back to the real implementation.
 * @returns A Sinon spy that records all calls to `update(...)`, including arguments.
 *
 * @example
 * const updateSpy = stubGetConfigurationWithUpdateSpy(sb, ['qt']);
 * await runSomeCommandThatUpdatesSettings();
 * expect(updateSpy.calledOnce).to.be.true;
 * expect(updateSpy.firstCall.args[0]).to.equal('qt.someSetting');
 */
export function stubGetConfigurationWithUpdateSpy(
  sb: sinon.SinonSandbox,
  stubbedSections: string[]
): sinon.SinonSpy {
  const realGetConfig = vscode.workspace.getConfiguration.bind(
    vscode.workspace
  );
  const updateSpy = sinon.spy();

  const configStub: vscode.WorkspaceConfiguration = {
    get: <T extends unknown>(
      _section: string,
      defaultValue?: T
    ): T | undefined => {
      return defaultValue;
    },
    has: (_section: string): boolean => false,
    inspect: <T extends unknown>(
      _section: string
    ):
      | {
          key: string;
          defaultValue?: T;
          globalValue?: T;
          workspaceValue?: T;
          workspaceFolderValue?: T;
          defaultLanguageValue?: T;
          globalLanguageValue?: T;
          workspaceLanguageValue?: T;
          workspaceFolderLanguageValue?: T;
          languageIds?: string[];
        }
      | undefined => {
      return undefined;
    },
    update: (async (...args: unknown[]) => {
      const clonedArgs = structuredClone(args);
      updateSpy(...clonedArgs);
      return Promise.resolve();
    }) as vscode.WorkspaceConfiguration['update']
  };

  sb.stub(vscode.workspace, 'getConfiguration').callsFake(
    (
      section?: string,
      scope?: vscode.ConfigurationScope | null
    ): vscode.WorkspaceConfiguration => {
      if (section && stubbedSections.includes(section)) {
        return configStub;
      }
      return realGetConfig(section, scope);
    }
  );

  return updateSpy;
}

export function stripDefaultUri<T extends vscode.OpenDialogOptions>(
  opts: T
): Omit<T, 'defaultUri'> {
  const { defaultUri, ...rest } = opts;
  return rest;
}
/**
 * Stubs `vscode.window.showOpenDialog` to return a predefined set of URIs
 * when called with matching options, and records matching calls using a Sinon spy.
 *
 * This is useful for testing flows that involve file or folder selection dialogs
 * without requiring real user interaction. When the dialog is invoked with the specified
 * `matchingOptions`, the provided `urisToReturn` will be returned. All other calls will
 * fall back to the real implementation.
 *
 * The function uses a normalized comparison that excludes the `defaultUri` property,
 * allowing consistent matching when testing regardless of absolute paths.
 *
 * @param sb - The Sinon sandbox to apply the stub within.
 * @param matchingOptions - The `OpenDialogOptions` to match against during testing.
 * @param urisToReturn - The URIs to return if the options match (simulating user selection),
 *                       or `undefined` to simulate cancellation.
 * @returns A Sinon spy that records all matching calls to `showOpenDialog`.
 *
 * @example
 * const spy = stubShowOpenDialogWithSpy(sb, { canSelectFiles: true }, [vscode.Uri.file('/mock/path')]);
 * await vscode.commands.executeCommand('qt-core.registerQt');
 * expect(spy.calledOnce).to.be.true;
 */
export function stubShowOpenDialogWithSpy(
  sb: sinon.SinonSandbox,
  matchingOptions: vscode.OpenDialogOptions,
  urisToReturn: NonEmptyArray<vscode.Uri> | undefined // Only user interaction possibilities
): sinon.SinonSpy {
  const realShowOpenDialog = vscode.window.showOpenDialog.bind(vscode.window);
  const spy = sinon.spy();

  sb.stub(vscode.window, 'showOpenDialog').callsFake(
    async (
      options?: vscode.OpenDialogOptions
    ): Promise<vscode.Uri[] | undefined> => {
      if (
        options &&
        isEqual(stripDefaultUri(options), stripDefaultUri(matchingOptions))
      ) {
        spy(options);
        return urisToReturn;
      }
      return realShowOpenDialog(options);
    }
  );
  return spy;
}

/**
 * Creates a mock `vscode.TextEditor` instance with the specified word as its content
 * and stubs `vscode.window.activeTextEditor` to return it.
 *
 * This is useful for simulating an active editor state during tests—particularly
 * when commands rely on retrieving the current word or file context via the
 * active text editor.
 *
 * The mock text editor is created using `createMockTextEditor(currentWord)`,
 * and the stub is automatically registered in the provided Sinon sandbox.
 *
 * @param sb - The Sinon sandbox to manage the stub lifecycle.
 * @param currentWord - The string to be returned when the mock editor's
 *                      document `getText()` method is called.
 *
 * @example
 * createMockTextEditorWithCurrentWord(sb, 'MyClass');
 * await vscode.commands.executeCommand('qt-core.searchDocs');
 */
export function createMockTextEditorWithCurrentWord(
  sb: sinon.SinonSandbox,
  currentWord: string
): void {
  const mockTextEditor = createMockTextEditor(currentWord);
  sb.stub(vscode.window, 'activeTextEditor').value(mockTextEditor);
}

/**
 * Stubs `vscode.window.showInputBox` to simulate user input for a specific set of prompt options.
 *
 * This is useful in tests where you want to control or assert the behavior of commands
 * that prompt the user to enter a search term or similar input.
 *
 * The stub only intercepts `showInputBox` calls with matching `value`, `placeHolder`, and `prompt`.
 * When matched, it resolves to the specified `resolves` value (defaults to `currentWord`).
 *
 * @param sb - The Sinon sandbox used to manage the stub's lifecycle.
 * @param currentWord - The pre-filled value expected in the input box (`value` field).
 * @param resolves - The value to resolve when the input box is shown (simulated user input).
 * @param placeHolder - The placeholder text shown in the input box.
 * @param prompt - The prompt text shown above the input field.
 * @returns A Sinon stub for `vscode.window.showInputBox`, scoped to the matching arguments.
 *
 * @example
 * const inputStub = getSearchInputBoxStubWithArg(sb, 'QPushButton');
 * await vscode.commands.executeCommand('qt-core.searchDocs');
 * expect(inputStub.calledOnce).to.be.true;
 */
export function getSearchInputBoxStubWithArg(
  sb: sinon.SinonSandbox,
  currentWord: string,
  resolves: string = currentWord,
  placeHolder = 'Search for...',
  prompt = 'Enter a term to search for in the Qt Documentation'
): sinon.SinonStub {
  return sb
    .stub(vscode.window, 'showInputBox')
    .withArgs({
      value: currentWord,
      placeHolder: placeHolder,
      prompt: prompt
    })
    .resolves(resolves);
}

/**
 * Integration-style test helper that verifies a Qt documentation search command
 * opens the expected documentation page using the Simple Browser.
 *
 * This function simulates the following behaviors:
 *  - Optionally prompts the user for a Qt symbol using `showInputBox`
 *  - Simulates an active text editor with a known current word
 *  - Stubs the configuration to avoid external browser usage
 *  - Stubs the `fetch` global to prevent real HTTP requests
 *  - Verifies that the correct Qt documentation page is opened via the Simple Browser
 *
 * @param commandName - The name of the VS Code command to execute (e.g. `qt-core.searchDocs`)
 * @param sb - The Sinon sandbox used to isolate and clean up stubs and spies
 * @param inputBox - Whether the command is expected to show an input box (true = prompt for input)
 *
 * @example
 * await testSearchCommandOpensExpectedQtDocPage('qt-core.searchDocs', sb, true);
 */
export async function testSearchCommandOpensExpectedQtDocPage(
  commandName: string,
  sb: sinon.SinonSandbox,
  inputBox: boolean
) {
  const currentWord = 'QApplication';
  const showInputBox = getSearchInputBoxStubWithArg(sb, currentWord);
  // Mocking an editor with document returning the chosen currentWord
  const mockTextEditor = createMockTextEditor(currentWord);
  sb.stub(vscode.window, 'activeTextEditor').value(mockTextEditor);

  // Expecting a simple browser to open using the following link
  const link = `https://doc.qt.io/qt-6/${currentWord.toLowerCase()}.html`;
  const getConfigurationStub = sb.stub(vscode.workspace, 'getConfiguration');
  const configKey = 'openOnlineDocumentationInExternalBrowser';
  getConfigurationStub.returns(getMockConfiguration(configKey, false));
  const commandArgs = [
    'simpleBrowser.api.open',
    link,
    {
      viewColumn: vscode.ViewColumn.Beside
    }
  ] as [string, ...unknown[]];
  const openSimpleBrowser = stubExecuteCommandWithSpy(sb, commandArgs);

  //-- Mocha does not wait for global fetch. Need to stub it to test what happens after
  createFetchStub(sb, { data: 'This is mock data' }, 200);

  await vscode.commands.executeCommand(commandName);
  await waitForVSCodeIdle();

  // Input box opens with the expected text
  expect(
    showInputBox.calledOnce,
    `${showInputBox} should be called ${!!inputBox}`
  ).to.equal(!!inputBox);
  // open a simple browser corresponding to the currentWord Qt documentation page
  expectCalledOnce(openSimpleBrowser, 'openSimpleBrowser');
}

/**
 * Sets up test stubs for a VS Code open file dialog and configuration update.
 *
 * This helper is useful in command tests that involve:
 *  - Prompting the user to select a file or folder via `showOpenDialog`
 *  - Modifying a workspace configuration (e.g., storing Qt installation path)
 *
 * It returns spies that can be used in assertions to verify:
 *  - Whether the open dialog was shown with the expected options
 *  - Whether the configuration was updated as expected
 *
 * @param sb - The Sinon sandbox used to stub and spy on VS Code APIs
 * @param options - The `OpenDialogOptions` that must match the dialog call in the tested code
 * @param dialogResult - The simulated user response: a non-empty array of URIs or `undefined`
 *
 * @returns An object containing:
 *  - `openDialogSpy`: a Sinon spy to verify dialog invocation
 *  - `updateSpy`: a Sinon spy to verify calls to `WorkspaceConfiguration.update`
 *
 * @example
 * const { openDialogSpy, updateSpy } = setupDialogAndConfig(sb, dialogOpts, [vscode.Uri.file('/qt/path')]);
 * await vscode.commands.executeCommand('qt-core.registerQtByPath');
 * expect(openDialogSpy.calledOnce).to.be.true;
 * expect(updateSpy.calledWith(...)).to.be.true;
 */
export function setupDialogAndConfig(
  sb: sinon.SinonSandbox,
  options: vscode.OpenDialogOptions,
  dialogResult: [vscode.Uri, ...vscode.Uri[]] | undefined
): {
  openDialogSpy: sinon.SinonSpy;
  updateSpy: sinon.SinonSpy;
} {
  const openDialogSpy = stubShowOpenDialogWithSpy(sb, options, dialogResult);
  const updateSpy = stubGetConfigurationWithUpdateSpy(sb, ['qt-core']);
  return { openDialogSpy, updateSpy };
}

/**
 * Ensures the `qt-core` extension is activated before continuing.
 *
 * This helper is intended for use in tests to make sure the extension under test
 * (`theqtcompany.qt-core`) is properly activated before any commands or APIs are used.
 *
 * If the extension is already active, it returns immediately.
 * If it’s not active yet, this function calls `.activate()` and awaits completion.
 *
 * @throws Error if the `qt-core` extension cannot be found.
 *
 * @example
 * before(async () => {
 *   await activateQtCore();
 * });
 */
export async function activateQtCore(): Promise<void> {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-core');
  if (!ext) {
    throw new Error('qt-core extension not found');
  }
  if (!ext.isActive) {
    await ext.activate();
  }
}

/**
 * Creates a fake `QtInfo` object for use in tests.
 *
 * This helper simulates a Qt installation by constructing a `QtInfo` instance
 * with mock metadata. It allows tests to validate behavior when a valid Qt path
 * and its associated information are available, without depending on a real Qt installation.
 *
 * The returned `QtInfo` object includes the following mocked metadata:
 * - `QT_VERSION`: set to `'fakeVERSION'`
 * - `QMAKE_XSPEC`: set to `'fakeXSPEC'`
 *
 * @param qtPath - A string representing the fake installation path to use.
 * @returns A `QtInfo` object populated with mock metadata.
 *
 * @example
 * const qtInfo = createFakeQtInfo('/fake/Qt/6.6.0');
 * expect(qtInfo.get('QT_VERSION')).to.equal('fakeVERSION');
 */
export function createFakeQtInfo(qtPath: string): QtInfo {
  const qtInfo = new QtInfo(qtPath, 'Mock Qt Name');
  qtInfo.set('QT_VERSION', 'fakeVERSION');
  qtInfo.set('QMAKE_XSPEC', 'fakeXSPEC');
  return qtInfo;
}

/**
 * Stubs the `getQtInfo` method on the given `coreAPI` instance to return a mock `QtInfo` object.
 *
 * This helper is used in tests to simulate a scenario where `coreAPI.getQtInfo(...)`
 * returns a predefined Qt installation metadata object, without requiring real file system
 * inspection or external dependencies.
 *
 * The stubbed method will return the provided `qtInfo` whenever called, allowing tests to
 * focus on downstream behavior without relying on actual Qt installation detection logic.
 *
 * @param sb - The Sinon sandbox used to manage and restore the stub.
 * @param coreAPI - The `CoreAPI` instance on which `getQtInfo` will be stubbed.
 * @param qtInfo - The fake `QtInfo` object to return from the stubbed method.
 * @returns A Sinon stub for `coreAPI.getQtInfo`.
 *
 * @example
 * const qtInfo = createFakeQtInfo('/path/to/qt');
 * const stub = setupGetQtInfoStub(sb, coreAPI, qtInfo);
 * expect(coreAPI.getQtInfo(...)).to.equal(qtInfo);
 */
export function setupGetQtInfoStub(
  sb: sinon.SinonSandbox,
  coreAPI: CoreAPI,
  qtInfo: QtInfo
): sinon.SinonStub {
  return sb.stub(coreAPI, 'getQtInfo').returns(qtInfo);
}

// Cache the in-flight or resolved CoreAPIImpl so repeated calls are fast
let coreAPIPromise: Promise<CoreAPIImpl> | undefined;

/**
 * Returns the CoreAPIImpl exported by the 'theqtcompany.qt-core' extension.
 *
 * - Activates qt-core if needed, otherwise returns its current exports.
 * - Uses a cached promise for speed within a single test/run.
 */
export async function getCoreAPI(): Promise<CoreAPIImpl> {
  if (coreAPIPromise) {
    return coreAPIPromise;
  }

  const ext = vscode.extensions.getExtension<CoreAPIImpl>(
    'theqtcompany.qt-core'
  );
  if (!ext) {
    throw new Error('qt-core extension not found');
  }

  // Normalize both branches to a Promise and cache it
  coreAPIPromise = ext.isActive
    ? Promise.resolve(ext.exports)
    : Promise.resolve(ext.activate()); // Thenable -> Promise

  return coreAPIPromise;
}

/**
 * Clears the cached CoreAPIImpl promise.
 *
 * Use this in tests only when:
 * 1) stubbing `vscode.extensions.getExtension().activate` to return a fake CoreAPIImpl,
 * 2) observing state leaking across tests (e.g., duplicate listeners, carried config),
 * 3) intentionally wanting to re-test activation in the same run.
 */
export function resetQtCoreAPICache(): void {
  coreAPIPromise = undefined;
}

/**
 * Asserts that a configuration `update` spy was called with the expected key, value, and target.
 *
 * This helper is designed to verify that `vscode.WorkspaceConfiguration.update(...)`
 * was invoked with the correct arguments during tests.
 *
 * It supports both shallow (by `.calledWith(...)`) and optional deep equality verification
 * of the update value using Chai's `deep.equal(...)`.
 *
 * If the value is a string, standard `.calledWith(...)` is used for strict match.
 * If the value is an object or array of objects, Sinon’s `match(...)` is used to ensure a compatible shape.
 *
 * If `shouldMatch` is `false`, the test will fail if a matching call was made (used to assert non-calls).
 *
 * @param spy - The Sinon spy that wraps the `update` function.
 * @param key - The configuration key expected to be updated.
 * @param expectedValue - The value that should (or should not) be passed to `update`.
 * @param target - The expected configuration target (Global, Workspace, etc.). Default is `undefined`.
 * @param shouldMatch - Whether the update call is expected to match (default: `true`).
 * @param verifyDeepEquality - Whether to perform a deep equality check on the update value (default: `true`).
 *
 * @example
 * expectUpdateCalledWith(updateSpy, 'qtInstallationPath', '/path/to/qt', vscode.ConfigurationTarget.Global);
 *
 * @example
 * expectUpdateCalledWith(updateSpy, 'qtSettings', { enabled: true }, undefined, true, true);
 */
export function expectUpdateCalledWith(
  spy: sinon.SinonSpy,
  key: string,
  expectedValue: string | Record<string, unknown> | Record<string, unknown>[],
  target: vscode.ConfigurationTarget | undefined = undefined,
  shouldMatch = true,
  verifyDeepEquality = true
): void {
  const didCallWith =
    typeof expectedValue === 'string'
      ? spy.calledWith(key, expectedValue, target)
      : spy.calledWith(key, sinon.match(expectedValue), target);

  expect(
    didCallWith,
    `Expected update call with key='${key}', value=${JSON.stringify(
      expectedValue
    )}, target=${target} to match: ${shouldMatch}`
  ).to.equal(shouldMatch);

  if (shouldMatch && verifyDeepEquality) {
    expect(
      spy.firstCall.args[1],
      'Deep equality check on second argument of update call failed'
    ).to.deep.equal(expectedValue);
  }
}

/**
 * Stubs `vscode.window.showWarningMessage` to prevent actual warning popups during tests.
 *
 * This helper returns a Sinon stub that intercepts calls to `showWarningMessage`,
 * allowing you to verify whether a specific warning message was triggered,
 * or simply suppress all warning messages for isolation in test environments.
 *
 * If a `message` is provided, the stub will only match calls with that specific message
 * using `.withArgs(message)`. Otherwise, it stubs all calls to `showWarningMessage`.
 *
 * @param sb - The Sinon sandbox used to create and manage the stub.
 * @param message - (Optional) A specific warning message to match.
 *
 * @returns A Sinon stub for `vscode.window.showWarningMessage`, which can be
 *          inspected using assertions like `calledOnce`, `calledWith`, etc.
 *
 * @example
 * // Stub all warning messages
 * const stub = stubWarningMessage(sb);
 *
 * // Stub only when a specific message is shown
 * const stub = stubWarningMessage(sb, 'Unsupported Qt version');
 *
 * expect(stub.calledOnce).to.be.true;
 */
export function stubWarningMessage(
  sb: sinon.SinonSandbox,
  message?: string
): sinon.SinonStub {
  let stub: sinon.SinonStub;
  if (message) {
    stub = sb.stub(vscode.window, 'showWarningMessage').withArgs(message);
  } else {
    stub = sb.stub(vscode.window, 'showWarningMessage');
  }
  return stub;
}

/**
 * Asserts that a given Sinon spy was called exactly once during the test.
 *
 * This utility simplifies and standardizes one-time call assertions
 * by providing a custom label to make test failures easier to debug.
 *
 * @param spy - The Sinon spy to verify.
 * @param label - A descriptive label used in the assertion message.
 *
 * @throws AssertionError if the spy was not called exactly once.
 *
 * @example
 * const spy = sinon.spy();
 * someFunction(spy);
 * expectCalledOnce(spy, 'someFunction callback');
 */
export function expectCalledOnce(spy: sinon.SinonSpy, label: string): void {
  expect(spy.calledOnce, `${label} should be called once`).to.be.true;
}
