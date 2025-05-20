<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Input, Button, Alert } from 'flowbite-svelte';
  import { CircleMinusSolid, InfoCircleOutline } from 'flowbite-svelte-icons';

  let {
    value = $bindable(''),
    onInput,
    level = '',
    message = undefined,
    ...restProps
  } = $props();

  const id = 'input_name';
  let hovered = $state(false);
  let focused = $state(false);
  let hasIssue = $derived(message && message.length > 0);

  export function focus() {
    document.getElementById(id)?.focus();
  }
</script>

<div class="relative">
  {#if hasIssue && (focused || hovered)}
    <Alert
      border
      color="none"
      class="absolute w-full bottom-full -mb-0.5 qt-alert"
    >
      {message}
    </Alert>
  {/if}

  <Input
    {id}
    type="text"
    required
    class={`qt-input ${hasIssue ? 'error' : ''}`}
    bind:value
    onblur={() => {
      focused = false;
    }}
    oninput={onInput}
    onfocus={(e) => {
      (e.target as HTMLInputElement).select();
      focused = true;
    }}
    {...restProps}
  >
    <Button
      slot="right"
      tabindex={-1}
      class={`qt-input-icon ${!hasIssue ? 'hidden' : ''}`}
      on:mouseenter={() => {
        hovered = true;
      }}
      on:mouseleave={() => {
        hovered = false;
      }}
    >
      {#if level === 'error'}
        <CircleMinusSolid />
      {:else}
        <InfoCircleOutline />
      {/if}
    </Button>
  </Input>
</div>
