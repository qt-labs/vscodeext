<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ui } from './states.svelte';
  const consumeEvents = $derived(ui.popovers.navigation.visible);
</script>

<div
  class='absolute inset-0'
  class:pointer-events-none={!consumeEvents}
>
</div>
