<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ListgroupItem, Tooltip } from 'flowbite-svelte';
  import { Ellipsis } from '@lucide/svelte';

  import TruncatableLabel from '@/comps/TruncatableLabel.svelte';
  import PresetListItemMenu from './PresetListItemMenu.svelte';
  import { data } from './states.svelte';
  import { PresetWrapper } from './types.svelte';
  import { setSelectedPresetAt } from './viewlogic.svelte';

  let { index = -1, preset = new PresetWrapper() } = $props();

  let truncated = $state(false);
  let menuOpened = $state(false);
  let selected = $derived(data.selected.presetIndex === index)
</script>

<ListgroupItem
  class="qt-item flex flex-row gap-1"
  currentClass="qt-item-selected"
  current={selected}
  on:click={() => {
    setSelectedPresetAt(index);
  }}
>
  <TruncatableLabel text={preset.itemText} class="flex-1" bind:truncated />

  {#if preset.isCustomPreset()}
    <div class="ml-auto mr-0.5 flex flex-row gap-1">
      <div class="qt-badge">{preset.title}</div>
      <Ellipsis
        class='qt-button-contentOnly'
        style={selected ? 'color: var(--qt-primary-foreground);' : '' }
        onclick={() => {
          menuOpened = true;
        }}
      />
      {#if menuOpened}
        <PresetListItemMenu
          open={true}
          onClosed={() => {
            menuOpened = false;
          }}
        />
      {/if}
    </div>
  {/if}
</ListgroupItem>

{#if truncated && !menuOpened}
  <Tooltip placement="top" data-placement="top" class="qt-tooltip" offset={10}>
    {preset.itemText}
  </Tooltip>
{/if}
