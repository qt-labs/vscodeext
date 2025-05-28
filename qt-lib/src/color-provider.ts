// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

export function createColorProvider() {
  return {
    provideDocumentColors(document: vscode.TextDocument) {
      return [...parseHexCodes(document), ...parseQtRgba(document)];
    },

    provideColorPresentations(
      color: vscode.Color,
      context: { document: vscode.TextDocument; range: vscode.Range }
    ) {
      const texts = [colorToHex(color), colorToQtRgba(color)];

      return texts.map((text) => {
        const p = new vscode.ColorPresentation(text);
        p.label = text;
        p.textEdit = new vscode.TextEdit(context.range, text);
        return p;
      });
    }
  };
}

function parseHexCodes(document: vscode.TextDocument) {
  const regex = /(["'])(#[0-9a-f]{3,8})\1/gi;
  const matches = document.getText().matchAll(regex);
  const info: vscode.ColorInformation[] = [];

  Array.from(matches).forEach((m) => {
    const hex = m[2];
    const color = hexToColor(hex);
    const r = new vscode.Range(
      document.positionAt(m.index),
      document.positionAt(m.index + m[0].length)
    );

    if (color) {
      info.push(new vscode.ColorInformation(r, color));
    }
  });

  return info;
}

function parseQtRgba(document: vscode.TextDocument) {
  const n = String.raw`\d(?:\.\d+)?`;
  const ws = String.raw`\s*`;
  const arg = `${ws}(${n})${ws}`;

  const regex = new RegExp(
    `Qt\\.rgba${ws}\\(${arg},${arg},${arg}(?:,${arg})?\\)`,
    'g'
  );

  const matches = document.getText().matchAll(regex);
  const info: vscode.ColorInformation[] = [];

  Array.from(matches).forEach((m) => {
    const r = parseFloat(m[1] ?? '0');
    const g = parseFloat(m[2] ?? '0');
    const b = parseFloat(m[3] ?? '0');
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1.0;

    const color = new vscode.Color(r, g, b, a);
    const range = new vscode.Range(
      document.positionAt(m.index),
      document.positionAt(m.index + m[0].length)
    );

    info.push(new vscode.ColorInformation(range, color));
  });

  return info;
}

function hexToColor(hex: string | undefined): vscode.Color | undefined {
  if (!hex || !hex.startsWith('#')) {
    return undefined;
  }

  if (hex.length === 4) {
    const r = parseInt(hex.substring(1, 2), 16) / 15;
    const g = parseInt(hex.substring(2, 3), 16) / 15;
    const b = parseInt(hex.substring(3, 4), 16) / 15;

    return new vscode.Color(r, g, b, 1);
  }

  if (hex.length === 7 || hex.length == 9) {
    const rgb = hex.slice(-6);

    const r = parseInt(rgb.substring(0, 2), 16) / 255;
    const g = parseInt(rgb.substring(2, 4), 16) / 255;
    const b = parseInt(rgb.substring(4, 6), 16) / 255;
    const a = hex.length === 9 ? parseInt(hex.substring(1, 3), 16) / 255 : 1;

    return new vscode.Color(r, g, b, a);
  }

  return undefined;
}

function colorToHex(color: vscode.Color) {
  function fractionToHexDigits(f: number): string {
    const s = Math.round(f * 255)
      .toString(16)
      .substring(0, 2);
    return s.length < 2 ? '0' + s : s;
  }

  const a = fractionToHexDigits(color.alpha);
  const r = fractionToHexDigits(color.red);
  const g = fractionToHexDigits(color.green);
  const b = fractionToHexDigits(color.blue);

  return color.alpha === 1 ? `'#${r}${g}${b}'` : `'#${a}${r}${g}${b}'`;
}

function colorToQtRgba(color: vscode.Color) {
  function formatFraction(f: number): string {
    return f.toFixed(2).replace(/\.?0+$/, '');
  }

  const a = formatFraction(color.alpha);
  const r = formatFraction(color.red);
  const g = formatFraction(color.green);
  const b = formatFraction(color.blue);

  return color.alpha === 1
    ? `Qt.rgba(${r}, ${g}, ${b})`
    : `Qt.rgba(${r}, ${g}, ${b}, ${a})`;
}
