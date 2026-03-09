<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Button from 'flowbite-svelte/Button.svelte';
  import P from 'flowbite-svelte/P.svelte';

  let {
    open = $bindable(true),
    text = '<Title>',
    acceptText = '<Accept>',
    rejectText = '<Reject>',
    onAccepted = () => {},
    onRejected = () => {}
  } = $props();

  function onAcceptClicked() {
    open = false;
    onAccepted();
  }

  function onRejectClicked() {
    open = false;
    onRejected();
  }
</script>

<button
  class="qt-popup-backdrop fixed inset-0 flex items-center justify-center"
  onclick={(e) => {
    if (e.target === e.currentTarget) {
      onRejectClicked();
    }
  }}
>
  <div
    class="qt-popup w-[450px] absolute flex flex-col p-4"
    onclose={() => {
      onRejectClicked();
    }}
  >
    <P class="qt-label dialog pb-3">{text}</P>

    <div class="flex flex-row gap-2 mt-5">
      <div class="grow"></div>
      <Button class="qt-button" on:click={onRejectClicked}>
        {rejectText}
      </Button>
      <Button class="qt-button" on:click={onAcceptClicked}>
        {acceptText}
      </Button>
    </div>
  </div>
</button>
