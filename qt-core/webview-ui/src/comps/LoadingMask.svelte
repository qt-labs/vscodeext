<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import P from 'flowbite-svelte/P.svelte';
  import Button from 'flowbite-svelte/Button.svelte';
  import Spinner from 'flowbite-svelte/Spinner.svelte';

  let {
    busy = false,
    error = undefined,
    forceHidden = false,
    busyText = 'Loading...',
    closeText = 'Close',
    backgroundOpacity = 2.5
  } = $props();
</script>

<div
  class:hidden={forceHidden || (!busy && error === undefined)}
  class={`
    flex w-full h-full absolute inset-0
    justify-center items-center qt-border-radius`}
>
  <!-- background with opacity -->
  <div
    class="w-full h-full absolute inset-0"
    style={`background-color: rgba(255,255,255,${backgroundOpacity / 100})`}
  >
  </div>

  <!-- contents -->
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
