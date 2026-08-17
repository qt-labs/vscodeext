// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount, type Component } from 'svelte';

type Loader = () => Promise<{ default: Component }>;
const loaders: Record<string, Loader> = {
  'welcome': () => import('./welcome/WelcomeApp.svelte'),
  'courses': () => import('./courses/CoursesApp.svelte'),
  'new-item': () => import('./new-item/NewItemApp.svelte'),
  'qml-trace': () => import('./qml-trace/QmlTraceApp.svelte'),
  'qrc-editor': () => import('./qrc-editor/QrcEditorApp.svelte'),
  'ex-browser': () => import('./ex-browser/ExBrowserApp.svelte'),
};

const appType = document.body.dataset.app ?? '';
const loader = loaders[appType] ?? loaders['new-item'];

loader().then(({ default: App }) => {
  mount(App, {
    target: document.getElementById('app')!
  });
});
