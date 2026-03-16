<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { Snippet, Component } from 'svelte';
  import { Check } from '@lucide/svelte';

  let {
    icon = Check as (Component | null),
    text = '',
    highlightText = false,
    children = undefined as Snippet | undefined,
    class: className = '',
    style = '',
    iconClass = '',
    textClass = ''
  } = $props();

  const IconComp = $derived(icon);
</script>

<div
  class={`flex flex-row gap-2 items-center ${className}`}
  {style}
>
  {#if icon !== undefined}
    <IconComp class={`shrink-0 ${iconClass}`}/>
  {/if}

  {#if text}
    <div class={`qt-label ${highlightText ? 'highlight' : ''} ${textClass}`}>
      {text}
    </div>
  {:else}
    {@render children?.()}
  {/if}
</div>
