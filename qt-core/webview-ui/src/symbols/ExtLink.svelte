<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import SvgIconBase from './SvgIconBase.svelte';
  import { type ComponentProps } from 'svelte';

  let props: ComponentProps<typeof SvgIconBase> = $props();
</script>

<SvgIconBase {...props}>
  <path
    d="M15 9.5V12.5C15 13.879 13.879 15 12.5 15H3.5C2.121 15 1 13.879 1 12.5V3.5C1 2.121 2.121 1 3.5 1H6.5C6.776 1 7 1.224 7 1.5C7 1.776 6.776 2 6.5 2H3.5C2.673 2 2 2.673 2 3.5V12.5C2 13.327 2.673 14 3.5 14H12.5C13.327 14 14 13.327 14 12.5V9.5C14 9.224 14.224 9 14.5 9C14.776 9 15 9.224 15 9.5ZM14.5 1H9.5C9.224 1 9 1.224 9 1.5C9 1.776 9.224 2 9.5 2H13.293L9.147 6.146C8.952 6.341 8.952 6.658 9.147 6.853C9.342 7.048 9.659 7.048 9.854 6.853L14 2.707V6.5C14 6.776 14.224 7 14.5 7C14.776 7 15 6.776 15 6.5V1.5C15 1.224 14.776 1 14.5 1Z"
  >
  </path>
</SvgIconBase>
