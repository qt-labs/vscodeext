<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ui } from './states.svelte';

  import DocViewerEmptyPage from './others/DocViewerEmptyPage.svelte';
  import DocViewerFindPopover from './others/DocViewerFindPopover.svelte';
  import DocViewerContextMenu from './others/DocViewerContextMenu.svelte';
  import DocViewerMainViewOverlay from './others/DocViewerMainViewOverlay.svelte';
</script>

<div class='w-full h-full relative'>
  {#if ui.iframe.uri.length === 0}
    <DocViewerEmptyPage />
  {:else}
    <iframe
      bind:this={ui.iframe.el}
      title='viewer'
      class='w-full h-full'
      src={ui.iframe.uri}
      allow='clipboard-write'
    ></iframe>
  {/if}

  <DocViewerMainViewOverlay />
  <DocViewerFindPopover />
  <DocViewerContextMenu />
</div>
