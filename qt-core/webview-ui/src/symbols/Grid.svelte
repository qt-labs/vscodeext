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
  <rect x="1" y="1" width="6" height="6" rx="1"></rect>
  <rect x="9" y="1" width="6" height="6" rx="1"></rect>
  <rect x="1" y="9" width="6" height="6" rx="1"></rect>
  <rect x="9" y="9" width="6" height="6" rx="1"></rect>
</SvgIconBase>
