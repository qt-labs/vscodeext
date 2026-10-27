// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { data } from './states.svelte';

export function extractHash(uri: string) {
  try {
    return new URL(uri).hash;
  } catch {
    return '';
  }
}

export function removeHash(uri: string) {
  try {
    const u = new URL(uri);
    u.hash = '';
    return u.href;
  } catch {
    return '';
  }
}

export function toFileUriIfServer(uri: string) {
  if (!uri.startsWith(data.configs.serverOrigin)) {
    return uri;
  }

  try {
    const u = new URL(uri);
    return `file://${u.pathname}${u.hash}`;
  } catch {
    return '';
  }
}
