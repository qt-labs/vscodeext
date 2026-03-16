<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';

  let {
    cols = 3 as (number | string),
    class: className = '',
    children = undefined as Snippet | undefined,
  } = $props();

  const colStyle = $derived(
    typeof cols === 'number' ? `repeat(${cols}, 1fr)` : cols
  );
</script>

<div
  class={`grid ${className}`}
  style={`grid-template-columns: ${colStyle}`}
>
  {@render children?.()}
</div>
