<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { nanoid } from 'nanoid';
  import { onMount } from 'svelte';
  import { P, Dropdown } from 'flowbite-svelte';

  import { textOrFallback } from '@/utils/utils';
  import type { PickerItem } from './types.svelte';

  let {
    active = false,
    width = -1,
    offset = 1,
    showIcon = true,
    items = [] as PickerItem[],
    currentIndex = -1,
    onRejected = () => {},
    onAccepted = (_: number) => {}
  } = $props();

  const id = `pickerlist_${nanoid()}`;

  function setCurrentIndex(i: number) {
    const candidate = Math.max(0, Math.min(i, items.length - 1));
    if (currentIndex !== candidate) {
      currentIndex = candidate;
    }
  }

  function onItemClicked(i: number) {
    setCurrentIndex(i);
    onAccepted(currentIndex);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onRejected();
    } else if (e.key === 'Enter') {
      onAccepted(currentIndex);
    } else if (e.key === 'ArrowDown') {
      setCurrentIndex((currentIndex + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      setCurrentIndex((currentIndex - 1 + items.length) % items.length);
    } else {
      return;
    }

    e.preventDefault();
  }

  export function focus() {
    requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  }

  onMount(focus);
</script>

<Dropdown
  {id}
  open={active}
  classContainer="qt-picker-list"
  style={`width: ${width - 1}px`}
  {offset}
  tabindex={0}
  onkeydown={onKeyDown}
  onblur={() => {
    onRejected();
  }}
>
  {#each items as item, i (i)}
    <P
      role="option"
      class={`
        flex flex-row gap-2 items-center
        qt-item ${i === currentIndex ? 'selected' : ''}`}
      onclick={() => onItemClicked(i)}
    >
      {#if showIcon}
        {@const IconComp = item.icon}
        {#if IconComp}
          <IconComp class="aspect-square h-5" />
        {:else}
          <div class="aspect-square h-5"></div>
        {/if}
      {/if}
      {textOrFallback(item.text)}
    </P>
  {/each}
</Dropdown>
