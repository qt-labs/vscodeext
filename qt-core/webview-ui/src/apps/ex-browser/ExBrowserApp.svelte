<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import '@/styles/app.css';
  import ExHeader from './ExHeader.svelte';
  import ExGridView from './ExGridView.svelte';
  import ExOverlaysContainer from './ExOverlaysContainer.svelte';
  import * as viewlogic from './viewlogic.svelte';

  onMount(() => viewlogic.onAppMount());
  onDestroy(() => viewlogic.onAppDestroy());
</script>

<div class='w-screen h-screen p-2 flex flex-col gap-2 relative'>
  <ExHeader />

  <div class='grow min-h-0 relative'>
    <ExGridView />
    <ExOverlaysContainer />
  </div>
</div>
