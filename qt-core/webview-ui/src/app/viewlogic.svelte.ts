// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { vscode } from '@/app/vscode';
import { isErrorResponse } from '@shared/types';
import { type CommandReply, CommandId } from '@shared/message';
import { type Preset, isPreset, isPresetArray } from './types.svelte';
import { data, input, ui } from './states.svelte';

export async function onAppMount() {
  vscode.onDidReceiveNotification(async (r: CommandReply) => {
    if (r.id === CommandId.PanelRevealed && r.payload) {
      data.configs = {
        ...data.configs,
        ...r.payload
      };

      try {
        void loadDefaultWorkingDir();
        await validateInput();
      } catch (e) {
        reportUiError('Error in PanelRevealed handler:', e);
      }
    }
  });

  try {
    startLoading();

    await vscode.post(CommandId.UiCheckIfQtcliReady);
    data.serverReady = true;

    await loadPresets();
    await selectAnyPresetAndValidate();
  } catch (e) {
    reportUiError('Error during onAppMount', e);
  } finally {
    endLoading();
  }
}

export function onModalClosed() {
  void vscode.post(CommandId.UiClosed);
}

export function onWorkingDirBrowseClicked() {
  void vscode
    .post(CommandId.UiSelectWorkingDir, input.workingDir)
    .then((data) => {
      if (typeof data === 'string' && input.workingDir != data) {
        input.workingDir = data;
        void validateInput();
      }
    })
    .catch((e) => {
      reportUiError('Error selecting working dir', e);
    });
}

export async function setPresetType(type: string) {
  if (data.selected.type !== type) {
    data.selected.type = type;
    loadDefaultWorkingDir();

    try {
      startLoading(1000);
      await loadPresets();
      await selectAnyPresetAndValidate();
    } catch (e) {
      reportUiError('Error while setting preset type', e);
    } finally {
      endLoading();
    }
  }
}

export async function setSelectedPreset(preset: Preset, index: number) {
  if (!data.serverReady) return;

  data.selected.preset = preset;
  data.selected.presetIndex = index;

  if (preset.id.length > 0) {
    try {
      const r = await vscode.post(CommandId.UiGetPresetById, preset.id);
      if (isPreset(r)) {
        data.selected.preset = r;
      }
    } catch (e) {
      reportUiError('Error getting preset by id', e);
    }
  }
}

export function createPresetDisplayText(preset: Preset | undefined): string {
  if (!preset) return '';
  return preset.name.startsWith('@') ? preset.meta.title : preset.name;
}

export async function createItemFromSelectedPreset() {
  if (!data.selected.preset) return;

  try {
    await vscode.post(CommandId.UiItemCreationRequested, {
      type: data.selected.type,
      name: input.name,
      workingDir: input.workingDir,
      presetId: data.selected.preset?.id,
      saveProjectDir: input.saveProjectDir
    });
  } catch (e) {
    reportUiError('Error creating item', e);
  }
}

export async function validateInput() {
  if (!data.serverReady) return;

  const payload = {
    name: input.name,
    workingDir: input.workingDir,
    presetId: data.selected.preset?.id
  };

  try {
    await vscode.post(CommandId.UiValidateInputs, payload);
    clearInputErrors();
  } catch (e) {
    clearInputErrors();

    if (isErrorResponse(e)) {
      e.details?.forEach(function (item) {
        const field = item.field.toLowerCase();
        if (field === 'name') input.issues.name.loadFrom(item);
        if (field === 'workingdir') input.issues.workingDir.loadFrom(item);
      });

      ui.canCreate = !(
        input.issues.name.isError() || input.issues.workingDir.isError()
      );
    }
  }
}

async function loadPresets() {
  if (!data.serverReady) return;

  try {
    const r = await vscode.post(CommandId.UiGetAllPresets, data.selected.type);
    if (isPresetArray(r)) {
      data.presets = r;
    }
  } catch (e) {
    reportUiError('Error loading presets', e);
  }
}

function loadDefaultWorkingDir() {
  let candidate = data.selected.type === 'file'
    ? data.configs.newFileBaseDir
    : data.configs.newProjectBaseDir;

  if (input.workingDir !== candidate) {
    input.workingDir = candidate;
  }
}

async function selectAnyPresetAndValidate() {
  if (data.presets.length > 0) {
    await setSelectedPreset(data.presets[0], 0);
    await validateInput();
  }
}

function reportUiError(msg: string, e?: unknown) {
  const detail = e instanceof Error ? e.message : String(e);
  void vscode.post(CommandId.UiHasError, `${msg}: ${detail}`);
}

function clearInputErrors() {
  input.issues.name.clear();
  input.issues.workingDir.clear();
  ui.canCreate = true;
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
