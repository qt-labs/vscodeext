// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount } from 'svelte';
import LicenseApp from './LicenseApp.svelte';

const app = mount(LicenseApp, {
  target: document.getElementById('app')!
});

export default app;
