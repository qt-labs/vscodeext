// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export enum PushMessageId {
  PanelInit,
  UiClosed
}

export interface PushMessage<T = unknown> {
  id: PushMessageId;
  data?: T;
}

export function isPushMessage(x: unknown): x is PushMessage {
  return (
    typeof x === 'object' &&
    x !== null &&
    'id' in x &&
    (x as PushMessage).id in PushMessageId &&
    !('tag' in x)
  );
}
