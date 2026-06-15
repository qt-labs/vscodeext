// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount } from 'svelte';
import LicenseApp from './LicenseApp.svelte';
import WalkthroughApp from './walkthrough/WalkthroughApp.svelte';

const appType = document.body.dataset.app;
const appComp = appType === 'walkthrough' ? WalkthroughApp : LicenseApp;

const app = mount(appComp, {
  target: document.getElementById('app')!
});

export default app;
