<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { untrack } from 'svelte';
  import VirtualList from 'svelte-tiny-virtual-list';
  import { Search, TriangleAlert } from '@lucide/svelte';

  import { qtHelp as texts } from '@/apps/texts';
  import { createVerticalScroller } from '@/comps/VerticalScroller.svelte';
  import ScrollToTopButton from '@/comps/ScrollToTopButton.svelte';
  import QtHelpHighlightedText from '../others/QtHelpHighlightedText.svelte';

  import { data, ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  const all = $derived(data.search.result);

  let listComp = $state<VirtualList>();
  let listHeight = $state(0);
  const scroller = createVerticalScroller();

  function createEmptyStateData(keyword: string) {
    const init = (keyword.trim().length === 0);
    const source = init
      ? texts.search.empty.default
      : texts.search.empty.noResult;

    return {
      title: source.title(keyword),
      guide: source.guide,
      icon: init ? Search : TriangleAlert
    }
  }

  $effect(() => {
    void ui.search.keyword;
    untrack(() => {
      listComp?.recomputeSizes?.(0);
    });
  })

  $effect(() => {
    void ui.selectedDoc;
    scroller.scrollToTop({ mode: 'instant' });
  })
</script>

<div
  use:scroller.attach
  bind:clientHeight={listHeight}
  class='qt-item-list w-full h-full relative'
>
  {#if all.length === 0 && !ui.task.busy}
    {@render emptyData()}
  {:else}
    <VirtualList
      bind:this={listComp}
      height={listHeight}
      scrollDirection='vertical'
      itemCount={all.length}
      itemSize={75}
    >
      {#snippet item({ style, index })}
        {@render _item(style, index)}
      {/snippet}
    </VirtualList>

    {#if scroller.scrolledEnough}
      <div class='absolute right-0 bottom-0 m-[10px]'>
        <ScrollToTopButton onClicked={scroller.scrollToTop} />
      </div>
    {/if}
  {/if}
</div>

{#snippet _item(style: string, index: number)}
  {@const entry = all[index]}
  <button
    {style}
    class='item flex flex-col justify-center'
    class:active={ui.search.selected === entry}
    onclick={() => {
      ui.search.selected = entry;
      viewlogic.openHtml(entry);
    }}
  >
    <span data-role='title'>
      <QtHelpHighlightedText
        text={entry.title}
        keyword={data.search.searchedKeyword}
      />
    </span>

    <span data-role='detail'>
      <QtHelpHighlightedText
        text={entry.snippet}
        keyword={data.search.searchedKeyword}
        variant='underline'
      />
    </span>
  </button>
{/snippet}

{#snippet emptyData()}
  {@const data = createEmptyStateData(ui.search.keyword.trim())}
  <div data-role='empty-panel' class='w-full h-full flex flex-col'>
    <div data-role='empty-title' class='flex gap-2'>
      <data.icon />
      <span>{data.title}</span>
    </div>
    <span data-role='empty-guide'>
      {data.guide}
    </span>
  </div>
{/snippet}

<style>
  .qt-item-list {
    overflow: hidden;

    & .item {
      border-bottom: 1px solid var(--qt-stroke-subtle);
    }
  }

  [data-role='title'] {
    @apply truncate text-left;
    color: var(--qt-text-default);
  }

  [data-role='detail'] {
    @apply line-clamp-2 text-left;
    @apply whitespace-normal break-all;
    opacity: 0.5;
    color: var(--qt-text-muted);
  }

  [data-role='empty-panel'] {
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  [data-role='empty-title'] {
    padding: 0 30px 0 30px;
    white-space: normal;
    word-break: break-all;
    color: var(--qt-text-default);
  }

  [data-role='empty-guide'] {
    color: var(--qt-text-muted);
  }
</style>
