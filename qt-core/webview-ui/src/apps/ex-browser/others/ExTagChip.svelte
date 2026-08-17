<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { glyphs } from '@/symbols';

  let {
    text = '',
    variant = '' as '' | 'outline' | 'selected',
    decorate = false,
    onClicked = (_: MouseEvent) => {}
  } = $props();
</script>

{#if text.length > 0}
  <button
    data-root
    data-variant={variant}
    class="inline-flex"
    onclick={(e: MouseEvent) => {
      onClicked(e);
    }}
  >
    {#if !decorate}
      <span data-role="name">{text}</span>
    {:else}
      <span data-role="hash">#</span>
      <span data-role="name">{text}</span>
      <span data-role="close">{glyphs.multiplication}</span>
    {/if}
  </button>
{/if}

<style>
  [data-root] {
    height: 20px;
    padding: 0 6px;
    border-radius: var(--qt-radius-s);
    background: var(--qt-bg-input);
    color: var(--qt-text-muted);
    border: 1px solid transparent;
    font-size: var(--qt-font-2xs);
    font-weight: var(--qt-font-semibold);
    line-height: 12px;
    font-family: inherit;
    letter-spacing: 0;
    white-space: nowrap;
    text-decoration: none;
    align-items: center;
    cursor: pointer;
    transition-property: background, border-color, color;
    transition-duration: var(--qt-duration-fast);
    gap: 4px;

    &:hover {
      background: var(--qt-hover-bg);
      color: var(--qt-text-default);
    }

    &[data-variant='outline'] {
      background: transparent;
      border: 1px solid var(--qt-stroke-muted);
      color: var(--qt-text-muted);

      &:hover {
        background: var(--qt-hover-bg);
        border: 1px solid var(--qt-text-default);
        color: var(--qt-text-default);
      }
    }

    &[data-variant='selected'] {
      background: var(--qt-accent-blue-muted);
      border-color: var(--qt-accent-blue-default);
      color: var(--qt-accent-active);

      &:hover {
        background: var(--qt-accent-blue-default);
      }
    }
  }

  [data-role='hash'],
  [data-role='close'] {
    opacity: 0.6;
  }
</style>
