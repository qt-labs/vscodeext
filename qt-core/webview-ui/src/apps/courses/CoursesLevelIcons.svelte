<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Flame } from '@lucide/svelte';

  import * as theme from '@/apps/theme.svelte';
  import { type CourseLevel } from '@shared/courses';

  let {
    level = undefined as (CourseLevel | undefined),
    strokeOpacity = 0.5,
    class: className = ''
  } = $props();

  const n = $derived(
    (level === 'advanced') ? 2 :
    (level === 'intermediate') ? 1 : 0
  );
</script>

{#if n > 0}
  <div class={`flex flex-row -space-x-1 ${className}`}>
    {#each Array(n) as _, i (i)}
      <Flame
        fill='orange'
        color={theme.qtColors.dark}
        stroke-opacity={strokeOpacity}
      />
    {/each}
  </div>
{/if}
