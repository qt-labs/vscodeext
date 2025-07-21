<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import * as texts from '@/apps/texts';
  import InputDialog from '@/comps/InputDialog.svelte';
  import ConfirmDialog from '@/comps/ConfirmDialog.svelte';
  import { data, ui } from './states.svelte';
  import { manageCustomPreset, validatePresetName } from './viewlogic.svelte';

  let input = $state({
    value: '',
    error: {
      level: '',
      message: undefined as string | undefined
    }
  });

  function onInputAccepted() {
    if (ui.activeDialog === 'create' || ui.activeDialog === 'rename') {
      manageCustomPreset({
        action: ui.activeDialog,
        name: input.value.trim()
      });
    }

    closeDialogs();
  }

  function onInputDialongReady() {
    if (ui.activeDialog === 'create') {
      input.value = 'mynewpreset';
    } else if (ui.activeDialog === 'rename') {
      input.value = data.selected.preset.name ?? '';
    }

    validateInputs();
  }

  function validateInputs() {
    input.error.message = validatePresetName(input.value);
    input.error.level = (input.error.message !== undefined ? 'error' : '')
  }

  function closeDialogs() {
    ui.activeDialog = undefined;
  }
</script>

{#if ui.activeDialog === 'create' || ui.activeDialog === 'rename'}
  <InputDialog
    acceptOnEnter
    bind:value={input.value}
    level={input.error.level}
    message={input.error.message}
    text={texts.wizard.enterNewPresetName}
    acceptText={texts.wizard.buttons.okay}
    rejectText={texts.wizard.buttons.cancel}
    onReady={onInputDialongReady}
    onInput={validateInputs}
    onAccepted={onInputAccepted}
    onRejected={closeDialogs}
  />
{/if}

{#if ui.activeDialog === 'delete'}
  <ConfirmDialog
    text={texts.wizard.confirmDeletePreset}
    acceptText={texts.wizard.buttons.yes}
    rejectText={texts.wizard.buttons.no}
    onAccepted={() => {
      closeDialogs();
      manageCustomPreset({ action: 'delete' });
    }}
    onRejected={closeDialogs}
  />
{/if}
