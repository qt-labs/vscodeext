<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import Checkbox from 'flowbite-svelte/Checkbox.svelte';
  import '@/styles/app.css';
  import { welcome as texts } from '@/apps/texts';
  import { portal, placeNear, clickOutside } from '@/utils/actions';

  import WelcomeAppView from './WelcomeAppView.svelte';
  import WelcomeExtInfoOverlay from './WelcomeExtInfoOverlay.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { ui } from './states.svelte';

  onMount(viewlogic.onAppMount);
</script>

<div class='w-screen h-screen flex flex-col gap-2 relative select-none'>
  <div class='grow min-h-0 h-full p-20 pt-15 relative overflow-y-auto'>
    <WelcomeAppView />
  </div>

  {@render Footer()}

  {#if ui.overlays.versions.visible}
    <div
      use:portal
      use:placeNear={{
        ref: ui.overlays.versions.refEl,
        placement: 'bottom-end'
      }}
      use:clickOutside={(e: MouseEvent) => {
        ui.overlays.versions.visible = false;
        e.stopPropagation();
      }}
      class='absolute'
    >
      <WelcomeExtInfoOverlay />
    </div>
  {/if}
</div>

{#snippet Footer()}
  <div class='w-full flex flex-col pb-4 bg-transparent'>
    <Checkbox
      class='qt-checkbox self-center'
      bind:checked={ui.config.showOnActivation}
      onchange={() => {
        viewlogic.saveConfig()
      }}
    >
      {texts.checkShowOnActivation}
    </Checkbox>
  </div>
{/snippet}
