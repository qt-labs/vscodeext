<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { CopyMinus } from '@lucide/svelte';

  import { tooltip } from '@/utils/actions';
  import { qtHelp as texts } from '@/apps/texts';
  import { ui } from '../states.svelte';

  let {
    visible = false,
  } = $props();

  const isCollapsible = $derived(ui.toc.model.expandedState !== 'empty');

  $effect(() => { void visible; });
</script>

<div class='flex flex-row w-full'>
  <span class='items-center self-center'>
    {texts.toc.title}
  </span>

  <div class='grow'></div>

  <button
    use:tooltip={{ text: texts.toc.tooltips.collapseAll }}
    data-role='collapse-button'
    class='qt-button'
    style:visibility={isCollapsible ? 'visible' : 'hidden'}
    disabled={!isCollapsible}
    onclick={() => {
      ui.toc.model.setExpandedAll(false);
    }}
  >
    <CopyMinus />
  </button>
</div>

<style>
  [data-role='collapse-button'] {
    border: none;
    color: var(--qt-text-default);
    background: none;
  }
</style>
