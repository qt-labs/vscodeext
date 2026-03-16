<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Component } from 'svelte';
  import { ChevronDown } from '@lucide/svelte';
  import { textOrFallback } from '@/utils/utils';

  let {
    text = '-',
    icon = undefined as (Component | undefined),
    active = false,
    disabled = false,
    class: className = '',
    onTriggered = (_: DOMRect) => {}
  } = $props();

  let el: HTMLButtonElement;
  const Icon = $derived(icon);

  function onClicked(_: MouseEvent) {
    onTriggered(el.getBoundingClientRect());
  }
</script>

<button
  class={`
    w-full flex items-center gap-2
    qt-picker-trigger ${active ? 'active' : ''}
    ${disabled ? '!cursor-not-allowed' : ''}
    ${className}
  `}
  bind:this={el}
  {disabled}
  onclick={onClicked}
>
  {#if Icon}
    <Icon class='shrink-0' />
  {/if}

  <p class={`text-left truncate grow ${disabled ? 'dimmed' : ''}`}>
    {textOrFallback(text)}
  </p>
  <ChevronDown class="w-4 h-4" />
</button>
