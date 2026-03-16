<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { Snippet, Component } from 'svelte';
  import { TriangleAlert } from '@lucide/svelte';
  import IconSection from './IconSection.svelte';

  let {
    text = '(none)' as string,
    icon = TriangleAlert as Component,
    class: className = '',
    children = undefined as Snippet | undefined
  } = $props();

</script>

<div class={`
  w-full h-full flex flex-col items-center justify-center gap-3
  ${className}
`}>
  <IconSection {icon} {text} iconClass='medium' />
  {@render children?.()}
</div>
