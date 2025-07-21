// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-onl

import { FileCloneOutline } from 'flowbite-svelte-icons';

export interface PickerItem {
  text: string;
  icon?: typeof FileCloneOutline | undefined;
}
