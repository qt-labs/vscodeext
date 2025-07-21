<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';

  import '@/styles/app.css';
  import { focusAnyChild } from '@/utils/utils';
  import { onAppMount } from './viewlogic.svelte';
  import Wizard from './Wizard.svelte';

  let container: HTMLDivElement;

  onMount(() => {
    requestAnimationFrame(() => {
      void onAppMount();
      focusAnyChild(container);
    });
  });
</script>

<div
  bind:this={container}
  class="w-screen h-screen flex items-center justify-center">
  <Wizard />
</div>
