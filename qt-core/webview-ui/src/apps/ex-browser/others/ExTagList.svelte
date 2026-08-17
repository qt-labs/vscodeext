<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { icons } from '@/symbols';
  import ExTagChip from './ExTagChip.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  let {
    tags = [] as string[],
    usage = 'card' as 'header' | 'card' | 'list' | 'details'
  } = $props();

  function findTagVariant(tag: string) {
    if (usage === 'header' || viewlogic.isTagSelected(tag)) {
      return 'selected';
    }

    return usage === 'details' ? 'outline' : '';
  }
</script>

<div data-root class="flex flex-row" class:flex-wrap={usage === 'details'}>
  {#if usage === 'card' || usage === 'list'}
    <div data-role="icon">
      <icons.Tag size={usage === 'card' ? 20 : 13} />
    </div>
  {/if}

  {#if tags.length}
    {#each tags as tag, index (index)}
      <ExTagChip
        text={tag}
        variant={findTagVariant(tag)}
        decorate={usage === 'header'}
        onClicked={(e: MouseEvent) => {
          e.stopPropagation();
          viewlogic.toggleTag(tag);
        }}
      />
    {/each}
  {:else}
    <span data-role="no-tags">No tags</span>
  {/if}
</div>

<style>
  [data-root] {
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    overflow: hidden;
    min-height: 20px;
  }

  [data-role='no-tags'] {
    color: var(--qt-text-muted);
  }

  [data-role='icon'] {
    color: var(--qt-text-muted);
    flex-shrink: 0;
    margin-right: 1px;
    opacity: 0.7;
  }
</style>
