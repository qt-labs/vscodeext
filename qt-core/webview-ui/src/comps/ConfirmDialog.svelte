<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Modal, Button, P } from 'flowbite-svelte';

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

<Modal
  bind:open
  color="none"
  class="qt-popup"
  size="sm"
  classBackdrop="qt-popup-backdrop"
  bodyClass="p-4"
  outsideclose
  on:close={() => {
    onRejected();
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
</Modal>
