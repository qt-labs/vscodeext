<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ui } from '../states.svelte';

  let dragging = $state(false);

  function startResize(event: PointerEvent) {
    const el = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = ui.sidebar.width;

    dragging = true;
    el.setPointerCapture(event.pointerId);

    const move = (event: PointerEvent) => {
      const candidate = startWidth + event.clientX - startX;
      ui.sidebar.width = Math.min(
        ui.sidebar.max,
        Math.max(ui.sidebar.min, candidate)
      );
    };

    const end = () => {
      dragging = false;
      el.releasePointerCapture(event.pointerId);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointercancel', end);
    };

    el.addEventListener('pointerup', end);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointercancel', end);
  }
</script>

<div
  data-role='resize-handle'
  class:dragging
  class='flex h-full items-center select-none'
  onpointerdown={startResize}
  role='button'
  tabindex='0'
>
  <svg class="grip-icon" viewBox="0 0 6 16" width="6" height="16">
    <circle cx="3" cy="2" r="1" fill="currentColor" />
    <circle cx="3" cy="8" r="1" fill="currentColor" />
    <circle cx="3" cy="14" r="1" fill="currentColor" />
  </svg>
</div>

<style>
  [data-role='resize-handle'] {
    width: 5px;
    flex-shrink: 0;
    cursor: col-resize;

    &:hover,
    &.dragging {
      background: var(--vscode-focusBorder);

      .grip-icon {
        opacity: 1;
        color: var(--vscode-sash-hoverBorder, #ffffff);
      }
    }
  }

  .grip-icon {
    color: var(--vscode-foreground, #888888);
    opacity: 0.8;
  }
</style>
