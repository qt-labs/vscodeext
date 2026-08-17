<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { ExActionTypes } from '@shared/ex-browser';
  import { icons } from '@/symbols';
  import { exBrowser } from '@/apps/texts';
  import { tooltip } from '@/utils/actions';

  import ExToolButton from '../others/ExToolButton.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  const texts = exBrowser.details.actions.openDoc;
  const run = (action: ExActionTypes) => (e: MouseEvent) => {
    e.stopPropagation();
    viewlogic.runExAction(action);
  };
</script>

<button
  class="qt-button flex flex-row grow relative"
  data-variant="secondary"
  onclick={run('doc-open-internal')}
>
  <icons.FileTag />
  <span class="flex-1">{texts.button}</span>
  <div
    class="qt-absolute-cy right-[4px]"
    use:tooltip={{ text: texts.openExtTooltip }}
  >
    <ExToolButton onClicked={run('doc-open-external')}>
      <icons.ExtLink size={12} />
    </ExToolButton>
  </div>
</button>
