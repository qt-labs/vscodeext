// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  CONF_GET_STARTED_DONE,
  EXTENSION_ID,
  STATE_WALKTHROUGH_FIRST_APP_DONE
} from '@/constants';
import { isAnyVersionInstalledOnDisk } from '@/installed-packages-store';
import { isLatestFrameworkInstalled } from '@/latest-framework';
import { getLoggedIn, getRequiredExtensionsContext } from './extension';
import { createLogger, BaseStateManager, CoreKey } from 'qt-lib';

const logger = createLogger('walkthrough-panel');

/** Themed Qt tab icon for the walkthrough panel, matching the Qt Welcome page. */
function createWebviewPanelIcons(context: vscode.ExtensionContext) {
  const sub = 'res/icons/';
  return {
    dark: vscode.Uri.joinPath(context.extensionUri, sub, 'qt-webview-dark.svg'),
    light: vscode.Uri.joinPath(
      context.extensionUri,
      sub,
      'qt-webview-light.svg'
    )
  };
}

/**
 * Persisted walkthrough state. Only the "Build your first Qt application" step
 * needs persisting — the other steps are derived from live signals (login,
 * installed extensions/framework).
 */
class WalkthroughStateManager extends BaseStateManager {
  constructor(context: vscode.ExtensionContext) {
    super(context, CoreKey.GLOBAL_WORKSPACE);
  }

  get firstAppDone(): boolean {
    return this._get<boolean>(STATE_WALKTHROUGH_FIRST_APP_DONE, false);
  }

  set firstAppDone(value: boolean) {
    void this._update(STATE_WALKTHROUGH_FIRST_APP_DONE, value);
  }
}

/**
 * Read the global "get started done" flag. Stored as a VS Code setting (not
 * extension globalState) so that other extensions, e.g. qt-core, can read it
 * via workspace.getConfiguration('qt-sm').get('getStartedDone').
 */
export function isGetStartedDone(): boolean {
  return vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .get<boolean>(CONF_GET_STARTED_DONE, false);
}

function setGetStartedDone(value: boolean): Thenable<void> {
  return vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .update(CONF_GET_STARTED_DONE, value, vscode.ConfigurationTarget.Global);
}

let walkthroughState: WalkthroughStateManager | undefined;

function getWalkthroughState(
  context: vscode.ExtensionContext
): WalkthroughStateManager {
  walkthroughState ??= new WalkthroughStateManager(context);
  return walkthroughState;
}

interface WalkthroughAction {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  /** Push the button to the right edge of the step's action row. */
  trailing?: boolean;
  command?: string;
  commandArgs?: unknown;
}

interface WalkthroughStepData {
  id: string;
  title: string;
  description: string;
  status: 'locked' | 'active' | 'completed';
  actions?: WalkthroughAction[];
}

interface WalkthroughConfig {
  title: string;
  description: string;
  steps: WalkthroughStepData[];
  successTitle?: string;
  successMessage?: string;
  getStartedDone: boolean;
}

interface MessageToWebview {
  type: 'init' | 'stepCompleted' | 'stepReset';
  payload?: WalkthroughConfig;
  stepId?: string;
}

interface MessageToExtension {
  type: 'action' | 'review' | 'resetAll' | 'markDone';
  stepId?: string;
  command?: string;
  commandArgs?: unknown;
}

interface StepCompletion {
  signin: boolean;
  extensions: boolean;
  framework: boolean;
  firstApp: boolean;
}

/**
 * Compute step statuses based on what's already done.
 * Rules: completed steps stay completed, the first incomplete step is active,
 * everything after is locked.
 */
function computeStatus(
  done: boolean,
  prevAllDone: boolean
): 'completed' | 'active' | 'locked' {
  if (done) {
    return 'completed';
  }
  if (prevAllDone) {
    return 'active';
  }
  return 'locked';
}

function getDefaultConfig(
  completion: StepCompletion,
  getStartedDone: boolean
): WalkthroughConfig {
  const s = completion;
  return {
    title: 'Install Qt',
    description:
      'Take your first steps in setting up a Qt project. Complete each step in order to unlock the next.',
    successTitle: "You're all set!",
    successMessage:
      'Qt is installed and your first project is ready. Open the Qt extension to keep building.',
    getStartedDone,
    steps: [
      {
        id: 'signin',
        title: 'Sign in to Qt Account',
        description:
          'Sign in to your Qt Account to get started. This is what lets you download and install Qt.',
        status: computeStatus(s.signin, true),
        actions: [
          {
            label: 'Sign In',
            primary: true,
            disabled: s.signin,
            command: `${EXTENSION_ID}.login`
          },
          {
            label: 'Reset password',
            trailing: true,
            command: `${EXTENSION_ID}.resetPassword`
          }
        ]
      },
      {
        id: 'extensions',
        title: 'Install required extensions',
        description:
          'Add the Qt C++ Extension Pack — it brings all the tools you need to work with Qt right into VS Code.',
        status: computeStatus(s.extensions, s.signin),
        actions: [
          {
            label: 'Install Qt C++ Extension Pack',
            primary: true,
            disabled: s.extensions,
            command: `${EXTENSION_ID}.installRequiredExtensions`
          }
        ]
      },
      {
        id: 'framework',
        title: 'Install the Qt Framework',
        description:
          'This is the heart of Qt — you need it to build and run any app. Get the latest version, or pick a specific one if your project needs it.',
        status: computeStatus(s.framework, s.signin && s.extensions),
        actions: [
          {
            label: 'Get latest Qt Framework',
            primary: true,
            // Disabled only when the newest available version is already
            // installed — not merely when *some* (older) version is present, so
            // users with an outdated Qt can still grab the latest. Defaults to
            // enabled until the async check resolves (see latestFrameworkInstalled).
            disabled: latestFrameworkInstalled,
            command: `${EXTENSION_ID}.installPackage`,
            commandArgs: { version: 'latest', product: 'qtframework' }
          },
          {
            label: 'Select version...',
            primary: false,
            command: `${EXTENSION_ID}.installPackage`
          }
        ]
      },
      {
        id: 'first-app',
        title: 'Build your first Qt application',
        description:
          'Start from a blank project, or open a ready-made example to explore.',
        status: computeStatus(
          s.firstApp,
          s.signin && s.extensions && s.framework
        ),
        actions: [
          {
            label: 'Try out an example',
            primary: true,
            command: 'qt-core.openExamplesBrowser'
          },
          {
            label: 'Create a new project',
            primary: false,
            command: 'qt-core.createNewItem'
          }
        ]
      }
    ]
  };
}

let currentPanel: vscode.WebviewPanel | undefined;
// Stored so refreshWalkthrough() can recompute persisted state without the
// caller having to thread the context through every live-signal event.
let panelContext: vscode.ExtensionContext | undefined;
// Whether the newest available Qt Framework is installed, gating the "Get
// latest Qt Framework" button. Determining "latest" needs a network call, so
// it's resolved asynchronously (refreshLatestFrameworkState) and cached here.
// Defaults to false → the button stays enabled until we positively learn the
// latest is installed, which is the safe direction (never wrongly disabled).
let latestFrameworkInstalled = false;

/**
 * Compute current completion state by checking live signals.
 */
export function getStepCompletion(
  context: vscode.ExtensionContext,
  isLoggedIn: boolean,
  areExtensionsInstalled: boolean
): StepCompletion {
  return {
    signin: isLoggedIn,
    extensions: areExtensionsInstalled,
    framework: isAnyVersionInstalledOnDisk(),
    firstApp: getWalkthroughState(context).firstAppDone
  };
}

/**
 * Compute completion purely from live signals + persisted state, without the
 * caller having to thread login/extension status through. Used when restoring
 * the panel (serializer) and when resetting.
 */
function computeLiveCompletion(
  context: vscode.ExtensionContext
): StepCompletion {
  return {
    signin: getLoggedIn(),
    extensions: getRequiredExtensionsContext(),
    framework: isAnyVersionInstalledOnDisk(),
    firstApp: getWalkthroughState(context).firstAppDone
  };
}

/** True when every walkthrough step is complete. */
function allStepsComplete(c: StepCompletion): boolean {
  return c.signin && c.extensions && c.framework && c.firstApp;
}

/**
 * Post the full walkthrough config to the live panel, keeping the persisted
 * `getStartedDone` flag in sync. Completing the walkthrough naturally (all
 * steps done) marks it done; `explicitDone` overrides for the Mark-as-done
 * button and reset. The flag is only ever cleared explicitly, never by a step
 * regressing (e.g. the user signing out). No-op if no panel is open.
 */
function postConfig(completion: StepCompletion, explicitDone?: boolean): void {
  if (!currentPanel) {
    return;
  }
  const done =
    explicitDone ?? (isGetStartedDone() || allStepsComplete(completion));
  if (done !== isGetStartedDone()) {
    void setGetStartedDone(done);
  }
  const msg: MessageToWebview = {
    type: 'init',
    payload: getDefaultConfig(completion, done)
  };
  void currentPanel.webview.postMessage(msg);
}

/**
 * Wire up a walkthrough panel: render its HTML, post the initial config, and
 * register its message handler. Works for both freshly created panels and
 * panels handed back by the serializer on window reload.
 */
function wirePanel(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  completion: StepCompletion
): void {
  currentPanel = panel;
  panelContext = context;

  // Serialized panels are restored with their old tab title after a window
  // reload; normalize it so renames take effect there too.
  panel.title = 'Install Qt';
  // Give the tab the themed Qt icon, matching the Qt Welcome page.
  panel.iconPath = createWebviewPanelIcons(context);

  panel.webview.options = {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist')
    ]
  };

  panel.webview.html = getWebviewHtml(panel.webview, context);

  // Send config after a short delay to ensure the Svelte app has mounted
  // and its message listener is registered (same pattern as license-panel).
  setTimeout(() => {
    postConfig(completion);
  }, 100);

  // Resolve (async) whether the newest framework is already installed so the
  // "Get latest" button reflects it; re-renders only if the cached value changes.
  void refreshLatestFrameworkState();

  panel.webview.onDidReceiveMessage(
    (msg: MessageToExtension) => {
      switch (msg.type) {
        case 'action': {
          if (msg.command) {
            const args = msg.commandArgs !== undefined ? [msg.commandArgs] : [];
            void vscode.commands
              .executeCommand(msg.command, ...args)
              .then(undefined, (err: unknown) => {
                const text = err instanceof Error ? err.message : String(err);
                void vscode.window.showErrorMessage(`Command failed: ${text}`);
              });
            if (msg.stepId === 'first-app') {
              getWalkthroughState(context).firstAppDone = true;
              notifyStepCompleted('first-app');
              // first-app is the last step, so completing it finishes the
              // walkthrough naturally — persist the global flag.
              if (allStepsComplete(computeLiveCompletion(context))) {
                void setGetStartedDone(true);
              }
            }
          }
          break;
        }
        case 'review': {
          break;
        }
        case 'markDone': {
          logger.info('Walkthrough marked done by webview');
          void setGetStartedDone(true);
          // Close the walkthrough once the user explicitly marks it done.
          panel.dispose();
          break;
        }
        case 'resetAll': {
          // Re-send init with fresh (all-false) completion so the
          // walkthrough restarts from step 1, and clear the done flag.
          logger.info('Walkthrough reset requested by webview');
          getWalkthroughState(context).firstAppDone = false;
          postConfig(
            {
              signin: getLoggedIn(),
              extensions: getRequiredExtensionsContext(),
              framework: isAnyVersionInstalledOnDisk(),
              firstApp: false
            },
            false
          );
          break;
        }
      }
    },
    undefined,
    []
  );

  panel.onDidDispose(() => {
    currentPanel = undefined;
  });
}

export function showWalkthroughPanel(
  context: vscode.ExtensionContext,
  completion: StepCompletion
): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Active);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    `${EXTENSION_ID}.walkthrough`,
    'Install Qt',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist')
      ]
    }
  );

  wirePanel(context, panel, completion);
}

/**
 * Restore the walkthrough panel after a window reload. VS Code only re-creates
 * webview panels whose viewType has a registered serializer; without this the
 * tab silently disappears on reload. Register this during activation.
 */
export function registerWalkthroughSerializer(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.window.registerWebviewPanelSerializer(
    `${EXTENSION_ID}.walkthrough`,
    {
      // eslint-disable-next-line @typescript-eslint/require-await
      deserializeWebviewPanel: async (panel: vscode.WebviewPanel) => {
        if (currentPanel) {
          // Already have a live panel; drop the restored one to avoid dupes.
          panel.dispose();
          return;
        }
        // Recompute progress from live signals + persisted state.
        wirePanel(context, panel, computeLiveCompletion(context));
      }
    }
  );
}

/**
 * Recompute completion from live signals + persisted state and re-render the
 * panel. Unlike notifyStepCompleted/notifyStepReset (which only move a single
 * step), this re-posts the full config, so steps can also go *backwards* —
 * e.g. when the user signs out, uninstalls a required extension, or changes
 * the installation root so no Qt framework is found. No-op if no panel is open.
 */
export function refreshWalkthrough(): void {
  if (!currentPanel || !panelContext) {
    return;
  }
  postConfig(computeLiveCompletion(panelContext));
}

/**
 * Asynchronously refresh whether the latest Qt Framework is installed and
 * re-render if it changed. Safe to fire-and-forget; a no-op when no panel is
 * open or the state is unchanged. Call this when the panel opens and after an
 * install completes (when the newest version may have just become installed).
 */
export async function refreshLatestFrameworkState(): Promise<void> {
  if (!currentPanel) {
    return;
  }
  const installed = (await isLatestFrameworkInstalled()) === true;
  if (installed === latestFrameworkInstalled) {
    return;
  }
  latestFrameworkInstalled = installed;
  refreshWalkthrough();
}

/**
 * Send a stepCompleted message to the webview.
 * Call this from extension logic when a step's completion event fires.
 */
export function notifyStepCompleted(stepId: string): void {
  if (!currentPanel) {
    return;
  }
  const msg: MessageToWebview = { type: 'stepCompleted', stepId };
  void currentPanel.webview.postMessage(msg);
}

/**
 * Send a stepReset message to the webview.
 */
export function notifyStepReset(stepId: string): void {
  if (!currentPanel) {
    return;
  }
  const msg: MessageToWebview = { type: 'stepReset', stepId };
  void currentPanel.webview.postMessage(msg);
}

function getWebviewHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): string {
  const distUri = vscode.Uri.joinPath(
    context.extensionUri,
    'webview-ui',
    'dist'
  );
  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'index.js'));
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distUri, 'index.css')
  );

  const nonce = getNonce();

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline';
                   script-src 'nonce-${nonce}';
                   img-src ${webview.cspSource} https: data:;"
        />
        <link rel="stylesheet" type="text/css" href="${cssUri.toString()}" />
        <title>Install Qt</title>
      </head>
      <body data-app="walkthrough">
        <div id="app"></div>
        <script defer nonce="${nonce}" src="${jsUri.toString()}"></script>
      </body>
    </html>
  `;
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
