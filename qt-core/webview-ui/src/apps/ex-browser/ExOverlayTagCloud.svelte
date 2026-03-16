<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Flow from '@/comps/Flow.svelte';
  import Overlay from '@/comps/Overlay.svelte';

  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { exBrowser as texts } from '@/apps/texts';

  const overlay = $derived(ui.overlays.tagCloud);
</script>

<button
  class='absolute inset-0 w-full h-full flex items-start'
  aria-label="close"
  onclick={(e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      viewlogic.setOverlayVisible('tagCloud', false);
    }
  }}
>

  <Overlay
    bind:collapsed={overlay.visible}
    title={`${texts.tagCloud.title} (${(ui.filter.category?.tags.length ?? 0)})`}
    useDropShadow={true}
    collapsible={false}
    class='p-2'
    titleClass='h-[32px] qt-label highlight'
    backgroundClass='!opacity-95'
    style={ui.overlays.tagCloud.position}
    onCloseClicked={() => {
      viewlogic.setOverlayVisible('tagCloud', false);
    }}
  >
    <Flow>
      {#each ui.filter.category?.tags as tag (tag)}
        <button
          class={`
            ${viewlogic.hasTagInQuery(tag) ? 'qt-button' : 'qt-button-flat'}
            px-2 py-0.5 cursor-pointer
          `}
          onclick={() => {
            void viewlogic.toggleTagInQuery(tag);
          }}
        >
          {tag}
        </button>
      {/each}
    </Flow>
  </Overlay>

</button>

