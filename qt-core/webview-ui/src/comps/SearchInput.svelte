<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Search, X } from '@lucide/svelte';

  let {
    value = $bindable(''),
    disabled = false,
    placeholder = '',
    acceptDelay = 500,
    class: className = '',
    inputClass = '',
    onAcceptTriggered = (_value: string) => {},
    onFocusIn = () => {},
    onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        triggerAccept(0);
      }
    },
  } = $props();

  let timerId: ReturnType<typeof setTimeout>;
  const SearchOrX = $derived(value.trim().length === 0 ? Search : X);

  function clear() {
    value = '';
    triggerAccept(0);
  }

  function triggerAccept(delay_ms: number) {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      onAcceptTriggered(value);
    }, delay_ms);
  }

  onDestroy(() => {
    clearTimeout(timerId);
  })

</script>

<div class={`relative flex-grow flex flex-row items-center ${className}`}>
  <button
    class='absolute left-4 top-1/2 -translate-y-1/2'
    {disabled}
    onclick={clear}
  >
    <SearchOrX />
  </button>

  <input
    bind:value
    type="text"
    class={`qt-input w-full h-full !pl-12 ${inputClass}`}
    {disabled}
    {placeholder}
    oninput={() => {
      triggerAccept(acceptDelay);
    }}

    onkeydown={(e: KeyboardEvent) => {
      onKeyDown(e);
    }}

    onfocusin={() => {
      onFocusIn();
    }}
  />
</div>
