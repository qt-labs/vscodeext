<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Button } from 'flowbite-svelte';

  let {
    items,
    currentIndex = -1,
    onCurrentIndexChanged = null,
    class: className = '',
    buttonClass = ''
  } = $props();

  function setCurrentIndex(i: number) {
    if (i < 0 || i >= items.length) {
      return;
    }

    if (currentIndex !== i) {
      currentIndex = i;

      if (onCurrentIndexChanged) {
        onCurrentIndexChanged(currentIndex);
      }
    }
  }

  $effect(() => {
    if (currentIndex === -1) {
      if (items && items.length > 0) {
        setCurrentIndex(0);
      }
    }
  });
</script>

<div class={`flex flex-col h-full gap-1 ${className}`}>
  {#each items as item, i (i)}
    <Button
      on:click={() => {
        setCurrentIndex(i);
      }}
      class={`
        flex flex-col gap-1
        qt-button${i === currentIndex ? '' : '-contentOnly'}
        ${buttonClass}
      `}
    >
      <item.icon />
      {item.label}
    </Button>
  {/each}
  <div class="flex-grow"></div>
</div>
