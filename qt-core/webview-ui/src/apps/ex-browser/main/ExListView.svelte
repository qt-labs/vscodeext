<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type ExEntry } from '@shared/ex-browser';
  import ExTagList from '../others/ExTagList.svelte';
  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  let { examples = [] as ExEntry[] } = $props();
</script>

<div bind:this={ui.list} class="flex flex-col gap-[2px]">
  {#each examples as example (example.projectPath)}
    <button
      data-role="item-area"
      class="flex items-center"
      class:selected={example === ui.selected.example}
      onclick={() => {
        viewlogic.selectExample(example);
      }}
    >
      <span data-role="item-name">{example.name}</span>
      {#if example.tags.length}
        <ExTagList usage="list" tags={example.tags} />
      {/if}
      <span data-role="item-category">
        {example.categories.join(', ')}
      </span>
    </button>
  {/each}
</div>

<style>
  [data-role='item-area'] {
    height: 36px;
    padding: 0 10px;
    gap: 10px;
  }

  [data-role='item-category'] {
    color: var(--qt-text-muted);
    margin-left: auto;
    opacity: 0.8;
    font-size: var(--qt-font-2xs);
    font-weight: var(--qt-font-semibold);
    white-space: nowrap;
  }
</style>
