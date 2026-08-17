<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import './ExSidebar.css';
  import { exBrowser } from '@/apps/texts';

  import { ui } from '../states.svelte';
  import ExCloseButton from '../others/ExCloseButton.svelte';

  import ExActionDocs from './ExActionDocs.svelte';
  import ExActionNewProject from './ExActionNewProject.svelte';
  import ExActionRevealExample from './ExActionRevealExample.svelte';
  import ExThumbnailAndDesc from './ExThumbnailAndDesc.svelte';
  import ExDetailsTable from './ExDetailsTable.svelte';

  function close() {
    ui.sidebar.visible = false;
  }

  const texts = exBrowser.details;
  const sectionContent = [infoContent, actionContent, detailContent];
</script>

<div data-area='sidebar' class="flex flex-col gap-[20px]">
  {#each sectionContent as section, index (index)}
    <div class="flex flex-col gap-[4px]">
      {@render section()}
    </div>
  {/each}
</div>

<!-- snippets -->
{#snippet infoContent()}
  <div class="flex flex-row items-center">
    {@render title(texts.title)}
    <ExCloseButton onClicked={close} />
  </div>
  <ExThumbnailAndDesc />
{/snippet}

{#snippet actionContent()}
  {@render title(texts.actions.title)}
  <ExActionNewProject />
  <ExActionDocs />
  <ExActionRevealExample />
{/snippet}

{#snippet detailContent()}
  {@render title(texts.details.title)}
  <ExDetailsTable />
{/snippet}

{#snippet title(text: string)}
  <div data-role="title">{text}</div>
{/snippet}

<style>
  [data-role='title'] {
    flex: 1;
    color: var(--qt-text-muted);
    font-size: var(--qt-font-xs);
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
</style>
