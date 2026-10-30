<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';

  import { countAsLocaleString } from '@/utils/format';
  import { ui } from '../states.svelte';
  import type { UiMode } from '../types.svelte';

  let {
    mode = undefined as UiMode | undefined,
    header = undefined as Snippet | undefined,
    content = undefined as Snippet | undefined,
    itemCount = 0,
    onVisibleChanged = (_visible: boolean) => {}
  } = $props();

  const visible = $derived(ui.mode === mode);

  $effect(() => {
    onVisibleChanged(visible);
  });
</script>

<div data-role='area' class='flex flex-col w-full h-full'>
  <div data-role='header'>
    {@render header?.()}
  </div>

  <div data-role='content' class='grow'>
    {@render content?.()}
  </div>

  <span data-role="footer">
    {#if itemCount === 0}
      No items
    {:else}
      Total {countAsLocaleString(itemCount)}
      {itemCount === 1 ? 'item' : 'items'}
    {/if}
  </span>
</div>

<style>
  [data-role='area'] {
    min-height: 0;
    overflow: hidden;
  }

  [data-role='header'] {
    padding: 5px 5px 5px 10px;
    background: var(--qt-bg-subtle);
    border-bottom: 1px solid var(--qt-stroke-subtle);
  }

  [data-role='content'] {
    overflow: auto;
  }

  [data-role='footer'] {
    padding: 5px 10px;
    text-align: right;
    background: var(--qt-bg-subtle);
    border-top: 1px solid var(--qt-stroke-subtle);
  }
</style>
