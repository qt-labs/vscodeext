<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';

  import { ui } from './states.svelte';
  import { GroupNodeWrapper } from './types.svelte';
  import QrcFileItem from './QrcFileItem.svelte';

  let {
    group = new GroupNodeWrapper()
  }: {
    group: GroupNodeWrapper
  } = $props();

  let id = $derived.by(() => { return group.pos.toString(); });
  let files = $derived.by(() => group.allFiles());
  let current = $derived.by(() => ui.cursor.currentPos.equals(group.pos));

  const select = () => ui.cursor.moveToPos(group.pos);
  const toggleOpened = () => group.setOpened(!group.opened);
</script>

<button
  {id}
  class={`w-full qt-item${current ? '-selected' : ''} !p-0 relative`}
  onclick={select}
  ondblclick={toggleOpened}
>
  {#if group.highlighted}
    <div class="absolute w-full h-full top-0 left-0
      bg-[var(--qt-primary-hoverBackground)] opacity-25
      pointer-events-none"
    >
    </div>
  {/if}

  <div class="w-full flex flex-row gap-2 items-center text-left p-0.5">
    <!-- expand/collapse icon -->
    <ChevronRight
      class={`${group.opened ? 'rotate-90' : ''}`}
      onclick={(e) => {
        select();
        toggleOpened();
        e.stopPropagation();
      }}
    />

    <!-- text -->
    {group.prefix}

    <!-- language -->
    {#if group.language.length !== 0}
      <div class={`qt-badge${current ? '' : '-primary'} `}>
        {group.language}
      </div>
    {/if}

    <!-- spacer, annotation -->
    <div class="grow"></div>
    <div class="text-sm px-1.5 bg-gray-500/25 mr-0.5 qt-border-radius">
      {group.numFiles()}
    </div>
  </div>
</button>

<!-- children for files in group -->
{#if group.opened && (files.length !== 0)}
  {#each files as file (file)}
    <QrcFileItem {file} />
  {/each}
{/if}

