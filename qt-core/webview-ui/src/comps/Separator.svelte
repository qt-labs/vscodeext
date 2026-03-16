<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  let {
    visible = true,
    direction = 'h' as ('h' | 'v'),
    class: className = '',
  } = $props();

</script>

{#if visible}
  <div class={`
    ${direction === 'h' ? 'border-t-1' : 'border-l-1'}
    self-stretch border-gray-500/20 ${className}
  `}>
  </div>
{/if}
