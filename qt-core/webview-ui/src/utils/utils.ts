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
