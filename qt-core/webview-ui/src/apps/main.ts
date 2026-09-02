// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount, type Component } from 'svelte';
import { type AppId } from '@shared/types';

type Loader = () => Promise<{ default: Component }>;
const loaders: Record<AppId, Loader> = {
  'welcome': () => import('./welcome/WelcomeApp.svelte'),
  'courses': () => import('./courses/CoursesApp.svelte'),
  'new-item': () => import('./new-item/NewItemApp.svelte'),
  'qml-trace': () => import('./qml-trace/QmlTraceApp.svelte'),
  'qrc-editor': () => import('./qrc-editor/QrcEditorApp.svelte'),
  'ex-browser': () => import('./ex-browser/ExBrowserApp.svelte'),
  'ui-designer': () => import('./ui-designer/UiDesignerApp.svelte')
};

function main() {
  const appId = document.body.dataset.appId ?? '';
  const loader = loaders[appId as AppId];
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
