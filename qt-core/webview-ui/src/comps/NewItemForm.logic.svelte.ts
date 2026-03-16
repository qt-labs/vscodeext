// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { InputIssue } from '@/comps/types.svelte';
import { type ErrorResponse } from '@shared/message';

export type EventType =
  | 'inputChanged'
  | 'openInChanged'
  | 'browseClicked'
  | 'createClicked';

export type EventCallback = (type: EventType, args?: unknown) => void;

export function createController() {
  const states = $state({
    name: 'untitled',
    workingDir: '',
    saveProjectDir: false,
    openIn: 'newWindow' as 'addToWorkspace' | 'newWindow' ,
    acceptable: true,
    issues: {
      name: new InputIssue(),
      workingDir: new InputIssue()
    }
  });

  function validate() {
    _validateCallback();
  }

  function clearIssues() {
    states.issues.name.clear();
    states.issues.workingDir.clear();
    states.acceptable = true;
  }

  function applyValidationResult(e: ErrorResponse | undefined) {
    if (e === undefined) {
      clearIssues();
      return;
    }

    e.details?.forEach(function (item) {
      const field = item.field.toLowerCase();
      if (field === 'name') states.issues.name.loadFrom(item);
      if (field === 'workingdir') states.issues.workingDir.loadFrom(item);
    });

    states.acceptable = !(
      states.issues.name.isError() || states.issues.workingDir.isError()
    );
  }

  function fireEvent(type: EventType, args?: unknown) {
    _eventCallback(type, args);
  }

  function onEvent(callback: EventCallback) {
    _eventCallback = callback;
  }

  function onValidate(callback: () => void) {
    _validateCallback = callback;
  }

  let _eventCallback = (_type: EventType, _args?: unknown) => {};
  let _validateCallback = () => {};

  return {
    states,

    validate,
    clearIssues,
    applyValidationResult,
    fireEvent,
    onEvent,
    onValidate,
  }
}

export type NewItemFormController = ReturnType<typeof createController>;
