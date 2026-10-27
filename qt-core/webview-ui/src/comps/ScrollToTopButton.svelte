<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ChevronUp } from '@lucide/svelte';

  let {
    onClicked = (_: MouseEvent) => {}
  } = $props();
</script>

<button
  data-role='scroll-to-top'
  class='absolute flex items-center justify-center'
  onclick={(e: MouseEvent) => {
    onClicked(e);
    e.stopPropagation();
  }}
>
  <ChevronUp />
</button>

<style>
  [data-role='scroll-to-top'] {
    right: 10px;
    bottom: 10px;
    width: 40px;
    height: 40px;
    border-radius: 20px;
    opacity: 0.8;
    color: var(--qt-button-fg);
    background: var(--qt-button-primary-bg);

    &:hover {
      opacity: 1.0;
      cursor: pointer;
    }
  }
</style>
