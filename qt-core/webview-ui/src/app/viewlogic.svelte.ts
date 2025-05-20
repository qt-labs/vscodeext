// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { vscode } from '@/app/vscode';
import { isErrorResponse } from '@shared/types';
import { type CommandReply, CommandId } from '@shared/message';
import { type Preset, isPreset, isPresetArray } from './types.svelte';
import { data, input, ui } from './states.svelte';

export function onAppMount() {
  loadDefaultWorkingDirAndValidate();

  vscode.onDidReceiveNotification(function (r: CommandReply) {
    if (r.id === CommandId.PanelRevealed && r.payload) {
      data.configs = {
        ...data.configs,
        ...r.payload
      };

      loadDefaultWorkingDirAndValidate();
    }
  });

  startLoading();

  void vscode.post(CommandId.UiCheckIfQtcliReady).then(() => {
    data.serverReady = true;
    endLoading();
    loadPresets();
  });
}

export function onModalClosed() {
  vscode.post(CommandId.UiClosed);
}

export function onWorkingDirBrowseClicked() {
  vscode
    .post(CommandId.UiSelectWorkingDir, input.workingDir)
    .then(function (data) {
      if (typeof data === 'string' && input.workingDir != data) {
        input.workingDir = data;
        validateInput();
      }
    });
}

export function setPresetType(type: string) {
  if (data.selected.type !== type) {
    data.selected.type = type;
    loadPresets();
    loadDefaultWorkingDirAndValidate();
  }
}

export function setSelectedPreset(preset: Preset, index: number) {
  if (!data.serverReady) {
    return;
  }

  data.selected.preset = preset;
  data.selected.presetIndex = index;

  if (preset.id.length > 0) {
    vscode
      .post(CommandId.UiGetPresetById, preset.id)
      .then(function (r) {
        if (isPreset(r)) {
          data.selected.preset = r;
        }
      })
      .finally(function () {
        endLoading();
      });
  }
}

export function loadPresets() {
  if (!data.serverReady) {
    return;
  }

  startLoading(1000);

  vscode.post(CommandId.UiGetAllPresets, data.selected.type).then(function (r) {
    if (isPresetArray(r)) {
      data.presets = r;
      if (data.presets.length !== 0) {
        setSelectedPreset(data.presets[0], 0);
      }
    }
  });
}

export function createPresetDisplayText(preset: Preset | undefined): string {
  if (!preset) {
    return '';
  }

  if (preset.name.startsWith('@')) {
    return preset.meta.title;
  } else {
    return preset.name;
  }
}

export async function createItemFromSelectedPreset() {
  if (!data.selected.preset) {
    return;
  }

  vscode.post(CommandId.UiItemCreationRequested, {
    type: data.selected.type,
    name: input.name,
    workingDir: input.workingDir,
    presetId: data.selected.preset?.id,
    saveProjectDir: input.saveProjectDir
  });
}

export async function validateInput() {
  if (!data.serverReady) {
    return;
  }

  const payload = {
    name: input.name,
    workingDir: input.workingDir,
    presetId: data.selected.preset?.id
  };

  vscode
    .post(CommandId.UiValidateInputs, payload)
    .then(function () {
      input.issues.name.clear();
      input.issues.workingDir.clear();
      ui.canCreate = true;
    })
    .catch(function (e) {
      input.issues.name.clear();
      input.issues.workingDir.clear();
      ui.canCreate = true;

      if (isErrorResponse(e)) {
        e.details?.forEach(function (item) {
          const field = item.field.toLocaleLowerCase();
          if (field === 'name') input.issues.name.loadFrom(item);
          if (field === 'workingdir') input.issues.workingDir.loadFrom(item);
        });

        ui.canCreate = !(
          input.issues.name.isError() || input.issues.workingDir.isError()
        );
      }
    });
}

function loadDefaultWorkingDirAndValidate() {
  let candidate = input.workingDir;

  if (import.meta.env.DEV) {
    candidate = '/dev';
  } else {
    candidate =
      data.selected.type === 'file'
        ? data.configs.newFileBaseDir
        : data.configs.newProjectBaseDir;
  }

  if (input.workingDir !== candidate) {
    input.workingDir = candidate;
    validateInput();
  }
}

// loading mask
function startLoading(delay = 0) {
  ui.loading.busy = true;
  ui.loading.error = undefined;
  clearLoadingDelayTimer();

  if (delay === 0) {
    ui.loading.forceHidden = false;
  } else {
    ui.loading.forceHidden = true;
    ui.loading.delayedTimerId = setTimeout(function () {
      ui.loading.forceHidden = false;
    }, delay);
  }
}

function endLoading() {
  clearLoadingDelayTimer();
  ui.loading.busy = false;
  ui.loading.error = undefined;
}

function clearLoadingDelayTimer() {
  if (ui.loading.delayedTimerId) {
    clearTimeout(ui.loading.delayedTimerId);
    ui.loading.delayedTimerId = null;
  }
}
