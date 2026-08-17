<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { icons } from '@/symbols';
  import { ui } from '../states.svelte';
</script>

<div data-root class="flex flex-row">
  {@render modeButton('grid')}
  {@render modeButton('list')}
</div>

{#snippet modeButton(mode: 'grid' | 'list')}
  {@const Comp = mode === 'grid' ? icons.Grid : icons.List}
  <button
    data-role="view-mode"
    class="qt-button flex justify-center"
    aria-pressed={ui.selected.viewMode === mode}
    onclick={() => {
      ui.selected.viewMode = mode;
    }}
  >
    <Comp />
  </button>
{/snippet}

