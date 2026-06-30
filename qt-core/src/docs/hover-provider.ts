// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

const QtGeneralPatterns: RegExp[] = [
  /Q[A-Za-z][A-Za-z0-9_]*/, // Classes/types, e.g. QString, QColor, Qt
  /q[A-Z][A-Za-z0-9_]*/, // Global functions, e.g. qDebug, qRound, qColor
  /Q_[A-Z][A-Za-z0-9_]*/ // Macros, e.g. Q_ASSERT, Q_UNUSED
];

const QtCMakePattern = /\bqt_[a-z][a-z0-9_]*\b/; // e.g. qt_add_executable, qt_add_qml_module
const QtGeneralPatternsMerged = new RegExp(
  `\\b(?:${QtGeneralPatterns.map((p) => p.source).join('|')})\\b`
);

class QtHoverProvider implements vscode.HoverProvider {
  constructor(private readonly pattern: RegExp) {}

  provideHover(doc: vscode.TextDocument, pos: vscode.Position) {
    const range = doc.getWordRangeAtPosition(pos, this.pattern);
    if (!range) {
      return undefined;
    }

    return createHoverLink(doc.getText(range));
  }
}

export function registerQtDocsHoverProvider(context: vscode.ExtensionContext) {
  const generalSelector = [
    { language: 'h' },
    { language: 'cpp' },
    { language: 'qml' },
    { language: 'qt-ui' },
    { language: 'python' }
  ];

  const cmakeSelector = [{ language: 'cmake' }];
  const register = vscode.languages.registerHoverProvider;

  context.subscriptions.push(
    register(cmakeSelector, new QtHoverProvider(QtCMakePattern)),
    register(generalSelector, new QtHoverProvider(QtGeneralPatternsMerged))
  );
}

// helper
function createHoverLink(linkText: string): vscode.Hover {
  const guide = '$(book)';
  const linkTarget = [
    'command:qt-core.documentationSearchForCurrentWord',
    encodeURIComponent(JSON.stringify([linkText]))
  ].join('?');

  const link = `${guide} [${linkText}](${linkTarget})`;
  const markdown = new vscode.MarkdownString(link);
  markdown.isTrusted = true;
  markdown.supportThemeIcons = true;

  return new vscode.Hover(markdown);
}
