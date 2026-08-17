<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import '@/styles/components/components.css';
  import './ExBrowserApp.css';

  import ExHeader from './header/ExHeader.svelte';
  import ExMainView from './main/ExMainView.svelte';
  import ExSidebar from './sidebar/ExSidebar.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { ui } from './states.svelte';

  onMount(() => viewlogic.onAppMount());
  onDestroy(() => viewlogic.onAppDestroy());
</script>

<div class="w-screen h-screen flex flex-col">
  <ExHeader />

  <div data-body class="flex flex-row">
    <ExMainView />

    <div data-sidebar class:open={ui.sidebar.visible}>
      <ExSidebar />
    </div>
  </div>
</div>

<style>
  [data-body] {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  [data-sidebar] {
    width: 0;
    border-left: 1px solid transparent;
    background: var(--qt-bg-subtle);
    overflow: hidden;
    transition-property: width, border-color;
    transition-duration: var(--qt-duration-normal);

    &.open {
      width: 320px;
      border-left-color: var(--qt-stroke-subtle);
    }
  }
</style>
