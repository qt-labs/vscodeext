<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import GridFlow from '@/comps/GridFlow.svelte';

  import CoursesGridItem from './CoursesGridItem.svelte';
  import { data, ui } from './states.svelte';
</script>

<GridFlow
  bind:this={ui.grid}
  itemWidth='240px'
  itemHeight='200px'
  class='p-4 !gap-10'
  onScroll={() => {
    ui.overlays.details.collapsed = true;
  }}
  onClicked={() => {
    ui.overlays.details.visible = false;
  }}
>
  {#each data.refined as course, i (i)}
    <CoursesGridItem {course} />
  {/each}
</GridFlow>
