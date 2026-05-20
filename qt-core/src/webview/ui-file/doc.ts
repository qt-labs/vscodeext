// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export class UiFileDoc {
  private readonly _vsdoc: vscode.TextDocument;

  constructor(doc: vscode.TextDocument) {
    this._vsdoc = doc;
  }

  get uri() {
    return this._vsdoc.uri;
  }
}

export const defaultUiFileText = `
<?xml version="1.0" encoding="UTF-8"?>
<ui version="4.0">
  <class>Form</class>
  <widget class="QWidget" name="Form">
    <property name="geometry">
      <rect>
        <x>0</x>
        <y>0</y>
      <width>400</width>
      <height>300</height>
    </rect>
    </property>
    <property name="windowTitle">
      <string>Form</string>
    </property>
  </widget>
  <resources/>
  <connections/>
</ui>
`.trimStart();
