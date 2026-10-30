<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeft, TriangleAlert } from '@lucide/svelte';

  import { docBrowser as texts } from '@/apps/texts';
  import { ui } from '../states.svelte';
  import * as helpers from '../helpers';
  import * as viewlogic from '../viewlogic.svelte';

  const uri = $derived(helpers.toFileUriIfServer(ui.iframe.uri));
  const keys = new Set(['Backspace', 'Escape', 'Enter', ' ']);

  let backButtonEl: HTMLButtonElement;

  function onKeydown(e: KeyboardEvent) {
    if (!e.repeat && keys.has(e.key)) {
      e.preventDefault();
      backButtonEl?.click();
    }
  }

  onMount(() => {
    window.focus();
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class='w-full h-full flex items-center justify-center'>
  <div data-role='card' class='grid'>
    <TriangleAlert class='large [grid-area:1/1] self-center' />
    <div class='[grid-area:1/2] flex flex-col gap-2'>
      <span data-role='title'>{texts.error.title}</span>
      <span data-role='guide'>{texts.error.guide}</span>
    </div>

    <div class='[grid-area:2/2] flex flex-col gap-4'>
      <div>
        <span>Location:</span>
        <span data-role='url'>{uri}</span>
      </div>
      <div class='flex flex-row justify-end'>
        <button
          bind:this={backButtonEl}
          data-role='back-button'
          data-variant='primary'
          class='qt-button flex flex-row items-center justify-center'
          onclick={() => {
            viewlogic.openDoc(ui.navigation.currentEntry.uri);
          }}
        >
          <ArrowLeft />{texts.error.backButton}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  [data-role='card'] {
    max-width: 450px;
    grid-template-rows: auto auto;
    grid-template-columns: auto 1fr;
    row-gap: 40px;
    column-gap: 25px;
  }

  [data-role='title'] {
    font-size: var(--qt-font-2xl);
  }

  [data-role='guide'] {
    color: var(--qt-text-default)
  }

  [data-role='url'] {
    color: var(--qt-text-muted);
    word-break: break-all;
  }

  [data-role='back-button'] {
    min-width: 120px;
    min-height: 50px;
  }
</style>
