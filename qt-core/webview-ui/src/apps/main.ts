// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount } from 'svelte';

import NewItem from './new-item/NewItemApp.svelte';
import QmlTrace from './qml-trace/QmlTraceApp.svelte';
import QrcEditor from './qrc-editor/QrcEditorApp.svelte';

const appType = document.body.dataset.app;
const appComp = (appType === 'qrc-editor')
  ? QrcEditor
  : ((appType === 'qml-trace') ? QmlTrace : NewItem);

const app = mount(appComp, {
  target: document.getElementById('app')!
});

export default app;
