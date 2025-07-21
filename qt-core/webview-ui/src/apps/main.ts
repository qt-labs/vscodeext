// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { mount } from 'svelte';
import NewItem from './new-item/NewItemApp.svelte';

const app = mount(NewItem, {
  target: document.getElementById('app')!
});

export default app;
