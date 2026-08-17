<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type ExEntry } from '@shared/ex-browser';

  import ExGridViewCard from './ExGridViewCard.svelte';
  import { ui } from '../states.svelte';

  let { examples = [] as ExEntry[] } = $props();
</script>

<div bind:this={ui.grid} data-root class="grid grid-flow-dense gap-[10px]">
  {#each examples as example (example.projectPath)}
    <ExGridViewCard {example} />
  {/each}
</div>

<style>
  [data-root] {
    grid-auto-rows: 232px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
</style>
