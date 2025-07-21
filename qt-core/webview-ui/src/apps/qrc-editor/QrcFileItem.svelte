<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { TriangleAlert } from '@lucide/svelte';

  import * as texts from '@/apps/texts';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { FileNodeWrapper } from './types.svelte';
  import QrcFileItemThumbnail from './QrcFileItemThumbnail.svelte';

  let {
    file = new FileNodeWrapper()
  }: {
    file: FileNodeWrapper
  } = $props();

  let id = $derived.by(() => file.pos.toString());
  let loaded = $derived.by(() => data.fileInfo[file.text]);
  let exists = $derived.by(() => loaded?.exists ?? false);
  let okay = $derived.by(() => (exists || (!exists && file.empty)));
  let current = $derived.by(() => ui.cursor.currentPos.equals(file.pos));
</script>

<button
  {id}
  class={`w-full qt-item${current ? '-selected' : ''} !p-0 relative`}
  onclick={() => ui.cursor.moveToPos(file.pos)}
  ondblclick={() => viewlogic.runVscodeUiAction('openFile')}
>
  {#if file.highlighted}
    <div class="absolute w-full h-full top-0 left-0
      bg-[var(--qt-primary-hoverBackground)] opacity-25
      pointer-events-none"
    >
    </div>
  {/if}

  <div class='ml-12 flex flex-row gap-2 items-center p-0'>
    <!-- thumbnail -->
    <QrcFileItemThumbnail {file} />

    <!-- text -->
    <div class={`${(loaded && !okay) ? 'line-through' : ''} text-left p-0.5`}>
      {file.text}
    </div>

    <!-- alias badge -->
    {#if file.alias.length !== 0}
      <div class={`qt-badge${current ? '' : '-primary'} `}>
        {texts.qrc.annotation.alias(file.alias)}
      </div>
    {/if}

    {#if loaded}
      <!-- empty-attribute badge -->
      {#if file.empty}
        <div class={`qt-badge${current ? '' : '-primary'} `}>
          {texts.qrc.annotation.empty}
        </div>
      {/if}

      <!-- not-found warning -->
      {#if !okay}
        <div class={`
          flex flex-row gap-2 items-center
          ${current ? '' : 'qt-warning-color'}
        `}>
          <TriangleAlert />
          {texts.qrc.annotation.notFound}
        </div>
      {/if}
    {/if}
  </div>
</button>
