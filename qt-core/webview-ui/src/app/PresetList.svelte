<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Listgroup, ListgroupItem } from 'flowbite-svelte';

  import { data } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  const adjustSelectedIndex = (offset: number) => {
    if (!data.selected.preset || data.selected.presetIndex < 0) {
      return;
    }

    let candidate = data.selected.presetIndex + offset;
    candidate = Math.max(0, candidate);
    candidate = Math.min(candidate, data.presets.length - 1);

    if (candidate != data.selected.presetIndex) {
      viewlogic.setSelectedPreset(data.presets[candidate], candidate);
    }
  };

  const onKeyPressed = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      adjustSelectedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      adjustSelectedIndex(+1);
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
  };
</script>

<div class="flex flex-col">
  <Listgroup
    active
    class="flex-grow overflow-y-auto qt-list items-center"
    onkeydown={onKeyPressed}
    tabindex={0}
  >
    {#each data.presets as preset, index (index)}
      <ListgroupItem
        class="qt-list-item flex flex-row"
        currentClass="selected"
        current={data.selected.presetIndex === index}
        on:click={() => {
          viewlogic.setSelectedPreset(preset, index);
        }}
      >
        <div class="flex-1">
          {viewlogic.createPresetDisplayText(preset)}
        </div>

        {#if !preset.name.startsWith('@')}
          <div class="ml-auto mr-0.5 qt-badge">{preset.meta.title}</div>
        {:else}
          <div></div>
        {/if}
      </ListgroupItem>
    {/each}
  </Listgroup>
</div>
