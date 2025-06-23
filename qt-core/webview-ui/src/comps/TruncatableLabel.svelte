<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  let {
    text = '',
    truncated = $bindable(false),
    class: className = ''
  } = $props();

  let el: HTMLDivElement;

  function updateFlag() {
    truncated = el && el.scrollWidth > el.clientWidth;
  }

  $effect(() => {
    updateFlag();
  });

  onMount(() => {
    updateFlag();
    window.addEventListener('resize', updateFlag);
  });

  onDestroy(() => {
    window.removeEventListener('resize', updateFlag);
  });
</script>

<div bind:this={el} class={`truncate ${className}`}>
  {text}
</div>
