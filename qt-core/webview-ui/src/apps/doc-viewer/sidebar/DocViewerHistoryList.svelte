<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type HistoryEntry } from '@shared/doc-viewer';
  import CheckBox from '@/comps/CheckBox.svelte';
  import Separator from '@/comps/Separator.svelte';
  import { tooltip } from '@/utils/actions';
  import * as format from '@/utils/format';

  import { data } from '../states.svelte';
  import * as helpers from '../helpers';
  import * as viewlogic from '../viewlogic.svelte';
</script>

<div class='w-full flex flex-col'>
  {#each data.history.groups as g (g.label)}
    <div data-role='history-date'>
      {g.label}
    </div>

    <div class='qt-item-list !overflow-visible'>
      {#each g.items as item, i (item)}
        {#if i !== 0}
          <Separator />
        {/if}

        <div
          class='item w-full flex flex-row'
          class:active={item.checked}
        >
          <CheckBox bind:checked={item.checked} />
          {@render itemContent(item.data)}
          {@render itemHash(item.data)}
        </div>
      {/each}
      </div>
  {/each}
</div>

<!-- snippets -->
{#snippet itemContent(entry: HistoryEntry)}
  <button
    use:tooltip={{ text: helpers.toFileUriIfServer(entry.uri) }}
    data-role='item-content'
    class='grow flex flex-row items-center'
    onclick={() => {
      viewlogic.openDoc(entry.uri);
    }}
  >
    <span data-role='history-time'>
      {format.timeAsLocaleString(new Date(entry.timestamp ?? 0))}
    </span>
    <span data-role='item-title'>{entry.title}</span>
  </button>
{/snippet}

{#snippet itemHash(entry: HistoryEntry)}
  {@const hash = helpers.extractHash(entry.uri)}
  {#if hash.length !== 0}
    <span
      use:tooltip={{ text: hash, delay: 0 }}
      data-role='item-hash'
      class='flex items-center self-center'
    >
      #
    </span>
  {/if}
{/snippet}
