<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { P } from 'flowbite-svelte';
  import { ChevronRight } from '@lucide/svelte';

  let { text, icon = true, class: className = '' } = $props();
</script>

<div class={`flex flex-row w-full mb-1 ${className} *:self-center gap-0.5`}>
  {#if icon}
    <ChevronRight class="qt-label highlight" size="sm" />
  {/if}
  <P class="qt-label highlight">{text}</P>
</div>
