<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Popover from '@/comps/Popover.svelte';
  import { timeAgo } from '@/utils/format';
  import { ui } from '../states.svelte';
  import * as helpers from '../helpers';
  import * as viewlogic from '../viewlogic.svelte';

  let width = $state(0);
  const refEl = $derived(ui.popovers.navigation.refEl);
  const entries = $derived(ui.navigation.entries.toReversed().slice(0, 20));

  $effect(() => {
    if (refEl instanceof Element) {
      const ro = new ResizeObserver(() => {
        width = refEl.getBoundingClientRect().width;
      });

      ro.observe(refEl);
      return () => ro.disconnect();
    }
  });
</script>

<Popover
  controller={ui.popovers.navigation}
  placement='bottom-start'
  offset={3}
>
  <div
    class='qt-popover qt-item-list'
    style:width={`${width}px`}
  >
    {#each entries as e, i (i)}
    {@const hash = helpers.extractHash(e.uri)}
      <button
        class='item w-full flex flex-row gap-2'
        class:active={
          e.uri === helpers.toFileUriIfServer(viewlogic.currentUri())
        }
        onclick={(ev: MouseEvent) => {
          viewlogic.navigateTo(e);
          ui.popovers.navigation.hide();
          ev.stopPropagation();
        }}
      >
        <span data-role='title'>{e.title}</span>
        {#if hash}
          <span data-role='hash'>{hash}</span>
        {/if}
        <span class='grow'></span>
        <span data-role='timestamp'>
          {e.timestamp ? timeAgo(new Date(e.timestamp)) : ''}
        </span>
      </button>
    {/each}
  </div>
 </Popover>

<style>
  .qt-popover {
    border: none;
  }

  [data-role='title'] {
    @apply truncate;
    color: var(--qt-text-muted);
    font-size: var(--qt-font-m);
  }

  [data-role='hash'] {
    padding: 1px 6px;
    font-size: var(--qt-font-xs);
    color: var(--qt-text-muted);
    border: 1px solid var(--qt-stroke-subtle);
    border-radius: var(--qt-radius-lg);
    white-space: nowrap;
  }

  [data-role='timestamp'] {
    white-space: nowrap;
    color: var(--qt-text-muted);
    font-size: var(--qt-font-xs);
  }
</style>
