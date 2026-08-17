<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { slide, fade } from 'svelte/transition';
  import { cubicOut, cubicIn } from 'svelte/easing';

  import { icons } from '@/symbols';
  import { exBrowser } from '@/apps/texts';

  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';
  import ExCloseButton from '../others/ExCloseButton.svelte';
  import ExActionNewProjectInput from './ExActionNewProjectInput.svelte';

  const isOpen = $derived(ui.sidebar.newProject.expanded);
  const texts = exBrowser.details.actions.newProject;

  function toggleOpen() {
    viewlogic.setNewProjectFormVisible(!ui.sidebar.newProject.expanded);
  }
</script>

<div class="flex flex-col">
  <button
    data-variant={!ui.sidebar.newProject.expanded ? 'primary' : 'secondary'}
    data-active={isOpen}
    class="qt-button flex flex-row"
    onclick={toggleOpen}
  >
    <span
      data-chevron
      style:transform={isOpen ? 'rotate(90deg)' : 'rotate(0deg)'}
    >
      <icons.ChevronRight size={16} />
    </span>

    <span>{texts.button}</span>
    <div class="grow"></div>

    {#if isOpen}
      <ExCloseButton onClicked={toggleOpen} />
    {/if}
  </button>

  {#if isOpen}
    <div
      in:fade={{ duration: 500, easing: cubicOut }}
      out:slide={{ duration: 150, easing: cubicIn }}
    >
      <ExActionNewProjectInput />
    </div>
  {/if}
</div>

<style>
  .qt-button {
    padding-right: 3px;
  }

  [data-chevron] {
    transition: transform var(--qt-duration-normal);
  }
</style>
