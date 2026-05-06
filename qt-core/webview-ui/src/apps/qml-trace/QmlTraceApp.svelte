<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { ExternalLink, Settings } from '@lucide/svelte';

  import '@/styles/app.css';
  import IconButton from '@/comps/IconButton.svelte';
  import QmlTraceConfigDialog from './QmlTraceConfigDialog.svelte';
  import { qmltrace as texts } from '@/apps/texts';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  onMount(viewlogic.onAppMount);
</script>

<div class='w-screen h-screen p-2 flex flex-col gap-2'>
  <div class='
    w-[300px] h-full
    flex flex-col mx-auto gap-1 justify-center
  '>
    {@render RunViewerButton()}
    {@render ConfigAndOpenAsTextButton()}
    {#if ui.overlays.config.visible}
      <div class='h-[300px]'></div>
    {/if}
  </div>

  {#if ui.overlays.config.visible}
    <div class="absolute grow min-w-0 pointer-events-auto">
      <QmlTraceConfigDialog />
    </div>
  {/if}
</div>

{#snippet RunViewerButton()}
  <button class='
    qt-button
    w-full min-h-[60px]
    flex flex-row justify-center items-center gap-4 px-5
    bg-amber-600
  '
    onclick={() => {
      void viewlogic.openFileInTraceViewer();
    }}
  >
    <ExternalLink/>
    <p>{texts.buttons.openTrace}</p>
  </button>
{/snippet}

{#snippet ConfigAndOpenAsTextButton()}
  <div class='flex flex-row items-center'>
    {#if data.configs.fileName.endsWith('.qtd')}
    {@render OpenAsTextButton()}
    {/if}

    <div class='grow'></div>
    <IconButton
      flat
      square
      class="!w-0 !border-none"
      icon={Settings}
      tooltip={texts.tooltips.openConfigDialog}
      onClicked={() => {
        ui.overlays.config.visible = !ui.overlays.config.visible;
      }}
    />
  </div>
{/snippet}

{#snippet OpenAsTextButton()}
  <button
    class='underline underline-offset-3 text-gray-500 cursor-pointer'
    onclick={() => {
      void viewlogic.openFileInTextEditor();
    }}
  >
    {texts.buttons.openTraceAsText}
  </button>
{/snippet}
