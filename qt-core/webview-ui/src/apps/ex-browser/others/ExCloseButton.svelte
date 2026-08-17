<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { glyphs } from '@/symbols';
  import ExToolButton from '../others/ExToolButton.svelte';

  let { onClicked = (_: MouseEvent) => {} } = $props();
</script>

<ExToolButton
  onClicked={(e: MouseEvent) => {
    onClicked(e);
    e.stopPropagation();
  }}
>
  {glyphs.multiplication}
</ExToolButton>
