<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { exBrowser as texts } from '@/apps/texts';
  import { ui } from '../states.svelte';
  import ExCloseButton from '../others/ExCloseButton.svelte';

</script>

<div data-root class="flex flex-row">
  <div data-role="title">{texts.catalog.title}</div>
  <ExCloseButton onClicked={() => {
    ui.popovers.catalog.visible = false;
  }} />
</div>

<style>
  [data-root] {
    padding: 10px 14px;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  [data-role='title'] {
    font-size: var(--qt-font-m);
    font-weight: var(--qt-font-semibold);
    color: var(--qt-text-default);
  }
</style>
