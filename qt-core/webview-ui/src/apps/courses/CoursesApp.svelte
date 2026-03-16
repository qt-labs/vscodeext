<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';

  import '@/styles/app.css';
  import * as texts from '@/apps/texts';
  import LoadingMask from '@/comps/LoadingMask.svelte';

  import CoursesGridView from './CoursesGridView.svelte';
  import CoursesAppHeader from './CoursesAppHeader.svelte';
  import CoursesDetailsOverlay from './CoursesDetailsOverlay.svelte';
  import CoursesEmptyDataInfo from './CoursesEmptyDataInfo.svelte';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  onMount(viewlogic.onAppMount);
</script>

<div class='w-screen h-screen p-2 flex flex-col gap-2 relative'>
  <CoursesAppHeader />

  <div class='grow min-h-0 h-full relative'>
    {#if data.refined.length !== 0}
      <CoursesGridView />
    {:else if !ui.task.busy}
      <CoursesEmptyDataInfo />
    {/if}

    {#if ui.overlays.details.visible}
      <div class={`
        absolute top-0 transition-x duration-200 h-full pointer-events-none
        ${ui.overlays.details.alignLeft
          ? `left-0 translate-x-0`
          : 'left-full -translate-x-full' }
      `}>
        <CoursesDetailsOverlay />
      </div>
    {/if}
  </div>

  <LoadingMask
    busy={ui.task.busy}
    error={ui.task.error}
    forceHidden={ui.task.isDebouncing}
    busyText={texts.loading.busy}
    closeText={texts.loading.close}
  />
</div>
