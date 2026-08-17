<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { ExActionTypes } from '@shared/ex-browser';
  import { icons } from '@/symbols';
  import { exBrowser } from '@/apps/texts';

  import * as viewlogic from '../viewlogic.svelte';

  const texts = exBrowser.details.actions.reveal;
  const run = (action: ExActionTypes) => (e: MouseEvent) => {
    e.stopPropagation();
    viewlogic.runExAction(action);
  };
</script>

<button
  class="qt-button flex flex-row grow relative"
  data-variant="secondary"
  onclick={run('project-reveal')}
>
  <icons.FolderOpen />
  <span class="flex-1">{texts.button}</span>
</button>
