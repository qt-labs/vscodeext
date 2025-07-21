<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';

  import { textOrFallback } from '@/utils/utils';

  let {
    text = '-',
    active = false,
    onTriggered = (_: DOMRect) => {}
  } = $props();

  let el: HTMLButtonElement;

  function onClicked(_: MouseEvent) {
    onTriggered(el.getBoundingClientRect());
  }
</script>

<button
  class={`
    w-full flex items-center justify-between
    qt-picker-trigger ${active ? 'active' : ''}
  `}
  bind:this={el}
  onclick={onClicked}
>
  <div class="truncate">{textOrFallback(text)}</div>
  <ChevronDown class="w-4 h-4" />
</button>
