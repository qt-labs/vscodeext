<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import ExOverlayCatalog from './ExOverlayCatalog.svelte';
  import ExOverlayDetails from './ExOverlayDetails.svelte';
  import ExOverlayTagCloud from './ExOverlayTagCloud.svelte';
  import { data, ui } from './states.svelte';
</script>

{#if ui.overlays.catalog.visible && data.packages.length !== 0}
  <ExOverlayCatalog />
{/if}

{#if ui.overlays.details.visible}
  <div class={`
    absolute top-0 transition-x duration-200
    ${ui.overlays.details.alignLeft
      ? `left-0 translate-x-0`
      : 'left-full -translate-x-full' }
  `}>
    <ExOverlayDetails />
  </div>
{/if}

{#if ui.overlays.tagCloud.visible && (ui.filter.category?.tags.length ?? 0) !== 0}
  <ExOverlayTagCloud />
{/if}
