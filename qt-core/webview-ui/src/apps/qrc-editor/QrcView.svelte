<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Plus } from '@lucide/svelte';

  import * as texts from '@/apps/texts';
  import IconButton from '@/comps/IconButton.svelte';
  import QrcGroupItem from './QrcGroupItem.svelte';
  import { data } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { onMount } from 'svelte';

  let tree: HTMLDivElement;

  onMount(() => {
    tree.addEventListener('keydown', e => viewlogic.onKeydown(e));
    tree.addEventListener('contextmenu', // disable default context menu
      e => e.preventDefault(),
      { capture: true }
    );
  });
</script>

<div class="w-full h-full qt-surface-bright overflow-y-auto">
  <!-- data view -->
  <div
    bind:this={tree}
    role="listbox"
    class="h-full items-center focus:qt-focus-tightRing"
    tabindex={0}
  >
    {#if data.groups.length !== 0}
      <!-- list view -->
      {#each data.groups as group, groupIndex (groupIndex)}
        <QrcGroupItem {group} />
      {/each}
    {:else}
      <!-- when there's no data -->
      <div class="w-full h-full flex flex-col items-center gap-6 justify-center">
        <div class="flex flex-row items-center gap-2">
          {texts.qrc.noItems.info}
        </div>
        <IconButton
          align="row"
          icon={Plus}
          text={texts.qrc.noItems.addGroup}
          onClicked={viewlogic.addNewGroup}
        />
      </div>
    {/if}
  </div>
</div>
