<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Button from 'flowbite-svelte/Button.svelte';
  import { ChevronRight, Search, X, Tag } from '@lucide/svelte';

  import IconButton from '@/comps/IconButton.svelte';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { exBrowser as texts } from '@/apps/texts';

  let value = $derived(ui.filter.query);
  let timer: ReturnType<typeof setTimeout>;

  const SearchOrX = $derived(value.trim().length === 0 ? Search : X);
  const hasValidSelection = $derived.by(() => {
    return (ui.selected.package?.name ?? '')
      && (ui.filter.category?.name ?? '');
  });

  const placeholder = $derived.by(() => {
    if (!ui.filter.category
      || !ui.filter.category.name
      || ui.filter.category.type === 'all') {
      return texts.searchBox.defaultPlaceholder;
    }

    return texts.searchBox.placeholder(ui.filter.category.name);
  });

  function clear() {
    value = '';
    triggerUpdate(0);
  }

  function triggerUpdate(delay = 500) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      viewlogic.setQuery(value);
    }, delay);
  }

  function onKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Enter':
        triggerUpdate(0);
        viewlogic.setOverlayVisible('tagCloud', false);
        break;

      case ' ':
      case 'Escape':
      case 'Backspace':
        viewlogic.setOverlayVisible('tagCloud', false);
        break;

      case '#':
        viewlogic.setOverlayVisible('tagCloud', true);
        break;
    }
  }

  function onFocusIn() {
    viewlogic.setOverlayVisible('catalog', false);
  }

  $effect(() => {
    value = ui.filter.query;
  })
</script>

<div class="w-full flex flex-row gap-2">
  {@render CatalogButton()}
  {@render TagCloudButton()}
  {@render KeywordInput()}
</div>

<!-- snippets -->
{#snippet CatalogButton()}
  <Button
    class={`
      ${ui.overlays.catalog.visible ? 'qt-button' : 'qt-button-flat'}
      flex flex-row gap-2 items-center whitespace-nowrap
    `}
    disabled={data.packages.length === 0}
    onclick={() => {
      viewlogic.setOverlayVisible('catalog', !ui.overlays.catalog.visible);
    }}
  >
    {#if data.packages.length === 0 || !hasValidSelection}
      -
    {:else}
      <div class='flex flex-row gap-1.5 items-center'>
        <p>C++</p>
        <ChevronRight />
        <p>{ui.selected.package?.name ?? ''}</p>
        <ChevronRight />
        <p>{ui.filter.category?.name ?? ''}</p>
      </div>
    {/if}
  </Button>
{/snippet}

{#snippet TagCloudButton()}
  <IconButton
    flat={!ui.overlays.tagCloud.visible}
    square
    icon={Tag}
    disabled={(ui.filter.category?.tags.length ?? 0) === 0}
    onClicked={(_: unknown, e: MouseEvent) => {
      ui.overlays.tagCloud.refRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      viewlogic.setOverlayVisible('tagCloud', !ui.overlays.tagCloud.visible);
    }}
  />
{/snippet}

{#snippet KeywordInput()}
  <div class={`
    relative w-full h-full flex-grow flex flex-row items-center gap-2
  `}>
    <button
      class='absolute left-4 top-1/2 -translate-y-1/2'
      disabled={data.packages.length === 0}
      onclick={clear}
    >
      <SearchOrX />
    </button>

    <input
      bind:value
      type="text"
      class='qt-input w-full h-full !pl-12'
      {placeholder}
      disabled={data.packages.length === 0}
      oninput={() => { triggerUpdate(500); }}
      onkeydown={onKeydown}
      onfocusin={onFocusIn}
    />
  </div>
{/snippet}
