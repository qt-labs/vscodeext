<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import '@/styles/components/components.css';
  import DocViewerApp from '@/apps/doc-viewer/DocViewerApp.svelte';

  import QtHelpSidebar from './sidebar/QtHelpSidebar.svelte';
  import QtHelpDocViewerMask from './QtHelpDocViewerMask.svelte';
  import QtHelpQtVersionPopover from './QtHelpQtVersionPopover.svelte';
  import QtHelpIndexSelectPopover from './QtHelpIndexSelectPopover.svelte';
  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  onMount(() => viewlogic.onAppMount());
  onDestroy(() => viewlogic.onAppDestroy());
</script>

<div class="w-screen h-screen flex flex-row">
  <div style:width={`${ui.sidebar.width}px`} class="shrink-0">
    <QtHelpSidebar />
  </div>

  <QtHelpQtVersionPopover />
  <QtHelpIndexSelectPopover />

  <div class='w-full h-full overflow-x-hidden relative'>
    <DocViewerApp fullScreen={false} />
    <QtHelpDocViewerMask />
  </div>
</div>
