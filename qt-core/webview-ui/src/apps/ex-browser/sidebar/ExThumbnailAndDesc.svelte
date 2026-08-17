<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ui } from '../states.svelte';
  import ExThumbnail from '../others/ExThumbnail.svelte';
  const example = $derived(ui.selected.example);
</script>

<div class="flex flex-col gap-[10px]">
  <div data-role="thumbnail">
    <ExThumbnail {example} />
  </div>
  <div data-role="name">{example?.name ?? ''}</div>
  <div data-role="desc">{example?.description}</div>
</div>

<style>
  [data-role='name'] {
    color: var(--qt-text-default);
    font-size: 14px;
    font-weight: var(--qt-font-semibold);
    line-height: 1.35;
  }

  [data-role='desc'] {
    color: var(--qt-text-default);
    font-size: var(--qt-font-s);
    line-height: 1.6;
  }

  [data-role='thumbnail'] {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--qt-radius-m);
    overflow: hidden;
    background: var(--qt-bg-default);
    margin-bottom: 12px;
    position: relative;
    align-items: stretch;
  }
</style>
