<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Plus, Save } from '@lucide/svelte';

  import IconButton from '@/comps/IconButton.svelte';
  import SectionLabel from '@/comps/SectionLabel.svelte';
  import * as texts from '@/apps/texts';
  import { data, ui } from './states.svelte';
  import { manageCustomPreset } from './viewlogic.svelte';

  let createEnabled = $derived.by(() => {
    return (
      data.selected.preset.isDefaultPreset() &&
      data.selected.preset.hasSteps() &&
      Object.keys(ui.unsavedOptionChanges).length !== 0
    );
  });

  let saveEnabled = $derived.by(() => {
    return (
      data.selected.preset.isCustomPreset() &&
      Object.keys(ui.unsavedOptionChanges).length !== 0
    );
  });
</script>

<!-- title and toolbar -->
<div class="w-full flex items-end justify-between mb-2">
  <div>
    <SectionLabel text={texts.wizard.options} />
  </div>
  <div
    class={`
      flex flex-row transition-opacity duration-200
      ${!(createEnabled || saveEnabled) ? 'opacity-0 pointer-events-none' : ''}
      `}
  >
    <IconButton
      icon={Plus}
      tooltip={texts.wizard.buttonTooltips.create}
      tooltipPlacement="left"
      visible={createEnabled}
      text={texts.wizard.buttons.create}
      onClicked={() => {
        ui.activeDialog = 'create';
      }}
    />

    <IconButton
      icon={Save}
      tooltip={texts.wizard.buttonTooltips.save}
      tooltipPlacement="left"
      visible={saveEnabled}
      text={texts.wizard.buttons.save}
      class="px-4 py-2"
      onClicked={() => {
        manageCustomPreset({ action: 'update' });
      }}
    />
  </div>
</div>
