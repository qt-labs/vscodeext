<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type BookmarkEntry } from '@shared/doc-viewer';
  import CheckBox from '@/comps/CheckBox.svelte';
  import Separator from '@/comps/Separator.svelte';
  import { tooltip } from '@/utils/actions';

  import { data } from '../states.svelte';
  import * as helpers from '../helpers';
  import * as viewlogic from '../viewlogic.svelte';

  let dragIndex = $state<number | null>(null);
  let overIndex = $state<number | null>(null);

  function clear() {
    dragIndex = null;
    overIndex = null;
  }

  function dndHandlers(i: number) {
    return {
      ondragstart: (e: DragEvent) => {
        dragIndex = i;
        e.dataTransfer!.effectAllowed = 'move';
      },

      ondragover: (e: DragEvent) => {
        e.preventDefault();
        overIndex = i;
      },

      ondrop: () => {
        if (dragIndex !== null && dragIndex !== i) {
          viewlogic.bookmark.edit({
            action: 'move',
            from: dragIndex,
            to: i
          });
        }
        clear();
      },

      ondragend: clear
    };
  }

</script>

<div class='w-full flex flex-col mt-2'>
  <div class='qt-item-list'>
    {#each data.bookmarks as item, i (i)}
      {#if i !== 0}
        <Separator />
      {/if}

      <div
        class='item w-full flex flex-row'
        class:active={item.checked}
        class:drop-target={overIndex === i}
        draggable={true}
        {...dndHandlers(i)}
      >
        <CheckBox bind:checked={item.checked} />
        {@render itemContent(item.data)}
        {@render itemHash(item.data)}
      </div>
    {/each}

    {@render dropSiteAtEnd()}
  </div>
</div>

<!-- snippets -->
{#snippet itemContent(entry: BookmarkEntry)}
  <button
    use:tooltip={{ text: helpers.toFileUriIfServer(entry.uri) }}
    data-role='item-content'
    class='grow flex flex-row items-center'
    onclick={() => {
      viewlogic.openDoc(entry.uri);
    }}
  >
    <span data-role='item-title'>{entry.title}</span>
  </button>
{/snippet}

{#snippet itemHash(entry: BookmarkEntry)}
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

{#snippet dropSiteAtEnd()}
  <div
    data-role='item-content'
    class:drop-target={overIndex === data.bookmarks.length}
    draggable={true}
    {...dndHandlers(data.bookmarks.length)}
  >
    &nbsp;
  </div>
{/snippet}

<style>
  .drop-target {
    box-shadow: inset 0 2px 0 var(--vscode-focusBorder);
  }
</style>
