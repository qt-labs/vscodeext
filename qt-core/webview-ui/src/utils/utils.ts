// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export function textOrFallback(text: string, fallback = '-') {
  return text.trim().length === 0 ? fallback : text;
}

export function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value == null) return false;

  const s = String(value).toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(s);
}

export function focusAnyChild(el: HTMLElement) {
  const selector = '[tabindex]:not([tabindex="-1"])';
  const fallback = el?.querySelector(selector) as HTMLElement;
  fallback?.focus();
}

export function extractQtVersion(input: string): string {
  // Extract version numbers only, must start with 'Qt-', e.g.;
  // - 'Qt-6.11.1'      -> '6.11.1'
  // - 'Qt-6.11'        -> '6.11'
  // - 'Qt-6'           -> '6'
  // - 'no version here' -> input (unchanged)
  // - 'prefix-Qt-6.2.4' -> input (unchanged, doesn't start with Qt-)
  const match = input.match(/^Qt-(\d+\.\d+\.\d+)/);
  return match?.[1] ?? input;
}

export function addSpaceBeforeUppercase(str: string): string {
  // 'QtQuickControls' => 'Qt Quick Controls'
  // 'QMLTestRunner' => 'QML Test Runner'
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}
