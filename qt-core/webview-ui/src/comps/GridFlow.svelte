<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from "svelte";

  let {
    itemWidth = '200px',
    itemHeight = '180px',
    class: className = '',
    onScroll = () => {},
    onClicked = (_e: MouseEvent) => {},
    children = undefined as Snippet | undefined
  } = $props();

  let el: HTMLDivElement;

  export function scrollToTop() {
    el.scrollTop = 0;
  }

</script>

<div
  bind:this={el}
  class={`
    qt-surface h-full overflow-auto p-2 select-none
    grid grid-flow-dense gap-5 ${className}
  `}
  style={`
    grid-auto-rows: ${itemHeight};
    grid-template-columns: repeat(auto-fill,${itemWidth});
  `}
  tabindex="0"
  role='grid'
  onkeydown={() => {}}
  onscroll={() => {
    onScroll();
  }}
  onclick={(e) => {
    if (e.target === e.currentTarget) {
      onClicked(e);
    }
  }}
>
  {@render children?.()}
</div>
