<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Dot } from '@lucide/svelte';
  import VirtualList from 'svelte-tiny-virtual-list';

  import ScrollToTopButton from '@/comps/ScrollToTopButton.svelte';
  import { createVerticalScroller } from '@/comps/VerticalScroller.svelte';
  import QtHelpBaseView from './QtHelpBaseView.svelte';
  import QtHelpSearchInput from '../others/QtHelpSearchInput.svelte';
  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';
  import { IndexListItemHeight, type IndexListViewItem } from '../types.svelte';


  const all = $derived(ui.index.model.items);
  let listHeight = $state(0);

  let inputEl = $state(undefined as HTMLInputElement | undefined);
  let hovered = $state<IndexListViewItem | undefined>();
  const scroller = createVerticalScroller();

  function isModuleNameVisible(entry: IndexListViewItem) {
    const n1 = entry.name;
    const n2 = hovered?.name;
    return (n1.length !== 0) && n2 && (n1 == n2);
  }

  $effect(() => {
    void ui.index.filter.keyword;
    untrack(() => {
      ui.index.viewComp?.recomputeSizes?.(0);
    });
  })
</script>

<QtHelpBaseView
  mode='index'
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

{#snippet header()}
  <div class='flex flex-row w-full gap-1.5'>
    <span class='self-center'>Index</span>

    <QtHelpSearchInput
      bind:inputEl={inputEl}
      bind:value={ui.index.filter.keyword}
      placeholder='filter...'
      onSearch={() => {
        viewlogic.invalidateIndexModel();
      }}
    />

    {@render sectionButton()}
  </div>
{/snippet}

{#snippet content()}
  <div class='w-full h-full flex flex-col relative'>
    <div
      use:scroller.attach
      bind:clientHeight={listHeight}
      class='qt-item-list w-full h-full relative'
    >
      <VirtualList
        bind:this={ui.index.viewComp}
        height={listHeight}
        itemCount={all.length}
        itemSize={IndexListItemHeight}
        onAfterScroll={ui.index.viewState.onScrolled}
        scrollOffset={ui.index.viewState.scrollTargetPosition}
        scrollDirection='vertical'
        scrollToAlignment='start'
        scrollToBehaviour='instant'
      >
        {#snippet item({ style, index })}
          {@render _item(style, index)}
        {/snippet}
      </VirtualList>

      {#if scroller.scrolledEnough}
        <ScrollToTopButton onClicked={scroller.scrollToTop} />
      {/if}
    </div>
  </div>
{/snippet}

{#snippet  _item(style: string, index: number)}
  {@const entry: IndexListViewItem = all[index]}
  {#if entry}
    <button
      {style}
      data-role={entry.type}
      data-index={index}
      class='item w-full flex flex-row items-center relative'
      class:active={
        entry.type.endsWith('item') && viewlogic.isCurrentDoc(entry.data)
      }
      onmouseenter={() => (hovered = entry)}
      onmouseleave={() => (hovered = undefined)}
      onclick={() => {
        viewlogic.openHtml(entry.data);
      }}
    >
      <div
        class='w-full h-full flex items-center'
      >
        {#if entry.type === 'grouped-item'}
          <Dot class='shrink-0'/>
        {/if}

        <span class='truncate'>{entry.display}</span>
      </div>

      {#if entry.annotation && !entry.type.includes('header')}
        <span
          data-role='annotation'
          class='qt-absolute-cy'
          style:opacity={isModuleNameVisible(entry) ? 1 : 0}
        >
          {entry.annotation}
        </span>
      {/if}
    </button>
  {/if}
{/snippet}

{#snippet sectionButton()}
  <button
    bind:this={ui.popovers.indexSelector.refEl}
    data-role='section-button'
    class='qt-button flex flex-row items-center'
    disabled={all.length === 0}
    onclick={() => {
      ui.popovers.indexSelector.toggle();
    }}
  >
    {#key ui.index.viewState.currentSection?.letter_uc}
      <span
        data-role='section-name'
        in:fly={{ duration: 300, y: 30, opacity: 0 }}
      >
        {ui.index.viewState.currentSection?.letter_uc ?? '-'}
      </span>
    {/key}
  </button>
{/snippet}

<style>
  .qt-item-list {
    overflow: hidden;
  }

  .item {
    padding: 0px;
  }

  [data-role='section-button'] {
    padding: 0px 10px;
    background: var(--qt-hover-bg);
    border-radius: var(--qt-radius-s);

    &:hover {
      background: var(--qt-button-primary-hover);
    }
  }

  [data-role='section-name'] {
    color: var(--qt-text-default);
    display: inline-block;
    width: 1.2em;
    text-align: center;
    text-transform: uppercase;
  }

  [data-role='item'],
  [data-role='grouped-item'],
  [data-role='group-header'],
  [data-role='section-header'] {
    @apply truncate;
    min-width: 0px;
    text-align: left;
    font-size: var(--qt-font-s);
    color: var(--qt-text-muted);
    padding: 3px 12px;
  }

  [data-role='grouped-item'] {
    padding-left: 15px;
  }

  [data-role='section-header'] {
    color: var(--qt-text-default);
    background: var(--qt-bg-default);
    border: 1px solid var(--qt-stroke-subtle);
    border-left: 0px;
    border-right: 0px;

    &[data-index='0'] {
      border-top: none;
    }
  }

  [data-role='annotation'] {
    right: 0px;
    padding: 0px 5px;
    margin-right: 2px;
    color: var(--qt-text-muted);
    font-size: var(--qt-font-xs);
    background: var(--qt-bg-elevated);
    border: 1px solid var(--qt-stroke-subtle);
    border-radius: var(--qt-radius-s);
    transition: opacity var(--qt-duration-fast);
  }
</style>
