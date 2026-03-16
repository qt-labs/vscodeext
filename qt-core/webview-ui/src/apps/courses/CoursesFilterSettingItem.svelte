<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';
  import { Check } from '@lucide/svelte';

  import Row from '@/comps/Row.svelte';

  let {
    pos = 'between' as ('first' | 'between' | 'last'),
    children = undefined as (Snippet | undefined),
    selected = false,
    class: className = '',
    onClicked = (_e: MouseEvent) => {}
  } = $props();

</script>

<button
  class={`
    w-full
    flex flex-row py-2 px-2 qt-button-flat
    ${selected ? '!text-yellow-500' : ''}
    ${pos !== 'first' ? '!rounded-t-none' : ''}
    ${pos !== 'last' ? '!border-b-0 !rounded-b-none' : ''}
    ${className}
  `}
  onclick={(e: MouseEvent) => {
    onClicked(e);
  }}
>
  <Row class='w-full'>
    {#if selected}
      <Check />
    {:else}
      <div class='w-5.5'></div>
    {/if}
    {@render children?.()}
  </Row>
</button>
