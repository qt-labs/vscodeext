// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { z } from 'zod';

import * as texts from '@/apps/texts';
import { vscode } from '@/apps/vscode';
import { CommandId, isErrorResponse } from '@shared/message';
import { isPreset, isPresetArray } from './types.svelte';
import { data, input, ui } from './states.svelte';

type ManageCustomPresetArgs =
  | { action: 'create'; name: string }
  | { action: 'rename'; name: string }
  | { action: 'update' }
  | { action: 'delete' };

export async function onAppMount() {
  try {
    startLoading();

    await vscode.post(CommandId.UiCheckIfQtcliReady);
    data.serverReady = true;

    await loadConfigsAndInitInputs();
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
  const timeout = -1;
  void vscode
    .post(CommandId.UiSelectWorkingDir, input.workingDir, timeout)
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
    loadDefautInputs();

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

export async function setSelectedPresetByName(name: string) {
  const index = data.presets.findIndex((p) => p.name === name);
  if (index !== -1) {
    setSelectedPresetAt(index);
  }
}

export async function setSelectedPresetAt(index: number) {
  if (!data.serverReady) return;
  if (index < 0 || index >= data.presets.length) return;

  const p = data.presets[index];
  if (p) {
    data.selected.presetIndex = index;
    data.selected.preset.setData(p);
    ui.unsavedOptionChanges = {};

    await refreshPresetDetails();
  }
}

async function refreshPresetDetails() {
  if (!data.selected.preset.isValid()) {
    return;
  }

  try {
    const id = data.selected.preset.id;
    if (id.length === 0) {
      return;
    }

    const r = await vscode.post(CommandId.UiGetPresetById, id);
    if (isPreset(r)) {
      data.selected.preset.setData(r);
    }
  } catch (e) {
    reportUiError('Error getting preset by id', e);
  }
}

export async function createItemFromSelectedPreset() {
  if (!data.selected.preset) return;

  try {
    await vscode.post(CommandId.UiItemCreationRequested, {
      type: data.selected.type,
      name: input.name,
      workingDir: input.workingDir,
      presetId: data.selected.preset?.id,
      options: $state.snapshot(ui.unsavedOptionChanges),
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

export async function manageCustomPreset(args: ManageCustomPresetArgs) {
  const presetId = data.selected.preset?.id;
  if (!presetId) {
    return;
  }

  const action = args.action;
  const options = $state.snapshot(ui.unsavedOptionChanges);
  const isCustom = data.selected.preset.isCustomPreset();
  const isDefault = data.selected.preset.isDefaultPreset();

  switch (args.action) {
    case 'create': {
      const name = args.name.trim();
      if (isDefault && name.length !== 0) {
        const payload = { action, presetId, name, options };
        await vscode.post(CommandId.UiManageCustomPreset, payload);
        await loadPresets();
        await setSelectedPresetByName(name);
      }
      break;
    }

    case 'rename': {
      const name = args.name.trim();
      if (isCustom && name.length !== 0 && name !== data.selected.preset.name) {
        const payload = { action, presetId, name };
        await vscode.post(CommandId.UiManageCustomPreset, payload);
        await loadPresets();
        await setSelectedPresetByName(name);
      }
      break;
    }

    case 'update':
      if (isCustom && Object.keys(options).length !== 0) {
        const payload = { action, presetId, options };
        await vscode.post(CommandId.UiManageCustomPreset, payload);
        await setSelectedPresetAt(data.selected.presetIndex);
      }
      break;

    case 'delete':
      if (isCustom) {
        const payload = { action, presetId };
        await vscode.post(CommandId.UiManageCustomPreset, payload);
        await loadPresets();
        await setSelectedPresetAt(Math.max(0, data.selected.presetIndex - 1));
      }
      break;
  }
}

export function validatePresetName(name: string): string | undefined {
  const current = data.selected.preset?.name;
  if (name.trim() === current) {
    return undefined;
  }

  const m = texts.wizard.presetNameErrors;
  const taken = data.presets.map((p) => {
    return p.name;
  });
  const schema = z
    .string()
    .trim()
    .nonempty({ message: m.empty })
    .max(30, { message: m.tooLong })
    .regex(/^[a-zA-Z0-9_-]+$/i, { message: m.invalid })
    .refine((v) => !taken.includes(v), { message: m.alreadyTaken });

  const result = schema.safeParse(name);
  if (!result.success) {
    return result.error.errors[0].message;
  }

  return undefined;
}

// helpers
async function loadConfigsAndInitInputs() {
  try {
    const r = await vscode.post(CommandId.UiGetConfigs);
    if (r && typeof r === "object") {
      data.configs = {
        ...data.configs,
        ...r
      };

      loadDefautInputs();
    }
  } catch (e) {
    reportUiError('Error loading configs', e);
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

function loadDefautInputs() {
  let candidate = data.selected.type === 'file'
    ? data.configs.newFileBaseDir
    : data.configs.newProjectBaseDir;

  if (input.workingDir !== candidate) {
    input.workingDir = candidate;
  }
}

async function selectAnyPresetAndValidate() {
  if (data.presets.length > 0) {
    await setSelectedPresetAt(0);
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
