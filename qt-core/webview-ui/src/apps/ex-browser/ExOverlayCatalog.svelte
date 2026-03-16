<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Tooltip from 'flowbite-svelte/Tooltip.svelte';
  import { Package, Funnel, ExternalLink, Info } from '@lucide/svelte';

  import Overlay from '@/comps/Overlay.svelte';
  import Separator from '@/comps/Separator.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import IconSection from '@/comps/IconSection.svelte';
  import { exBrowser as texts } from '@/apps/texts';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  let loading = $state(false);
  const poolDirPath = $derived(ui.selected.package?.poolDir.fsPath);
  const itemClass = 'w-full text-left whitespace-nowrap !py-1';
</script>

<button
  class='absolute inset-0 w-full h-full flex items-start'
  aria-label="close"
  onclick={(e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      viewlogic.setOverlayVisible('catalog', false);
    }
  }}
>
  <Overlay
    title={texts.catalog.title}
    collapsible={false}
    useDropShadow={true}
    titleClass="h-[32px] qt-label highlight pl-2"
    backgroundClass='!opacity-95'
    onCloseClicked={() => {
      viewlogic.setOverlayVisible('catalog', false);
    }}
  >
    <Column gap={false}>
      <Row class='!gap-4 p-2 min-h-[300px] min-w-[200px]'>
        {@render QtPackagesSection()}
        {@render CategoriesSection()}
      </Row>
      <Separator class='my-2' />
      {@render InsRootSection()}
    </Column>
  </Overlay>
</button>

<!-- snippets -->
{#snippet QtPackagesSection()}
  <Column gap={false} class='min-w-[180px]'>
    <IconSection icon={Package} text={texts.catalog.versions} class='mb-2' />
    {#each data.packages as p, i (p)}
      {@const prev = data.packages[i-1]}
      <Separator
        class='my-2'
        visible={i!== 0 && prev.poolDir.sourceType !== p.poolDir.sourceType}
      />

      <button class={`
        ${itemClass}
        ${ui.selected.package !== p ? 'qt-item' : 'qt-item-selected'}
      `}
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
  </Column>
{/snippet}

{#snippet CategoriesSection()}
  <Column gap={false} class='min-w-[200px]'>
    <IconSection icon={Funnel} text={texts.catalog.categories} class='mb-2' />
    {#each data.categories as cat, i (cat)}
      {@const prev = data.categories[i - 1]}
      {@const typeChanged = i > 0 && prev?.type !== cat.type}

      <Separator class='my-2' visible={typeChanged && cat.type === 'general'}/>
      <button
        class={`
          ${itemClass} flex flex-row gap-10
          ${(cat !== ui.filter.category) ? 'qt-item' : 'qt-item-selected'}
        `}
        onclick={async () => {
          await viewlogic.selectCategory(cat);
        }}
      >
        <div class="flex-1">{cat.name}</div>
        <div>{cat.count}</div>
      </button>
    {/each}
  </Column>
{/snippet}

{#snippet InsRootSection()}
  <Row class='items-center'>
    <Info />
    <Tooltip class='qt-tooltip text-left' placement='bottom' data-placement='bottom'>
      {texts.catalog.locationInfo}
    </Tooltip>

    <div class={`
      qt-label grow
      text-left whitespace-nowrap overflow-hidden overflow-ellipsis
    `}>
      {texts.catalog.location}: {poolDirPath ?? '-'}
    </div>

    <IconButton
      flat square
      class='!border-none !w-0'
      icon={ExternalLink}
      tooltip={texts.catalog.revealLocationTooltip}
      tooltipPlacement='top-end'
      onClicked={() => {
        if (poolDirPath) {
          viewlogic.openFolder(poolDirPath);
        }
      }}
    />
  </Row>
{/snippet}
