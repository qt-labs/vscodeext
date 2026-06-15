// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { EXTENSION_ID, STATE_WALKTHROUGH_FIRST_APP_DONE } from '@/constants';
import { isAnyVersionInstalledOnDisk } from '@/installed-packages-store';
import { getLoggedIn, getRequiredExtensionsContext } from './extension';
import { createLogger, BaseStateManager, CoreKey } from 'qt-lib';

const logger = createLogger('walkthrough-panel');

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
}

interface MessageToWebview {
  type: 'init' | 'stepCompleted' | 'stepReset';
  payload?: WalkthroughConfig;
  stepId?: string;
}

interface MessageToExtension {
  type: 'action' | 'review' | 'resetAll';
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

function getDefaultConfig(completion: StepCompletion): WalkthroughConfig {
  const s = completion;
  return {
    title: 'Get started with Qt',
    description:
      'Take your first steps in setting up a Qt project. Complete each step in order to unlock the next.',
    successTitle: "You're all set!",
    successMessage:
      'Qt is installed and your first project is ready. Open the Qt extension to keep building.',
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
            disabled: s.framework,
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
    const msg: MessageToWebview = {
      type: 'init',
      payload: getDefaultConfig(completion)
    };
    void panel.webview.postMessage(msg);
  }, 100);

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
            }
          }
          break;
        }
        case 'review': {
          break;
        }
        case 'resetAll': {
          // Re-send init with fresh (all-false) completion so the
          // walkthrough restarts from step 1.
          logger.info('Walkthrough reset requested by webview');
          getWalkthroughState(context).firstAppDone = false;
          const fresh = getDefaultConfig({
            signin: getLoggedIn(),
            extensions: getRequiredExtensionsContext(),
            framework: isAnyVersionInstalledOnDisk(),
            firstApp: false
          });
          const initMsg: MessageToWebview = {
            type: 'init',
            payload: fresh
          };
          void panel.webview.postMessage(initMsg);
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
    'Get Started with Qt',
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
  const msg: MessageToWebview = {
    type: 'init',
    payload: getDefaultConfig(computeLiveCompletion(panelContext))
  };
  void currentPanel.webview.postMessage(msg);
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
        <title>Get Started with Qt</title>
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
