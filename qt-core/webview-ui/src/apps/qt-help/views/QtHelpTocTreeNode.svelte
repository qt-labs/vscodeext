<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { icons } from '@/symbols';

  import QtHelpTocTreeNode from './QtHelpTocTreeNode.svelte';
  import { ui } from '../states.svelte';
  import { type TocTreeViewNode } from '../types.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  interface Props {
    node: TocTreeViewNode;
  }

  let { node }: Props = $props();

  const nodeData = $derived(node.data);
  const hasChildren = $derived(node.children.length !== 0);
  const expanded = $derived(ui.toc.model.expanded(node.id));
</script>

<button
  class='item flex align-start w-full'
  class:active={ui.toc.selected === nodeData}
  onclick={() => {
    ui.toc.selected = nodeData;
    ui.toc.model.toggleExpanded(node.id);
    viewlogic.openHtml(nodeData);
  }}
>
  <span
    style:margin-left={`${5 + (nodeData.depth - 1) * 10}px`}
    class='flex items-center gap-1 min-w-0'
  >
    {@render chevron(node, expanded)}
    <span data-role='text'>{nodeData.title}</span>
  </span>
</button>

{#if hasChildren && expanded}
  {#each node.children as child (child.id)}
    <QtHelpTocTreeNode node={child} />
  {/each}
{/if}

{#snippet chevron(node: TocTreeViewNode, expanded: boolean)}
  <div class='w-[16px] flex shrink-0'>
    {#if node.children.length !== 0}
      <button
        data-role='chevron'
        class='self-center'
        style:transform={expanded ? 'rotate(90deg)' : 'rotate(0deg)'}
        onclick={(e: MouseEvent) => {
          ui.toc.model.toggleExpanded(node.id);
          e.stopPropagation();
        }}
      >
        <icons.ChevronRight size={12} />
      </button>
    {/if}
  </div>
{/snippet}

<style>
  .item {
    padding: 3px 12px;
  }

  [data-role='text'] {
    @apply truncate;
  }

  [data-role='chevron'] {
    transition: transform 150ms ease-out;
  }
</style>
