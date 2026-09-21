// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount, type Component } from 'svelte';
import { type WebAppId } from '@shared/types';

type Loader = () => Promise<{ default: Component }>;
const loaders: Record<WebAppId, Loader> = {
  'new-item': () => import('./new-item/NewItemApp.svelte'),
  'ex-browser': () => import('./ex-browser/ExBrowserApp.svelte'),
  'welcome-page': () => import('./welcome/WelcomePageApp.svelte'),
  'courses-browser': () => import('./courses/CoursesBrowserApp.svelte'),
  'ui-file': () => import('./ui-file/UiFileApp.svelte'),
  'qml-trace': () => import('./qml-trace/QmlTraceApp.svelte'),
  'qrc-editor': () => import('./qrc-editor/QrcEditorApp.svelte')
};

function main() {
  const appId = document.body.dataset.appId ?? '';
  const loader = loaders[appId as WebAppId];
  const targetEl = document.getElementById('app')!;

  if (!loader) {
    const message = `Unknown appId: "${appId}"`;
    console.error(message);
    targetEl.innerHTML = `<p>${message}</p>`;
    return;
  }

  loader().then(({ default: App }) => {
    mount(App, { target: targetEl });
  });
}

main();
