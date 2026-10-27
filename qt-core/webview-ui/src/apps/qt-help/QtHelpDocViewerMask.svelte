<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ui } from './states.svelte';
  import QtHelpSidebarResizeHandle from './others/QtHelpResizeHandle.svelte';

  const consumeEvents = $derived(
    ui.popovers.qtVersions.visible || ui.popovers.indexSelector.visible
  );
</script>

<div
  class='absolute inset-0'
  class:pointer-events-none={!consumeEvents}
>
</div>

<div class='absolute left-0 top-0 bottom-0'>
  <QtHelpSidebarResizeHandle />
</div>
