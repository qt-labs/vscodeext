<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { MessageCircleWarning } from '@lucide/svelte';

  import '@/styles/app.css';
  import * as texts from '@/apps/texts';
  import LoadingMask from '@/comps/LoadingMask.svelte';

  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import QmlTraceHeader from './QmlTraceHeader.svelte';
  import QmlTraceFlameView from './QmlTraceFlameView.svelte';
  import QmlTraceAllOverlays from './QmlTraceAllOverlays.svelte';

  onMount(async () => {
    void viewlogic.onAppMount();
  });
</script>

<div class='w-screen h-screen p-2 flex flex-col gap-2'>
  <QmlTraceHeader />

  <div class='grow min-h-0 relative'>
    {#if ((data.flame?.metadata.height ?? 0) === 0) && !ui.task.busy}
      <div class="w-full h-full flex flex-row items-center justify-center gap-3">
        <MessageCircleWarning class='medium'/>
        {texts.qmltrace.noData}
      </div>
    {:else}
      <QmlTraceFlameView />
    {/if}

    <QmlTraceAllOverlays class="z-10" />
  </div>

  <LoadingMask
    busy={ui.task.busy}
    error={ui.task.error}
    forceHidden={ui.task.isDebouncing}
    backgroundOpacity={15}
    busyText={texts.loading.busy}
    closeText={texts.loading.close}
  />
</div>
