<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Component } from 'svelte';
  import {
    Book,
    ListOrdered,
    Search,
    ChevronDown
  } from '@lucide/svelte';

  import { tooltip } from '@/utils/actions';
  import { ui } from '../states.svelte';
  import { type UiMode } from '../types.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  const version = $derived(ui.selected.package?.version);
  const tooltips: Record<UiMode, string> = {
    toc: 'Browse by table of contents',
    text: 'Search the full text',
    index: 'Look up by keyword index',
  };
</script>

<div data-area='toolbar' class='flex flex-row gap-2'>
  <button
    bind:this={ui.popovers.qtVersions.refEl}
    class='qt-button flex flex-row !h-full justify-center !px-3'
    onclick={(e: MouseEvent) => {
      ui.popovers.qtVersions.toggle();
      e.stopPropagation();
    }}
  >
    {version ? 'Qt-' + version : '-'} <ChevronDown />
  </button>

  <div class='grow'></div>
  <div class='flex flex-row gap-0'>
    {@render modeButton('toc', Book)}
    {@render modeButton('text', Search)}
    {@render modeButton('index', ListOrdered)}
  </div>
</div>

<!-- snippets -->
{#snippet modeButton(mode: UiMode, Icon: Component)}
  <button
    use:tooltip={{ text: tooltips[mode], placement: 'bottom'}}
    data-role='mode-button'
    class='qt-button flex flex-row self-center'
    aria-pressed={ui.mode === mode}
    onclick={() => {
      viewlogic.setMode(mode);
    }}
  >
    <div class='flex w-full justify-center align-center self-center'>
      <Icon />
    </div>
  </button>
{/snippet}

<style>
  [data-area='toolbar'] {
    padding: 7px;
    background: var(--qt-bg-editor-tab);
    border-bottom: 1px solid var(--qt-stroke-subtle);
  }

  .qt-button {
    height: 28px;
    padding: 5px;
  }

  .qt-button[data-role='mode-button'] {
    width: 32px;
    height: 100%;

    &:hover {
      color: var(--qt-text-default);
      background: var(--qt-hover-bg);
    }

    &[aria-pressed='true'] {
      color: var(--qt-accent-active);
      background: var(--qt-accent-blue-default);
    }

    &:has(+ &) {
      border-right: none;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    & + & {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }
</style>

