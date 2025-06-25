// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export enum CommandId {
  // one-way
  UiClosed,
  UiItemCreationRequested,
  UiHasError,
  EndOfNotification,

  // request-response type
  UiCheckIfQtcliReady,
  UiGetConfigs,
  UiGetAllPresets,
  UiGetPresetById,
  UiValidateInputs,
  UiManageCustomPreset,
  UiSelectWorkingDir
}

export type ManageCustomPresetArgs =
  | { action: 'create'; name: string }
  | { action: 'rename'; name: string }
  | { action: 'update' }
  | { action: 'delete' };

export interface Command<T = unknown> {
  id: CommandId;
  tag?: string;
  payload?: T;
}

export interface CommandReply<T = unknown> {
  id: CommandId;
  tag: string;
  payload: {
    data?: T;
    error?: unknown;
  };
}

// type guard functions
export function IsCommand(x: unknown): x is Command {
  return (
    typeof x === 'object' &&
    x !== null &&
    'id' in x &&
    (x as Command).id in CommandId
  );
}
