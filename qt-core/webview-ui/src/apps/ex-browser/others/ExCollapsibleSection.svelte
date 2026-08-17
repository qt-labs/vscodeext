<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';
  import { icons } from '@/symbols';

  let {
    title = '',
    count = 0,
    expanded = $bindable(true),
    children = undefined as Snippet | undefined
  } = $props();
</script>

<div data-root class="flex flex-col">
  <button
    data-header
    class="sticky flex flex-row items-center"
    onclick={() => {
      expanded = !expanded;
    }}
  >
    <span
      data-chevron
      style:transform={expanded ? 'rotate(90deg)' : 'rotate(0deg)'}
    >
      <icons.ChevronRight size={16} />
    </span>
    <span data-role="section-title" class="flex-1">{title}</span>
    <span data-role="section-count">{count}</span>
  </button>

  {#if expanded}
    {@render children?.()}
  {/if}
</div>

<style>
  [data-root] {
    gap: 10px;
  }

  [data-role='section-title'] {
    font-size: var(--qt-font-xs);
    font-weight: var(--qt-font-semibold);
    text-align: start;
    text-transform: uppercase;
    letter-spacing: 0.06em;

    &:hover {
      color: var(--qt-text-default);
    }
  }

  [data-role='section-count'] {
    font-size: var(--qt-font-2xs);
    font-variant-numeric: tabular-nums;
  }

  [data-header] {
    top: 0;
    z-index: 1;
    padding: 5px 0px;
    margin-top: 16px;

    color: var(--qt-text-muted);
    background: var(--qt-bg-default);
    border-bottom: 1px solid var(--qt-stroke-subtle);

    gap: 7px;
    cursor: pointer;

    & > [data-chevron] {
      transition: transform var(--qt-duration-normal);
    }
  }
</style>
