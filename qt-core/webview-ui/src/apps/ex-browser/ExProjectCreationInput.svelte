<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { X, Info } from '@lucide/svelte';
  import Tooltip from 'flowbite-svelte/Tooltip.svelte';
  import { slide, fade } from 'svelte/transition';
  import { cubicOut, cubicIn } from 'svelte/easing';

  import NewItemForm from '@/comps/NewItemForm.svelte';
  import { ui } from './states.svelte';
  import { exBrowser as texts } from '@/apps/texts';
  import * as viewlogic from './viewlogic.svelte';
</script>

<div
  class='flex flex-col gap-5 bg-black/15 p-4'
  in:fade={{ duration:500, easing:cubicOut }}
  out:slide={{ duration:150, easing:cubicIn }}
>
  <div class='flex flex-row w-full -mb-1 items-center gap-2'>
    <div class='grow'></div>
    <Info />
    <Tooltip class='qt-tooltip' placement='top-end'>
      {#each texts.details.newProject.dependencyWarning as t (t) }
        {t}<br>
      {/each}
    </Tooltip>
    <X onclick={() => {
      viewlogic.setNewProjectFormVisible(false);
    }}
    />
  </div>

  <NewItemForm
    controller={ui.input}
    selectedType='project'
  />
</div>
