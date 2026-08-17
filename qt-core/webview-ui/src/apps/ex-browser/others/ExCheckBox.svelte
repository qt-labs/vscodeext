<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Check } from '@lucide/svelte';

  let {
    text = '',
    checked = $bindable(false),
    onClicked = (_: boolean) => {}
  } = $props();
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  data-root
  class="flex flex-row items-center"
  onclick={() => {
    checked = !checked;
    onClicked(checked);
  }}
>
  <div data-role="icon" data-checked={checked} class="qt-checkbox flex">
    {#if checked}
      <Check size={12} />
    {/if}
  </div>

  <span data-role="text">{text}</span>
</button>

<style>
  [data-root] {
    gap: 6px;
    cursor: pointer;
    font-size: var(--qt-font-s);

    &:hover {
      [data-role='icon'] {
        background: var(--qt-accent-info);
        border-color: var(--qt-accent-info);
      }

      [data-role='text'] {
        color: var(--qt-text-default);
      }
    }
  }

  [data-role='icon'] {
    width: 16px;
    height: 16px;
    padding: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--qt-stroke-muted);
    border-radius: var(--qt-radius-s);
  }

  [data-role='text'] {
    color: var(--qt-text-muted);
  }
</style>
