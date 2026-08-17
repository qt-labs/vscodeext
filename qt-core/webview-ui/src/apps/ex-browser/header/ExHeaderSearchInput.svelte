<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { glyphs } from '@/symbols';
  import { exBrowser as texts } from '@/apps/texts';

  import ExCloseButton from '../others/ExCloseButton.svelte';
  import { data, ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  let value = $derived(ui.filter.searchInput);
  let timer: ReturnType<typeof setTimeout>;

  const placeholder = $derived.by(() => {
    if (
      !ui.filter.category ||
      !ui.filter.category.name ||
      ui.filter.category.type === 'all'
    ) {
      return texts.searchBox.defaultPlaceholder;
    }

    return texts.searchBox.placeholder(ui.filter.category.name);
  });

  function clear() {
    value = '';
    triggerUpdate(0);
  }

  function triggerUpdate(delay = 200) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      viewlogic.setSearchInput(value);
    }, delay);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      triggerUpdate(0);
    }
  }
</script>

<div class="w-full relative">
  <div data-role="search-icon" class="qt-absolute-cy left-[12px]">
    {glyphs.search}
  </div>

  <input
    bind:value
    bind:this={ui.filter.searchInputEl}
    type="text"
    class="qt-input w-full"
    {placeholder}
    disabled={data.packages.length === 0}
    oninput={() => {
      triggerUpdate(200);
    }}
    onkeydown={onKeydown}
  />

  {#if value.trim().length}
    <div class="qt-absolute-cy right-[5px]">
      <ExCloseButton onClicked={() => clear()} />
    </div>
  {/if}
</div>

<style>
  .qt-input {
    height: 28px;
    padding: 0 26px 0 29px;
  }

  [data-role='search-icon'] {
    color: var(--qt-text-muted);
    background: none;
    border: none;
    font-size: var(--qt-font-m);
  }
</style>
