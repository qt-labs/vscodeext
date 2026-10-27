<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Component, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { ChevronUp, ChevronDown, X } from '@lucide/svelte';

  import { tooltip } from '@/utils/actions';
  import { docBrowser as texts } from '@/apps/texts';
  import Popover from '@/comps/Popover.svelte';
  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  let inputEl: HTMLInputElement | undefined;

  function runAction(action: 'prev' | 'next' | 'close') {
    if (action === 'prev' || action === 'next') {
      viewlogic.findInPage(action);
      inputEl?.select();
    } else {
      viewlogic.findInPage('clear');
      ui.popovers.find.hide();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      runAction(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      runAction('close');
    }
  }

  function onFocus() {
    inputEl?.select();
  }

  onMount(() => {
    requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  });
</script>

<Popover
  controller={ui.popovers.find}
  placement='bottom'
  offset={5}
>
  <div transition:fly={{ duration: 120, y: -20, opacity: 0 }}>
    {@render content()}
  </div>
</Popover>

<!-- snippets -->
{#snippet content()}
  <div class="qt-popover h-[36px] flex flex-row items-center">
    <input
      bind:this={inputEl}
      bind:value={ui.popovers.find.keyword}
      data-role='find-input'
      class='qt-input min-w-[200px] self-stretch px-2'
      placeholder={texts.findInPage.placeholder}
      onkeydown={onKeyDown}
      onfocus={onFocus}
    />

    {@render toolButton('prev', ChevronUp)}
    {@render toolButton('next', ChevronDown)}
    {@render toolButton('close', X)}
  </div>
{/snippet}

{#snippet toolButton(action: 'prev' | 'next' | 'close', Icon: Component)}
  <button
    use:tooltip={{ text: texts.findInPage.tooltips[action] }}
    data-role='tool-button'
    class='qt-button'
    onclick={(e: MouseEvent) => {
      runAction(action);
      e.stopPropagation();
    }}
  >
    <Icon />
  </button>
{/snippet}

<style>
  .qt-input[data-role='find-input'] {
    background: none;
  }

  .qt-button[data-role='tool-button'] {
    border: none;
    background: transparent;
  }
</style>
