// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-onl

import { File } from '@lucide/svelte';

export interface PickerItem {
  text: string;
  icon?: typeof File | undefined;
}
