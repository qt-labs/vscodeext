<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import VirtualList from 'svelte-tiny-virtual-list';
  import { Search, TriangleAlert } from '@lucide/svelte';

  import { createVerticalScroller } from '@/comps/VerticalScroller.svelte';
  import ScrollToTopButton from '@/comps/ScrollToTopButton.svelte';
  import QtHelpBaseView from './QtHelpBaseView.svelte';
  import QtHelpSearchInput from '../others/QtHelpSearchInput.svelte';
  import QtHelpHighlightedText from '../others/QtHelpHighlightedText.svelte';

  import { data, ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  const all = $derived(data.search.result);

  let virtualList = $state<VirtualList>();
  let virtualListHeight = $state(0);
  let inputEl = $state<HTMLInputElement | undefined>();
  const scroller = createVerticalScroller();

  function createEmptyStateData(keyword: string) {
    const init = {
      title: 'Enter a keyword to search',
      help: '',
      icon: Search,
    };

    const noResult = {
      title: `No results for '${keyword}'`,
      help: 'Check the spelling or try another keyword',
      icon: TriangleAlert,
    };

    return keyword ? noResult : init;
  }

  $effect(() => {
    void ui.search.keyword;
    untrack(() => {
      virtualList?.recomputeSizes?.(0);
    });
  })
</script>

<QtHelpBaseView
  mode='text'
  header={header as Snippet}
  content={content as Snippet}
  itemCount={all.length}
  onVisibleChanged={(v: boolean) => {
    if (v) {
      inputEl?.focus();
      inputEl?.select();
    }
  }}
/>

<!-- snippets -->
{#snippet header()}
  <div class='flex flex-row w-full gap-2'>
    <span class='self-center'>Search</span>

    <QtHelpSearchInput
      bind:inputEl={inputEl}
      bind:value={ui.search.keyword}
      placeholder='keyword...'
      onSearch={() => {
        viewlogic.search(ui.search.keyword);
      }}
    />
  </div>
{/snippet}

{#snippet content()}
  <div
    use:scroller.attach
    bind:clientHeight={virtualListHeight}
    class='qt-item-list w-full h-full relative'
  >
    {#if all.length === 0 && !ui.task.busy}
      {@render emptyData()}
    {:else}
      <VirtualList
        bind:this={virtualList}
        height={virtualListHeight}
        scrollDirection='vertical'
        itemCount={all.length}
        itemSize={75}
      >
        {#snippet item({ style, index })}
          {@render _item(style, index)}
        {/snippet}
      </VirtualList>

      {#if scroller.scrolledEnough}
        <ScrollToTopButton onClicked={() => scroller.scrollToTop()} />
      {/if}
    {/if}
  </div>
{/snippet}

{#snippet _item(style: string, index: number)}
  {@const entry = all[index]}
  <button
    {style}
    class='item flex flex-col justify-center'
    class:active={viewlogic.isCurrentDoc(entry)}
    onclick={() => {
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
    <span data-role='empty-help'>{data.help}</span>
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

  [data-role='empty-help'] {
    color: var(--qt-text-muted);
  }
</style>
