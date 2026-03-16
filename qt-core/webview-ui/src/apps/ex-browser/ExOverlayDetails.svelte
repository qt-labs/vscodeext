<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import {
    Tag,
    Plus,
    Funnel,
    Package,
    BookText,
    ChevronDown,
    ExternalLink,
    ArrowLeftToLine,
  } from '@lucide/svelte';

  import { type ExEntry } from '@shared/ex-browser';
  import Overlay from '@/comps/Overlay.svelte';
  import Separator from '@/comps/Separator.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import Row from '@/comps/Row.svelte';
  import Flow from '@/comps/Flow.svelte';
  import Column from '@/comps/Column.svelte';
  import IconSection from '@/comps/IconSection.svelte';
  import { exBrowser as texts } from '@/apps/texts';

  import ExThumbnail from './ExThumbnail.svelte';
  import ExProjectFileList from './ExProjectFileList.svelte';
  import ExProjectCreationInput from './ExProjectCreationInput.svelte';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  let example = $derived(ui.selected.example);
  const overlay = $derived(ui.overlays.details);
  const resolvedPaths = $derived.by(() => {
    const id = ui.selected.example?.projectPath;
    return id ? data.resolvedPaths[id] : undefined;
  });
</script>

{#if example}
  <Overlay
    bind:collapsed={overlay.collapsed}
    title={example.name || '-'}
    class="w-[550px] !p-0"
    useDropShadow={true}
    bodyClass='!p-0'
    titleClass="h-[32px] qt-label highlight pl-2"
    backgroundClass='!opacity-95'
    onCloseClicked={() => { overlay.visible = false; }}
  >
    {#snippet toolbar()}
      {@render TitleToolbar()}
    {/snippet}

    <Column class='w-full py-2 !gap-0'>
      {@render TopSection()}

      {#if overlay.expanded}
        <Separator />
        <ExProjectCreationInput />
        <Separator />
      {/if}

      {@render InformationSection(example)}
      <Separator />
      {@render MetaDataSection(example)}
    </Column>
  </Overlay>
{/if}

{#snippet TitleToolbar()}
  <button
    class="grow flex flex-row items-center cursor-pointer min-w-0"
    onclick={() => { overlay.collapsed = !overlay.collapsed }}
  >
    {#if overlay.collapsed && example?.projectPath}
      <div class="qt-label dimmed truncate min-w-0">
        {example.projectPath}
      </div>
    {/if}

    <div class="grow"></div>
    <IconButton
      flat square
      icon={ArrowLeftToLine}
      class={`w-1 border-0! ${overlay.alignLeft ? 'rotate-180' : ''}`}
      onClicked={() => { overlay.alignLeft = !overlay.alignLeft; }}
    />
  </button>
{/snippet}

{#snippet TopSection()}
  <Row class='max-h-[42px] mx-4 mb-4'>
    <IconButton
      icon={overlay.expanded ? ChevronDown : Plus}
      text={texts.details.newProject.button}
      tooltip={texts.details.newProject.tooltip}
      onClicked={() => {
        viewlogic.setNewProjectFormVisible(!overlay.expanded);
      }}
    />

    <div class='grow'></div>

    <IconButton
      flat square
      icon={BookText}
      text={texts.details.doc.button}
      tooltip={texts.details.doc.tooltip}
      disabled={(resolvedPaths?.doc.length ?? 0) === 0}
      onClicked={() => {
        viewlogic.runExAction('doc-open-internal');
      }}
    />
    <IconButton
      flat square
      icon={ExternalLink}
      tooltip={texts.details.doc.openExtTooltip}
      tooltipPlacement='top-end'
      disabled={(resolvedPaths?.doc.length ?? 0) === 0}
      onClicked={() => {
        viewlogic.runExAction('doc-open-external');
      }}
    />
  </Row>
{/snippet}

{#snippet InformationSection(example: ExEntry)}
  <Row class='w-full p-4'>
    <Column class='min-w-0 flex-1'>
      <div class='min-h-[150px] flex-1'>
        {example.description}
      </div>
      <ExProjectFileList />
    </Column>

    <div class='border-1 border-gray-500/20'>
      <ExThumbnail
        {example}
        class='!w-[180px]'
        imageClass='!object-contain !object-center'
      />
    </div>
  </Row>
{/snippet}

{#snippet MetaDataSection(example: ExEntry)}
  <Column class='p-4'>
    <!-- version -->
    <IconSection icon={Package}>
      <button
        class='qt-border-radius cursor-pointer'
        onclick={() => {
          viewlogic.setOverlayVisible('catalog', true);
        }}
      >
        {ui.selected.package?.name ?? '-'}
      </button>
    </IconSection>

    <!-- category -->
    <IconSection icon={Funnel}>
      {#if example.categories.length !== 0}
        <Flow>
          {#each example.categories as cat, i (i)}
            <button
              class='qt-border-radius cursor-pointer'
              onclick={() => {
                void viewlogic.selectCategory(cat);
              }}
            >
              {`${cat}${(i !== example.categories.length - 1) ? ',' : ''}`}
            </button>
          {/each}
        </Flow>
      {:else}
        -
      {/if}
    </IconSection>

    <!-- tags -->
    <IconSection icon={Tag}>
      {#if example.tags.length !== 0}
        <Flow>
          {#each example.tags as tag (tag)}
            <button
              class={`
                ${viewlogic.hasTagInQuery(tag) ? 'qt-button' : 'qt-button-flat'}
                px-2 py-0.5 cursor-pointer
              `}
              onclick={() => {
                void viewlogic.toggleTagInQuery(tag);
              }}
            >
              {tag}
            </button>
          {/each}
        </Flow>
      {:else}
        -
      {/if}
    </IconSection>
  </Column>
{/snippet}

