<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Button } from 'flowbite-svelte';
  import { CheckOutline } from 'flowbite-svelte-icons';

  let {
    id = '',
    text = '',
    icon = CheckOutline,
    flat = false,
    visible = true,
    disabled = false,
    onClicked
  } = $props();
</script>

{#if visible}
  <Button
    {disabled}
    class={`qt-button ${flat ? 'flat' : ''}`}
    on:click={() => {
      onClicked(id);
    }}
  >
    {@const IconComp = icon}
    {#if IconComp}
      <IconComp class="mr-1" />
    {/if}
    {text}
  </Button>
{/if}
