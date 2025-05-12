// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { PushMessageId, type PushMessage } from '@shared/message';
import { vscodeApi } from '@/logic/vscodeApi';

vscodeApi.onDidReceivePushMessage((p: PushMessage) => {
  if (p.id === PushMessageId.PanelInit) {
    console.log('init message received', p.data);
  }
});

export const onCloseClicked = () => {
  vscodeApi.push(PushMessageId.UiClosed);
};
