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
  <rect x="1" y="2.5" width="2" height="2" rx="0.5"></rect>
  <rect x="5" y="3" width="10" height="1" rx="0.5"></rect>
  <rect x="1" y="7" width="2" height="2" rx="0.5"></rect>
  <rect x="5" y="7.5" width="10" height="1" rx="0.5"></rect>
  <rect x="1" y="11.5" width="2" height="2" rx="0.5"></rect>
  <rect x="5" y="12" width="10" height="1" rx="0.5"></rect>
</SvgIconBase>
