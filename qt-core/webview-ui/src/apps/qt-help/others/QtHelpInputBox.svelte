<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { glyphs } from '@/symbols';

  let {
    value = $bindable(''),
    inputEl = $bindable(undefined as HTMLInputElement | undefined),
    disabled = false,
    placeholder = '',
    delay = 200,
    onSearch = (_: string) => {}
  } = $props();

  let timer: ReturnType<typeof setTimeout>;

  function trigger(ms = delay) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      onSearch?.(value);
    }, ms);
  }

  function clear() {
    value = '';
    trigger(0);
    inputEl.focus();
  }

  function selectAll() {
    inputEl.select();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      trigger(0);
      selectAll();
    }
  }
</script>

<div class="w-full relative">
  <div data-role="search-icon" class="qt-absolute-cy">
    {glyphs.search}
  </div>

  <input
    bind:value={value}
    bind:this={inputEl}
    type="text"
    class="qt-input w-full"
    {placeholder}
    {disabled}
    oninput={() => trigger()}
    onfocus={selectAll}
    onkeydown={onKeydown}
  />

  {#if value.trim().length}
    <div data-role='clear-icon' class="qt-absolute-cy">
      <button onclick={clear}>&times;</button>
    </div>
  {/if}
</div>

<style>
  .qt-input {
    height: 28px;
    padding: 0 24px 0 26px;
  }

  [data-role='search-icon'] {
    left: 10px;
    color: var(--qt-text-muted);
    background: none;
    border: none;
    font-size: var(--qt-font-m);
  }

  [data-role='clear-icon'] {
    right: 5px;
    padding: 0px 5px;

    &:hover {
      background: var(--qt-bg-elevated);
    }
  }
</style>
