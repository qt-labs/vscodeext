<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type ExEntry } from '@shared/ex-browser';
  import * as utils from '@/utils/utils';
  import { exBrowser } from '@/apps/texts';

  import { ui } from '../states.svelte';
  import ExTagList from '../others/ExTagList.svelte';
  import ExSeparator from '../others/ExSeparator.svelte';
  import ExDetailsFileLists from './ExDetailsFileLists.svelte';

  const keys = ['version', 'module', 'files', 'cat', 'tags'];
  const texts = exBrowser.details.details;
</script>

<div data-root class="grid grid-cols-[max-content_1fr]">
  {#each keys as key (key)}
    <div data-role="name">
      {texts.itemNames[key]}
    </div>

    <div data-role="value">
      {@render rowContent(key, ui.selected.example)}
    </div>

    <div class="col-span-2">
      <ExSeparator opacity={0.6} />
    </div>
  {/each}
</div>

<!-- snippets -->
{#snippet rowContent(key: string, example: ExEntry | undefined)}
  {#if key === 'version'}
    {utils.extractQtVersion(ui.selected.package?.name ?? '')}

  {:else if key === 'module'}
    {utils.addSpaceBeforeUppercase(example?.module ?? '')}

  {:else if key === 'files'}
    <ExDetailsFileLists />

  {:else if key === 'cat'}
    {#each example?.categories as cat (cat)}
      <div>{cat}</div>
    {/each}

  {:else if key === 'tags'}
    <ExTagList usage="details" tags={example?.tags} />

  {/if}
{/snippet}

<style>
  [data-root] {
    font-size: var(--qt-font-xs);
    line-height: 18px;
    word-break: break-word;
    flex-shrink: 0;
  }

  [data-role='name'] {
    padding: 3px 0px;
    min-width: 60px;
    color: var(--qt-text-muted);
  }

  [data-role='value'] {
    padding: 3px 0px;
    color: var(--qt-text-default);
  }
</style>

