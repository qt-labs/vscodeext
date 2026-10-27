<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Component } from 'svelte';

  import LoadingMask from '@/comps/LoadingMask.svelte';
  import QtHelpTocView from '../views/QtHelpTocView.svelte';
  import QtHelpIndexView from '../views/QtHelpIndexView.svelte';
  import QtHelpSearchResultView from '../views/QtHelpSearchResultView.svelte';
  import QtHelpSidebarToolbar from './QtHelpSidebarToolbar.svelte';
  import { ui } from '../states.svelte';
  import { isUiTaskName, type UiMode } from '../types.svelte';

  const busyText = $derived.by(() => {
    const name_s = ui.task.recentOptions?.name ?? '';
    if (isUiTaskName(name_s) && (name_s === 'search')) {
      return 'Searching...';
    }

    return 'Loading...';
  })
</script>

<div data-role='view' class="h-full flex flex-col select-none">
  <QtHelpSidebarToolbar />

  <div class='w-full h-full flex flex-row overflow-hidden relative'>
    {@render layer('toc', QtHelpTocView)}
    {@render layer('text', QtHelpSearchResultView)}
    {@render layer('index', QtHelpIndexView)}

    {#if ui.task.busy}
      <LoadingMask
        busy={true}
        error={ui.task.error}
        direction='col'
        busyText={busyText}
        forceHidden={ui.task.isDebouncing}
      />
    {/if}
  </div>
</div>

<!-- snippets -->
{#snippet layer(mode: UiMode, Comp: Component)}
  <div
    class='absolute min-h-0 overflow-hidden w-full h-full'
    style:visibility={ui.mode === mode ? 'visible' : 'hidden'}
  >
    <Comp />
  </div>
 {/snippet}

<style>
  [data-role='view'] {
    background: var(--qt-bg-subtle);
    border-right: 1px solid var(--qt-stroke-subtle);
  }
</style>
