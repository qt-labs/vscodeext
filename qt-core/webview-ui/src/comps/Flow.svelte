<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    gap = true,
    class: className = '',
    children = undefined as Snippet | undefined,
  } = $props();
</script>

<div class={`flex flex-wrap ${gap ? 'gap-2' : ''} ${className}`}>
  {@render children?.()}
</div>
