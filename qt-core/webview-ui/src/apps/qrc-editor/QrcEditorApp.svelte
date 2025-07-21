<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import '@/styles/app.css';
  import * as texts from '@/apps/texts';
  import DropMask from '@/comps/DropMask.svelte';
  import { DragDropHandler } from '@/comps/DragDropHandler.svelte';

  import QrcView from './QrcView.svelte';
  import QrcPropInput from './QrcPropInput.svelte';
  import QrcEditorHeader from './QrcEditorHeader.svelte';
  import { data } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import type { GroupNodeWrapper } from './types.svelte';

  let numGroups = $derived(data.groups.length);
  let numFiles = $derived.by(() => {
    return data.groups.reduce(
      (sum: number, g: GroupNodeWrapper) => sum + (g.numFiles()), 0
    );
  });

  let dnd = $state(undefined as DragDropHandler | undefined);
  let dropTarget: HTMLElement;;

  onMount(() => {
    dnd = new DragDropHandler(dropTarget);
    dnd.onDrop = (files: string[]) => { viewlogic.addFiles(files); };
    dnd.attach();

    viewlogic.onAppMount();
  });

  onDestroy(() => dnd?.detach());
</script>

<div class='w-screen h-screen p-2 flex flex-col gap-2'>
  <!-- header -->
  <QrcEditorHeader />

  <!-- list with drop mask -->
  <div class="flex-1 p-2 qt-surface flex flex-col gap-2 min-h-0">
    {texts.qrc.stats(numGroups, numFiles)}

    <div bind:this={dropTarget} class="flex-1 min-h-0 relative">
      <QrcView />

      {#if dnd && dnd.dragging}
        <DropMask />
      {/if}
    </div>
  </div>

  <!-- input panel -->
  <QrcPropInput />
</div>
