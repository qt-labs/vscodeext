<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';

  interface Props {
    size?: number;
    children?: Snippet;
    [key: string]: unknown;
  }

  let { size = 16, children, ...rest }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="currentColor"
  {...rest}
>
  {@render children?.()}
</svg>
