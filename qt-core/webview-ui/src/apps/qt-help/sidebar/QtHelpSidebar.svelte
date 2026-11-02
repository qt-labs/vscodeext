<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import LoadingMask from '@/comps/LoadingMask.svelte';
  import { qtHelp as texts } from '@/apps/texts';

  import QtHelpSidebarView from './QtHelpSidebarView.svelte';
  import QtHelpSidebarToolbar from './QtHelpSidebarToolbar.svelte';
  import { ui } from '../states.svelte';
  import { isUiTaskName, type UiMode } from '../types.svelte';

  const busyText = $derived.by(() => {
    const name_s = ui.task.recentOptions?.name ?? '';
    return (isUiTaskName(name_s) && (name_s === 'search'))
      ? texts.busy.search
      : texts.busy.loading;
  })
</script>

<div data-role='view' class="h-full flex flex-col select-none">
  <QtHelpSidebarToolbar />

  <div class='w-full h-full flex flex-row overflow-hidden relative'>
    {@render layer('toc')}
    {@render layer('index')}
    {@render layer('search')}

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
{#snippet layer(mode: UiMode)}
  <div
    class='absolute min-h-0 overflow-hidden w-full h-full'
    style:visibility={ui.mode === mode ? 'visible' : 'hidden'}
  >
    <QtHelpSidebarView {mode} />
  </div>
 {/snippet}

<style>
  [data-role='view'] {
    background: var(--qt-bg-subtle);
    border-right: 1px solid var(--qt-stroke-subtle);
  }
</style>
