<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { nanoid } from 'nanoid';

  let {
    value = $bindable(''),
    level = '',
    message = undefined as string | undefined,
    onInput = () => {},
    onEnter = () => {},
    ...restProps
  } = $props();

  const id = `input_${nanoid()}`;
  let focused = $state(false);
  let forceShowAlert = $state(false);
  let hasIssue = $derived(message !== undefined && message.length > 0);

  export function focus() {
    document.getElementById(id)?.focus();
  }

  function onFocusChange(e: FocusEvent) {
    focused = e.type === 'focus';
    if (e.type === 'focus') {
      (e.target as HTMLInputElement).select();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      onEnter();
    }
  }

  function onHoverEvent(e: MouseEvent) {
    forceShowAlert = e.type === 'mouseenter';
  }
</script>

<div class="w-full relative">
  {#if hasIssue && (focused || forceShowAlert)}
    <div
      data-role="alert-message"
      data-validation={level}
      class="qt-alert w-full absolute top-full z-10"
    >
      {message}
    </div>
  {/if}

  <input
    {id}
    bind:value
    type="text"
    class="qt-input w-full"
    data-validation={level}
    onblur={onFocusChange}
    onfocus={onFocusChange}
    onmouseenter={onHoverEvent}
    onmouseleave={onHoverEvent}
    oninput={() => {
      onInput();
    }}
    onkeydown={onKeyDown}
    {...restProps}
  />
</div>

<style>
  .qt-input {
    height: 28px;
    padding: 0px 6px;

    &[data-validation='error'],
    &[data-validation='warning'] {
      padding-right: 25px;
    }
  }

  [data-role='alert-message'] {
    padding: 5px;
    margin: -2px 0 0 0;
    opacity: 0.9;
  }
</style>
