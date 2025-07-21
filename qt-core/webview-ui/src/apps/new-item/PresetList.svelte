<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Listgroup } from 'flowbite-svelte';

  import { data, ui } from './states.svelte';
  import { PresetWrapper } from './types.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import PresetListItem from './PresetListItem.svelte';

  let wrappedPresets = $derived.by(() => {
    return data.presets.map((p) => new PresetWrapper(p));
  });

  const adjustSelectedIndex = (offset: number) => {
    if (!data.selected.preset || data.selected.presetIndex < 0) {
      return;
    }

    let candidate = data.selected.presetIndex + offset;
    candidate = Math.max(0, candidate);
    candidate = Math.min(candidate, data.presets.length - 1);

    if (candidate != data.selected.presetIndex) {
      viewlogic.setSelectedPresetAt(candidate);
    }
  };

  const onKeyPressed = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      adjustSelectedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      adjustSelectedIndex(+1);
    } else if (e.key === 'Delete') {
      if (data.selected.preset.isCustomPreset()) {
        ui.activeDialog = 'delete';
      }
    } else {
      return;
    }

    const el = e.currentTarget as HTMLElement;
    if (el) {
      const items = el?.querySelectorAll('button');
      const item = items[data.selected.presetIndex];
      if (item instanceof HTMLButtonElement) {
        item.focus();
      }
    }

    e.preventDefault();
  };
</script>

<div class="flex flex-col">
  <Listgroup
    active
    class="flex-grow overflow-y-auto qt-list items-center"
    onkeydown={onKeyPressed}
    tabindex={0}
  >
    {#each wrappedPresets as preset, index (preset.id)}
      <PresetListItem {preset} {index} />
    {/each}
  </Listgroup>
</div>
