<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import ScrollToTopButton from '@/comps/ScrollToTopButton.svelte';
  import { createVerticalScroller } from '@/comps/VerticalScroller.svelte';
  import { ui } from '../states.svelte';
  import QtHelpTocTreeNode from './QtHelpTocTreeNode.svelte';

  const scroller = createVerticalScroller();

  $effect(() => {
    void ui.selectedDoc;
    scroller.scrollToTop({ mode: 'instant' });
  })
</script>

<div
  use:scroller.attach
  class='w-full h-full relative'
>
  <div class='qt-item-list w-full h-full'>
    {#each ui.toc.model.topLevels as node (node.id)}
      <QtHelpTocTreeNode {node} />
    {/each}
  </div>

  {#if scroller.scrolledEnough}
    <div class='absolute right-0 bottom-0 m-[10px]'>
      <ScrollToTopButton onClicked={scroller.scrollToTop} />
    </div>
  {/if}
</div>
