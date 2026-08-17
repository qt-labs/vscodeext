<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { glyphs } from '@/symbols';
  import { tooltip } from '@/utils/actions';
  import { exBrowser as texts } from '@/apps/texts';

  import ExToolButton from '../others/ExToolButton.svelte';
  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  const poolDirPath = $derived(ui.selected.package?.poolDir.fsPath);
</script>

<div
  data-root
  class="flex-1 flex flex-row"
  use:tooltip={{ text: texts.catalog.locationInfo }}
>
  <span data-role="info-icon">
    {glyphs.info}
  </span>

  <span data-role="location" class="flex-1">
    {poolDirPath ?? '-'}
  </span>

  <div use:tooltip={{ text: texts.catalog.revealLocationTooltip }}>
    <ExToolButton
      onClicked={() => {
        if (poolDirPath) {
          viewlogic.openFolder(poolDirPath);
        }
      }}
    >
      {glyphs.arrowRightTop}
    </ExToolButton>
  </div>
</div>

<style>
  [data-root] {
    align-items: center;
    gap: 8px;
    color: var(--qt-text-muted);
    flex-shrink: 0;
    padding: 8px 14px;
    background: var(--qt-bg-default);
  }

  [data-role='info-icon'] {
    font-size: var(--qt-font-m);
    user-select: none;
  }

  [data-role='location'] {
    font-size: var(--qt-font-xs);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
