// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export type AppId =
  | 'welcome'
  | 'courses'
  | 'new-item'
  | 'qml-trace'
  | 'qrc-editor'
  | 'ex-browser'
  | 'ui-designer';

export type OpenInPreference = 'newWindow' | 'addToWorkspace';
export const OpenInDefault: OpenInPreference = 'addToWorkspace';

export function isOpenInPreference(v: unknown): v is OpenInPreference {
  return v === 'newWindow' || v === 'addToWorkspace';
}
