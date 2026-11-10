// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { EXTENSION_ID, COMMAND_SHOW_LOG } from '@/constants.js';

// contributes > command
export const COMMAND_PREFIX = EXTENSION_ID;
export const COMMAND_OPEN_IN_WIDGETS_DESIGNER = 'openInWidgetsDesigner';

// contributes > customEditors
export const CUSTOM_EDITOR_TYPE = `${EXTENSION_ID}.uiFile`;

export { EXTENSION_ID, COMMAND_SHOW_LOG };
