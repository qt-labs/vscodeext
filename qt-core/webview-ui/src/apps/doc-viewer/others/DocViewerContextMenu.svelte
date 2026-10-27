<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang='ts'>
  import Popover from '@/comps/Popover.svelte';
  import Separator from '@/comps/Separator.svelte';
  import { ui } from '../states.svelte';
  import * as contextMenu from './DocViewerContextMenu.logic.svelte';

  $effect(() => {
    const { x, y } = ui.popovers.contextMenu.pos;

    ui.popovers.contextMenu.refEl = {
      getBoundingClientRect: () => {
        return {
          x, y, width: 0, height: 0,
          top: y, right: x, left: x, bottom: y,
        };
      }
    };
  });
</script>

<Popover
  controller={ui.popovers.contextMenu}
  placement='bottom-start'
  offset={5}
>
  <div class="qt-popover min-w-[200px]">
    <div class="qt-item-list flex flex-col">
      {@render content()}
    </div>
  </div>
</Popover>

<!-- snippets -->
{#snippet content()}
  {#each contextMenu.orderedIds() as id (id)}
    {@const Icon = contextMenu.findIcon(id)}
    {#if id === '---'}
      <Separator />
    {:else}
      <button
        class='item flex flex-row items-center gap-2'
        disabled={!contextMenu.isEnabled(id)}
        onclick={() => {
          contextMenu.onClicked(id);
          ui.popovers.contextMenu.hide();
        }}
      >
        {#if Icon}
          <Icon size='20px'/>
        {/if}

        {contextMenu.findText(id)}
      </button>
    {/if}
  {/each}
{/snippet}

<style>
  .qt-item-list {
    border-radius: var(--qt-radius-s);

    & .item {
      color: var(--qt-text-default);
      background: var(--qt-bg-default);

      &:disabled {
        color: var(--qt-text-muted);
      }

      &:hover {
        color: var(--qt-selected-fg);
        background: var(--qt-selected-bg);

        &:disabled {
          color: var(--qt-text-muted);
          background: var(--qt-hover-bg);
          cursor: not-allowed;
        }
      }
    }
  }
</style>
