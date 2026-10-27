<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import {
    Square,
    TrashIcon,
    SquareMinus,
    SquareCheck,
    ArrowDownAZ
  } from "@lucide/svelte";
  import { data } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';
  import { createCheckState } from "../types.svelte";
    import { tooltip } from "@/utils/actions";

  let {
    mode = 'bookmark' as 'bookmark' | 'history'
  } = $props();

  type ButtonRole = 'sort' | 'remove';

  const bm = $derived(mode === 'bookmark');
  const items = $derived(bm ? data.bookmarks : data.history.raw);
  const logic = $derived(bm ? viewlogic.bookmark : viewlogic.history);
  const checker = $derived(createCheckState(() => items));

  const icons = {
    all: SquareCheck,
    empty: Square,
    partial: SquareMinus,
  } as const;

  function onCheckClicked() {
    logic.setAllChecked((checker.state === 'empty'));
  }

  function onButtonClicked(e: MouseEvent, role: ButtonRole) {
    if (role === 'sort') {
      viewlogic.bookmark.edit({ action: 'sort' });
    } else {
      logic.edit({
        action: 'remove',
        selection: $state.snapshot(logic.getSelection())
      });
    }

    e.stopPropagation();
  }

  function findButtonData(role: ButtonRole) {
    if (role === 'sort') {
      return {
        icon: ArrowDownAZ,
        tooltip: 'Sort',
        enabled: true,
      }
    } else {
      return {
        icon: TrashIcon,
        tooltip: 'Remove selected items',
        enabled: checker.state !== 'empty'
      }
    }
  }
</script>

<div class='w-full flex items-center gap-1'>
  {@render groupCheckBox()}
  <span class='grow'>{checker.description}</span>

  {#if mode === 'bookmark'}
    {@render toolButton('sort')}
  {/if}

  {@render toolButton('remove')}
</div>

<!-- snippets -->
{#snippet groupCheckBox()}
  {@const Icon = icons[checker.state]}
  <button
    type="button"
    aria-label="check"
    onclick={onCheckClicked}
  >
    <Icon />
  </button>
{/snippet}

{#snippet toolButton(role:  ButtonRole)}
  {@const data = findButtonData(role) }
  <button
    use:tooltip={{ text: data.tooltip }}
    class='qt-button flex items-center justify-center'
    disabled={!data.enabled}
    onclick={(e: MouseEvent) => {
      onButtonClicked(e, role);
    }}
  >
    <data.icon />
  </button>
{/snippet}

<style>
  .qt-button {
    height: 28px;
    padding: 5px;

    &:disabled {
      cursor: not-allowed;
      color: var(--qt-text-muted);
      background: color-mix(in srgb, var(--qt-bg-default) 60%, transparent);
    }
  }
</style>
