<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';

  import '@/styles/components/components.css';
  import LoadingMask from '@/comps/LoadingMask.svelte';
  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  const loading = $derived(ui.state === 'loading');

  onMount(viewlogic.onAppMount);
</script>

<div class='w-screen h-screen relative flex flex-col'>
  <div
    bind:this={ui.containerEl}
    data-role='profiler-container'
    class='w-full h-full'
    style:visibility={loading ? 'hidden' : 'visible'}
  >
  </div>

  <div data-role='overlay' class='absolute inset-0'>
    {#if loading}
      <LoadingMask busy={true} />
    {/if}
  </div>
</div>

<style>
  [data-role='profiler-container'] {
    display: block;
    position: default;
    padding: 4px;
    overflow: auto;
  }

  [data-role='overlay'] {
    z-index: 100;
    pointer-events: none;
    isolation: isolate;
  }
</style>
