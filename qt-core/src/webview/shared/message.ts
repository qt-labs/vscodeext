// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export enum CommandId {
  Invalid = -1,

  // new-item wizard
  NewItemCreationRequested,
  NewItemHasError,
  NewItemCheckIfQtcliReady,
  NewItemGetConfigs,
  NewItemGetAllPresets,
  NewItemGetPresetById,
  NewItemValidateInputs,
  NewItemManageCustomPreset,
  NewItemSelectWorkingDir,
  NewItemSaveOpenInPreference,

  // qrc editor
  QrcDocChanged,
  QrcAddFiles,
  QrcAddNewGroup,
  QrcGetRccTag,
  QrcGetFileInfo,
  QrcClean,
  QrcRemove,
  QrcSetProp,
  QrcSortAll,
  QrcRunVscodeUiAction,
  QrcRunClipboardAction,

  // qml trace file (.qtd, .qzt)
  QmlTraceGetConfigs,
  QmlTraceOpenFileInTextEditor,
  QmlTraceOpenFileInTraceViewer,
  QmlTraceSetConfigs,
  QmlTraceSelectFolder,
  QmlTraceGetWorkspaceFolders,

  // qt examples
  ExBrowserGetPackages,
  ExBrowserGetExamples,
  ExBrowserSelectPackage,
  ExBrowserResolveImageUrl,
  ExBrowserRunActionOnExample,
  ExBrowserSelectWorkingDir,
  ExBrowserValidateInputs,
  ExBrowserGetConfigs,
  ExBrowserSaveOpenInPreference,

  // qt academy courses
  CoursesGetCourses,
  CoursesRunAction,

  // welcome page
  WelcomeGetData,
  WelcomeHandleConfig,
  WelcomeRunAction,

  // ui file
  UiFileOpenInDesigner,
  UiFileOpenInTextEditor,

  // common
  CommonViewClosed,
  CommonRevealFolder,
  CommonVscodeThemeChanged
}

export const OneWayCommandIds = [
  CommandId.NewItemHasError,
  CommandId.NewItemCreationRequested,
  CommandId.QrcDocChanged,
  CommandId.CommonViewClosed,
  CommandId.CommonVscodeThemeChanged
];

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

export interface ErrorResponse {
  error: string;
  details?: Issue[];
}

export interface Issue {
  level: string;
  field: string;
  message: string;
}

export type CommandHandler = (command: Command) => void | Promise<void>;

// type guard functions
export function isCommand(x: unknown): x is Command {
  return (
    typeof x === 'object' &&
    x !== null &&
    'id' in x &&
    (x as Command).id in CommandId
  );
}

export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const maybe = obj as Partial<ErrorResponse>;
  const errorOk = typeof maybe.error === 'string';
  const detailsOk =
    maybe.details === undefined ||
    (Array.isArray(maybe.details) && maybe.details.every(isIssue));

  return errorOk && detailsOk;
}

function isIssue(obj: unknown): obj is Issue {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const maybe = obj as Partial<Issue>;

  return (
    typeof maybe.level === 'string' &&
    typeof maybe.field === 'string' &&
    typeof maybe.message === 'string'
  );
}
