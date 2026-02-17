// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import type { FlameGraphKind } from "@shared/qml-trace";

export function count(n: number): string {
  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })} time${n === 1 ? '' : 's'}`;
}

export function nanosec(ns: number, fixed: number = -1): string {
  if (ns === 0) {
    return "0 ms";
  }

  const us = ns / 1_000;
  const ms = ns / 1_000_000;
  const value = (ms >= 1) ? ms : (us >= 1 ? us : ns);
  const unit = (ms >= 1) ? 'ms' : (us >= 1 ? '\u00B5s' : 'ns');
  const digits = (fixed >= 0) ? fixed : ((ms >= 1) ? 1 : 0);

  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })} ${unit}`;
}

export function bytes(bytes: number, fixed: number = -1): string {
  if (bytes === 0) {
    return "0 bytes";
  }

  const b = bytes;
  const kb = bytes / 1_024;
  const value = (kb >= 1) ? kb : b;
  const unit = (kb >= 1) ? 'kB' : 'bytes';
  const digits = (fixed >= 0) ? fixed : ((kb >= 1) ? 1 : 0);

  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })} ${unit}`;
}

export function formatByType(data: number, type: FlameGraphKind, fixed: number = -1) {
  switch (type) {
    case 'time':
      return nanosec(data, fixed);

    case 'memory':
      return bytes(data, fixed);

    case 'allocations':
      return count(data);
  }
}

export function percent(n: number, total: number, fixed: number = 1): string {
  if (n === 0 || total === 0) {
    return "0 %";
  }

  const percent = n / total * 100;
  return `${percent.toLocaleString(undefined, {
    minimumFractionDigits: fixed,
    maximumFractionDigits: fixed
  })} %`;
}
