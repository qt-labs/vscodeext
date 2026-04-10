// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount } from 'svelte';

import Welcome from './welcome/WelcomeApp.svelte';
import Courses from './courses/CoursesApp.svelte';
import NewItem from './new-item/NewItemApp.svelte';
import QmlTrace from './qml-trace/QmlTraceApp.svelte';
import QrcEditor from './qrc-editor/QrcEditorApp.svelte';
import ExBrowser from './ex-browser/ExBrowserApp.svelte';

const appType = document.body.dataset.app;
const appComp = (() => {
  switch (appType) {
    case 'welcome': return Welcome;
    case 'courses': return Courses;
    case 'qrc-editor': return QrcEditor;
    case 'qml-trace': return QmlTrace;
    case 'ex-browser': return ExBrowser;
    default:
      return NewItem;
  }
})();

const app = mount(appComp, {
  target: document.getElementById('app')!
});

export default app;
