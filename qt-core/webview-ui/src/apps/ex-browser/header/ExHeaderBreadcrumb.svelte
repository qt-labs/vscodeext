<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { glyphs } from '@/symbols';
  import { clickOutside, portal, placeNear } from '@/utils/actions';
  import { data, ui } from '../states.svelte';
  import ExCatalogPopover from '../popovers/ExCatalogPopover.svelte';

  const valid = $derived.by(() => {
    return (
      (ui.selected.package?.name ?? '') &&
      (ui.filter.category?.name ?? '') &&
      data.packages.length !== 0
    );
  });

  const popover = $derived(ui.popovers.catalog);
  const count = $derived.by(() => {
    const count = ui.filter.category?.count ?? 0;
    const total = data.categories.find((c) => c.type === 'all')?.count ?? 0;
    if (total === 0) {
      return '';
    }

    return count === total ? `${count} examples` : `${count} / ${total}`;
  });
</script>

<button
  bind:this={popover.reference}
  data-role="breadcrumb"
  class="qt-button flex flex-row"
  aria-expanded={popover.visible}
  disabled={data.packages.length === 0}
  onclick={(e: MouseEvent) => {
    popover.visible = !popover.visible;
    e.stopPropagation();
  }}
>
  {#if !valid}
    <span data-role="title">-</span>
  {:else}
    <span data-role="title">Categories</span>
    <span data-role="qt-version">{ui.selected.package?.name ?? ''}</span>
    <span data-role="current-category">{ui.filter.category?.name ?? ''}</span>
    <span class="qt-badge">{count}</span>
    <span data-role="expand-arrow">
      {glyphs.triangleDown}
    </span>
  {/if}
</button>

{#if popover.visible}
  <div
    use:portal
    use:placeNear={{
      ref: popover.reference,
      placement: 'bottom-start',
      offset: 5
    }}
    use:clickOutside={(e: MouseEvent) => {
      popover.visible = false;
      e.stopPropagation();
    }}
    class="fixed z-1"
  >
    <ExCatalogPopover />
  </div>
{/if}

<style>
  [data-role='current-category'] {
    color: var(--qt-text-default);
  }

  [data-role='expand-arrow'] {
    margin-left: 2px;
  }

  [data-role='qt-version']::before,
  [data-role='current-category']::before {
    content: '›';
    margin-right: 6px;
    opacity: 0.5;
  }
</style>
