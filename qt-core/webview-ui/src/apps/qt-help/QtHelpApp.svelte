<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import '@/styles/components/components.css';
  import DocViewerApp from '@/apps/doc-viewer/DocViewerApp.svelte';

  import QtHelpSidebar from './sidebar/QtHelpSidebar.svelte';
  import QtHelpIndexJumpPopover from './views/QtHelpIndexJumpPopover.svelte';
  import QtHelpQtVersionPopover from './others/QtHelpQtVersionPopover.svelte';
  import QtHelpSidebarResizeHandle from './others/QtHelpResizeHandle.svelte';

  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  onMount(() => viewlogic.onAppMount());
  onDestroy(() => viewlogic.onAppDestroy());
</script>

<div class="w-screen h-screen flex flex-row">
  <div style:width={`${ui.sidebar.width}px`} class="shrink-0">
    <QtHelpSidebar />
  </div>

  <div class='w-full h-full overflow-x-hidden relative'>
    <DocViewerApp fullScreen={false} />
    {@render clickMaskForPopovers()}
    {@render resizeHandle()}
  </div>

  <QtHelpQtVersionPopover />
  <QtHelpIndexJumpPopover />
</div>

<!-- snippets -->
{#snippet clickMaskForPopovers()}
  <div
    class='absolute inset-0'
    class:pointer-events-none={
      !ui.popovers.qtVersions.visible && !ui.popovers.indexSelector.visible
    }
  >
  </div>
{/snippet}

{#snippet resizeHandle()}
  <div class='absolute left-0 top-0 bottom-0'>
    <QtHelpSidebarResizeHandle />
  </div>
{/snippet}
