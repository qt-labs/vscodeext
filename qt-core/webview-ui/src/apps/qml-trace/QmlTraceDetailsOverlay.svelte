<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { slide } from 'svelte/transition';
  import P from 'flowbite-svelte/P.svelte';
  import Tooltip from 'flowbite-svelte/Tooltip.svelte';
  import { ArrowLeftToLine } from '@lucide/svelte';

  import Overlay from '@/comps/Overlay.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import { qmltrace as texts } from '@/apps/texts';
  import { nanosec, count, percent, bytes } from './helpers/format'
  import { ui } from './states.svelte'
  import * as viewlogic from './viewlogic.svelte';
  import type { FlameNode } from './types.svelte';

  const fallback = {
    key: 0,
    label: '',
    details: '',
    feature: '',
    offset: 0,
    eventId: 0,
    depth: 0,
    calls: 0,
    duration: 0,
    amount: 0,
    sourceLocation: '',
    allocations: 0
  } as FlameNode;

  const base = $derived(ui.base?.data);
  const target = $derived(ui.hovered ?? ui.selected);
  const n = $derived(target?.data ?? fallback);
  const root = $derived(target?.data.depth === 0);
  const label = $derived(root
    ? texts.rootLabel
    : (target?._merged ? texts.mergedLabel : (n.label || texts.noLabels))
  );

  const t = texts.detailsOverlay;
  const normalData = $derived([
    [t.label, label],
    [t.details, n.details || '-'],
    [t.feature, viewlogic.findFeatureLabel(n.feature) || '-'],
    [t.calls, root ? '-' : count(n.calls)],
    [t.time, `${nanosec(n.duration)} (${percent(n.duration, base?.duration ?? 0)})`],
    [t.meanTime, root ? '-' : nanosec((n.duration) / Math.max(1, n.calls))],
    [t.memory, `${bytes(n.amount)} (${percent(n.amount, base?.amount ?? 0)})`],
    [t.alloc, `${count(n.allocations)} (${percent(n.allocations, base?.allocations ?? 0)})`],
    [t.loc, n.sourceLocation || '-'],
  ]);

  const mergedData = $derived([
    [t.label, texts.mergedLabel],
    [t.details, '-'],
    [t.feature, '-'],
    [t.calls, '-'],
    [t.time, '-'],
    [t.meanTime, '-'],
    [t.memory, '-'],
    [t.alloc, '-'],
    [t.loc, '-'],
  ]);

  const data = $derived(target?._merged ? mergedData : normalData);

  let overlay = $derived(ui.overlays.details);
  let truncatedIndices = $state(new Set());

  function updateTruncatedState(i: number, el: HTMLDivElement) {
    const prev = truncatedIndices.has(i);
    const truncated = el.scrollWidth > el.offsetWidth;
    if (prev === truncated) {
      return;
    }

    if (truncated) {
      truncatedIndices.add(i);
    } else {
      truncatedIndices.delete(i);
    }

    truncatedIndices = new Set(truncatedIndices);
  }
</script>

{#if target}
  <Overlay
    title={texts.detailsOverlay.title}
    class='relative w-[400px] flex flex-col'
    closable={false}
    bind:collapsed={overlay.collapsed}
  >
    {#snippet toolbar()}
      <button
        class="grow flex flex-row items-center cursor-pointer min-w-0"
        onclick={() => { overlay.collapsed = !overlay.collapsed }}
      >
        {#if overlay.collapsed && label.length !== 0}
          <div class="qt-label dimmed truncate min-w-0">
            {label}
          </div>
        {/if}

        <div class="grow"></div>

        <!-- button for adjusting anchor -->
        <IconButton
          icon={ArrowLeftToLine} flat square
          class={`
            w-1 border-0!
            ${overlay.alignLeft ? 'rotate-180' : ''}
          `}
          onClicked={() => { overlay.alignLeft = !overlay.alignLeft; }}
        />
      </button>
    {/snippet}

    <!-- table -->
    {#if !overlay.collapsed}
      <div
        class="w-full grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0"
        transition:slide={{ duration: 200 }}
      >
        {#each data as item, i}
          {@const isLoc = item[0] === t.loc}

          <!-- name -->
          <P class='qt-label text-left pl-1 font-thin'>{item[0]}</P>

          <!-- value -->
          <div class="min-w-0">
            <div
              class={`
                qt-label truncate min-w-0
                ${isLoc ? 'cursor-pointer link' : ''}
              `}
              role='cell'
              tabindex='0'
              onmouseenter={(e) => { updateTruncatedState(i, e.currentTarget) }}
              onkeydown={() => {}}
              onclick={() => {
                void navigator.clipboard.writeText(item[1]);
                isLoc && viewlogic.openSourceLocation(item[1]);
              }}
            >
              {item[1]}
            </div>

            <!-- display a tooltip when the text is truncated -->
            <Tooltip
              placement="bottom-start"
              data-placement={"bottom-start"}
              class={`qt-tooltip ${truncatedIndices.has(i) ? '' : 'hidden'}`}
              offset={10}
              transition={undefined}
            >
              {item[1]}
            </Tooltip>
          </div>
        {/each}
      </div>
    {/if}
  </Overlay>
{/if}
