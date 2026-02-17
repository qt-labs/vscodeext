<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import '@/styles/app.css';
  import { ui } from './states.svelte';
  import QmlTraceConfigDialog from './QmlTraceConfigDialog.svelte';
  import QmlTraceDetailsOverlay from './QmlTraceDetailsOverlay.svelte';
  import QmlTraceFeaturesOverlay from './QmlTraceFeaturesOverlay.svelte';

  let {
    class: className = ''
  } = $props();

</script>

<div class={`
  absolute top-0 left-0 w-full h-[1px] pointer-events-none
  flex flex-row gap-2 ${className}
`}>
  <div class='pointer-events-auto'>
    {#if ui.overlays.features.visible}
      <QmlTraceFeaturesOverlay />
    {/if}
  </div>

  {#if (ui.hovered?.data ?? ui.selected?.data)}
    <div class="grow min-w-0 relative pointer-events-auto">
      <div class="relative w-full">
        <div class={`
          absolute top-0 transition-x duration-200
          ${ui.overlays.details.alignLeft
            ? `left-0 translate-x-0`
            : 'left-full -translate-x-full' }
        `}>
          <QmlTraceDetailsOverlay />
        </div>
      </div>
    </div>
  {/if}

  {#if ui.overlays.config.visible}
    <div class="absolute grow min-w-0 pointer-events-auto">
      <QmlTraceConfigDialog />
    </div>
  {/if}
</div>
