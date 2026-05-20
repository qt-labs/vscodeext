// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { QtKitWrapper } from './wrappers';

export type UiDesignerSource = 'custom' | 'insRoot' | 'qtpaths' | 'pyside';

export interface UiDesignerInfo {
  valid: boolean;
  source: UiDesignerSource;
  filePath: string;
  qtKit?: QtKitWrapper;
}

export interface UiDesignerExes {
  custom: UiDesignerInfo;
  qtpaths: UiDesignerInfo;
  pyside: UiDesignerInfo;
}
