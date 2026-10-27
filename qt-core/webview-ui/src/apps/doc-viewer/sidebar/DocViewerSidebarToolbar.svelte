<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import {
    Square,
    TrashIcon,
    SquareMinus,
    SquareCheck
  } from "@lucide/svelte";

  import { data } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';
  import { createCheckState } from "../types.svelte";

  let {
    mode = 'bookmark' as 'bookmark' | 'history'
  } = $props();

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

  function onRemoveClicked() {
    logic.edit({
      action: 'remove',
      selection: $state.snapshot(logic.getSelection())
    });
  }
</script>

<div class='w-full flex items-center gap-2'>
  {@render groupCheckBox()}
  <span class='grow'>{checker.description}</span>
  {@render removeButton()}
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

{#snippet removeButton()}
  <button
    class='qt-button flex items-center justify-center'
    style:visibility={checker.state === 'empty' ? 'hidden' : 'visible'}
    onclick={onRemoveClicked}
  >
    <TrashIcon />
  </button>
{/snippet}
