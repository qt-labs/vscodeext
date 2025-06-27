<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { P, Button, Spinner } from 'flowbite-svelte';

  let {
    busy = false,
    error = undefined,
    forceHidden = false,
    busyText = 'Loading...',
    closeText = 'Close'
  } = $props();
</script>

<div
  class:hidden={forceHidden || (!busy && error === undefined)}
  class={`
    flex w-full h-full absolute inset-0
    bg-white/10 justify-center items-center qt-border-radius`}
>
  {#if busy}
    <div class="flex w-full justify-center items-center gap-6">
      <Spinner class="qt-spinner" size="20" color="custom" />
      <P class="qt-spinner-text">{busyText}</P>
    </div>
  {:else if error}
    <div class="flex flex-col gap-4">
      <P>{error}</P>
      <Button
        class="qt-button mx-auto"
        on:click={() => {
          forceHidden = true;
        }}
      >
        {closeText}</Button
      >
    </div>
  {/if}
</div>
