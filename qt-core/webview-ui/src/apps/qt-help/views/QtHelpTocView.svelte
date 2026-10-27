<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';
  import { SquareMinus } from '@lucide/svelte';

  import ScrollToTopButton from '@/comps/ScrollToTopButton.svelte';
  import { createVerticalScroller } from '@/comps/VerticalScroller.svelte';
  import QtHelpBaseView from './QtHelpBaseView.svelte';
  import QtHelpTocTreeNode from './QtHelpTocTreeNode.svelte';
  import { data, ui } from '../states.svelte';
    import { tooltip } from '@/utils/actions';

  const scroller = createVerticalScroller();
  const isCollapsible = $derived(ui.tocModel.expandedState !== 'empty');
</script>

<QtHelpBaseView
  mode='toc'
  header={header as Snippet}
  content={content as Snippet}
  itemCount={data.toc.length}
/>

<!-- snippets -->
{#snippet header()}
  <div class='flex flex-row w-full'>
    <span class='items-center self-center'>
      Table of contents
    </span>

    <div class='grow'></div>

    <button
      use:tooltip={{ text: 'Collapse all' }}
      data-role='collapse-button'
      class='qt-button'
      style:visibility={isCollapsible ? 'visible' : 'hidden'}
      disabled={!isCollapsible}
      onclick={() => {
        ui.tocModel.setExpandedAll(false);
      }}
    >
      <SquareMinus />
    </button>
  </div>
{/snippet}

{#snippet content()}
  <div
    use:scroller.attach
    class='w-full h-full relative'
  >
    <div class='qt-item-list w-full h-full'>
      {#each ui.tocModel.topLevels as node (node.id)}
        <QtHelpTocTreeNode {node} />
      {/each}
    </div>

    {#if scroller.scrolledEnough}
      <ScrollToTopButton onClicked={() => scroller.scrollToTop()} />
    {/if}
  </div>
{/snippet}

<style>
  [data-role='collapse-button'] {
    border: none;
    color: var(--qt-text-muted);
    background: none;
  }
</style>
