<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';

  import { qtHelp as texts } from '@/apps/texts';
  import QtHelpInputBox from '../others/QtHelpInputBox.svelte';
  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  let {
    visible = false
  } = $props();

  const all = $derived(ui.index.model.items);
  let inputEl = $state<HTMLInputElement>();

  $effect(() => {
    void ui.index.filter;
    untrack(() => {
      ui.index.viewComp?.recomputeSizes?.(0);
    });
  });

  $effect(() => {
    if (visible) {
      inputEl?.focus();
      inputEl?.select();
    }
  })
</script>

<div class='flex flex-row w-full gap-1.5'>
  <span class='self-center'>
    {texts.index.title}
  </span>

  <QtHelpInputBox
    bind:inputEl={inputEl}
    bind:value={ui.index.filter}
    placeholder={texts.index.placeholder}
    onSearch={() => {
      viewlogic.invalidateIndexModel();
    }}
  />

  {@render sectionButton()}
</div>

<!-- snippets -->
{#snippet sectionButton()}
  <button
    bind:this={ui.popovers.indexSelector.refEl}
    data-role='section-button'
    class='qt-button flex flex-row items-center'
    disabled={all.length === 0}
    onclick={() => {
      ui.popovers.indexSelector.toggle();
    }}
  >
    {#key ui.index.viewState.currentSection?.letter_uc}
      <span
        data-role='section-name'
        in:fly={{ duration: 300, y: 30, opacity: 0 }}
      >
        {ui.index.viewState.currentSection?.letter_uc ?? '-'}
      </span>
    {/key}
  </button>
{/snippet}

<style>
  [data-role='section-button'] {
    padding: 0px 10px;
    background: var(--qt-hover-bg);
    border-radius: var(--qt-radius-s);

    &:hover {
      background: var(--qt-button-primary-hover);
    }
  }

  [data-role='section-name'] {
    color: var(--qt-text-default);
    display: inline-block;
    width: 1.2em;
    text-align: center;
    text-transform: uppercase;
  }
</style>
