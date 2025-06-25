<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { Modal, Button, P } from 'flowbite-svelte';

  import InputWithIssue from './InputWithIssue.svelte';

  let {
    open = $bindable(true),
    text = '<Title>',
    acceptText = '<Accept>',
    rejectText = '<Reject>',
    value = $bindable(''),
    level = '',
    message = undefined as string | undefined,
    acceptOnEnter = false,
    onReady = () => {},
    onInput = () => {},
    onAccepted = (_: string) => {},
    onRejected = () => {}
  } = $props();

  let inputComp: InputWithIssue | undefined;
  let acceptable = $derived(level !== 'error');

  function onAcceptClicked() {
    open = false;
    onAccepted(value);
  }

  function onRejectClicked() {
    open = false;
    onRejected();
  }

  function onEnter() {
    if (acceptOnEnter) {
      onAcceptClicked();
    }
  }

  onMount(() => {
    onReady();
    setTimeout(() => {
      inputComp?.focus();
    }, 0);
  });
</script>

<Modal
  bind:open
  color="none"
  class="qt-popup"
  size="sm"
  classBackdrop="qt-popup-backdrop"
  bodyClass="p-4"
  outsideclose
  on:close={() => {
    onRejectClicked();
  }}
>
  <P class="qt-label dialog pb-3">{text}</P>

  <div class="flex flex-col gap-2">
    <InputWithIssue
      bind:this={inputComp}
      bind:value
      {level}
      {message}
      alertPosition="bottom"
      {onInput}
      {onEnter}
    />

    <div class="flex flex-row gap-2">
      <div class="grow"></div>
      <Button class="qt-button-flat min-w-[75px]" on:click={onRejectClicked}>
        {rejectText}
      </Button>
      <Button
        class="qt-button min-w-[75px]"
        disabled={!acceptable}
        on:click={onAcceptClicked}
      >
        {acceptText}
      </Button>
    </div>
  </div>
</Modal>
