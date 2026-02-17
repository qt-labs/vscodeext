<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import { ui, data } from './states.svelte';
  import { type ViewChange } from './types.svelte';
  import * as helper from './helpers/render';
  import * as viewlogic from './viewlogic.svelte';

  function onChanged(change: ViewChange) {
    switch (change) {
      case 'data':
      case 'base':
      case 'features':
      case 'resize':
      case 'theme': {
        // const _start = performance.now();

        helper.prepare(data.flame?.metadata.height ?? 0);
        helper.drawCells('normal', 'g.d3-normal');
        helper.drawCells('selected', 'g.d3-selected');
        helper.drawCells('hovered', 'g.d3-hovered');
        helper.drawCells('highlighted', 'g.d3-highlighted');
        helper.drawScaleBar();

        ui.render.context = 'general';
        ui.prevStates.xscale = ui.render.scales.x;

        // console.log(
        //   `render took: ${(performance.now() - _start).toFixed(3)} ms,`,
        //   `nodes: ${ui.render.nodes.length}`
        // );
        break;
      }

      case 'hovered':
      case 'selected':
      case 'highlighted':
        helper.drawCells(change, `g.d3-${change}`);
        break;
    }
  };

  let resizeTimerId: number = 0;
  const resizeDebounceTime_ms = 25;

  $effect(() => {
    const w = ui.render.area.width;
    const h = ui.render.area.height;
    if (w > 0 && h > 0) {
      clearTimeout(resizeTimerId);
      resizeTimerId = window.setTimeout(
        viewlogic.onResized,
        resizeDebounceTime_ms
      );
    }
  });

  onMount(() => viewlogic.onChanged(onChanged));
  onDestroy(() => clearTimeout(resizeTimerId));
</script>

<div
  bind:clientWidth={ui.render.area.width}
  bind:clientHeight={ui.render.area.height}
  class='d3-scroll-area'
  role='treegrid'
  tabindex='0'

  onkeydown={viewlogic.onKeyDownEvent}
  onclick={viewlogic.onMouseEvent}
  ondblclick={viewlogic.onMouseEvent}
  onmousemove={viewlogic.onMouseEvent}
  onmouseleave={viewlogic.onMouseEvent}
>
  <div class='grow'></div>
  <svg
    class='svg-flame-graph w-full select-none'
    style:min-height={`${((data.flame?.metadata.height ?? 0) + 1) * ui.render.cellHeight}px`}
  >
    <g class='d3-normal'></g>
    <g class='d3-selected'></g>
    <g class='d3-hovered'></g>
    <g class='d3-highlighted'></g>
    <g class='d3-scale-bar'></g>
  </svg>
</div>

<style>
  :global(.d3-label) {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    pointer-events: none;
  }

  :global(.d3-rect) {
    stroke-width: 0.5;
    cursor: pointer;
  }

  :global(.d3-scroll-area) {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: scroll;
    overflow-x: hidden;
    outline: none;
    scrollbar-gutter: stable;
  }

</style>
