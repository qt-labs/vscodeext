<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Check } from '@lucide/svelte';

  import * as theme from '@/apps/theme.svelte';

  let {
    badge = '',
    outerCut = '20px',
    innerCut = '19px',
    hoverEffect = 'move-up' as ('none' | 'move-up'),
    borderColor = false,
    borderThickness = 0.8,
    children = undefined as Snippet | undefined,
    class: className = '',
    onClicked = () => {}
  } = $props();

  let hovered = $state(false);

  const opacity = $derived(hovered ? '100%' : '85%');
  const backgroundColor = $derived(borderColor ? theme.qtColors.background : '#999999');
  const foregroundColor = $derived(borderColor ? theme.qtColors.foreground : '#000000');

  function createQtShapePath(size: string) {
    return `polygon(
      ${size} 0,
      100% 0,
      100% calc(100% - ${size}),
      calc(100% - ${size}) 100%,
      0 100%,
      0 ${size}
    );`
  }
</script>

<button
  class={`
    qt-surface !border-none relative group
    transition-all duration-150 ease-out
    ${hoverEffect === 'move-up' ? 'hover:-translate-y-3' : ''}
    ${className}
  `}
  style:padding={`calc(var(--spacing) * ${borderThickness})`}
  style:clip-path={createQtShapePath(outerCut)}
  style:background-color={backgroundColor}
  onmouseenter={() => { hovered = true; }}
  onmouseleave={() => { hovered = false; }}
  onclick={() => {
    onClicked();
  }}
>
  <div
    class='w-full h-full'
    style:clip-path={createQtShapePath(innerCut)}
  >
    {@render children?.()}

    {#if badge.length !== 0}
      <div
        class={`
          absolute right-0 top-0 py-2 px-3 rounded-bl-2xl
          flex flex-row gap-1.5
        `}
        style:opacity={opacity}
        style:color={foregroundColor}
        style:background-color={backgroundColor}
      >
        <Check />
        {badge}
      </div>
    {/if}
  </div>
</button>

