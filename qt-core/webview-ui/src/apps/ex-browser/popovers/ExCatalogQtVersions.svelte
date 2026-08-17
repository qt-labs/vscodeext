<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Separator from '@/comps/Separator.svelte';
  import { exBrowser as texts } from '@/apps/texts';
  import { data, ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  let loading = $state(false);
</script>

<div class="qt-item-list flex flex-col">
  <span class="title">{texts.catalog.versions}</span>

  {#each data.packages as p, i (p)}
    {@const prev = data.packages[i - 1]}
    <Separator
      class="my-2"
      visible={i !== 0 && prev.poolDir.sourceType !== p.poolDir.sourceType}
    />

    <button
      class="item"
      class:active={ui.selected.package === p}
      title={p.poolDir.fsPath}
      onclick={async () => {
        if (!loading) {
          loading = true;
          await viewlogic.selectPackage(p);
          loading = false;
        }
      }}
    >
      {p.subDir}
    </button>
  {/each}
</div>

<style>
  .qt-item-list .item.active {
    background: var(--qt-accent-info);
    color: var(--qt-button-fg);
  }
</style>
