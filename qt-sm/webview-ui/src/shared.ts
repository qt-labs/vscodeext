// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export interface LicenseAgreement {
  id: string;
  title: string;
  text: string;
  format: string;
  acceptText: string;
  rejectText: string;
}

export interface LicenseInitPayload {
  agreements: LicenseAgreement[];
}

export type MessageToWebview =
  | { type: 'init'; payload: LicenseInitPayload };

export type MessageToExtension =
  | { type: 'accept' }
  | { type: 'cancel' };
