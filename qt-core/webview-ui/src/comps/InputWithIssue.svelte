<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { nanoid } from 'nanoid';
  import { Input, Button, Alert } from 'flowbite-svelte';
  import { CircleMinusSolid, InfoCircleOutline } from 'flowbite-svelte-icons';

  let {
    value = $bindable(''),
    level = '',
    message = undefined as string | undefined,
    alertPosition = 'top' as 'top' | 'bottom',
    class: className = '',
    onInput,
    onEnter = () => {},
    ...restProps
  } = $props();

  const id = `input_${nanoid()}`;
  let hovered = $state(false);
  let focused = $state(false);
  let hasIssue = $derived(message !== undefined && message.length > 0);

  export function focus() {
    document.getElementById(id)?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      onEnter();
    }
  }
</script>

<div class="relative">
  {#if hasIssue && (focused || hovered)}
    <Alert
      border
      color="none"
      class={`qt-alert absolute w-full z-1
        ${alertPosition === 'top' ? 'bottom-full -mb-0.5' : 'top-full -mt-0.5'}
      `}
    >
      {message}
    </Alert>
  {/if}

  <Input
    {id}
    type="text"
    class={`qt-input ${hasIssue ? 'error' : ''} ${className}`}
    bind:value
    onblur={() => {
      focused = false;
    }}
    oninput={onInput}
    onfocus={(e) => {
      (e.target as HTMLInputElement).select();
      focused = true;
    }}
    on:keydown={onKeyDown}
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
