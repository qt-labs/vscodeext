<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import {
    X,
    Minus,
    Check,
    RefreshCcw,
    CircleSmall,
    TriangleAlert
  } from '@lucide/svelte';

  import { type ExtInfo } from '@shared/welcome';
  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import Overlay from '@/comps/Overlay.svelte';
  import Separator from '@/comps/Separator.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import { welcome as texts } from '@/apps/texts';

  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  const qtcoreVersion = $derived.by(() => {
    const core = data.ext.find((e) => e.id === 'theqtcompany.qt-core');
    return core?.version ?? '';
  });

  const okay = $derived.by(() => {
    const versions = new Set<string>(
      data.ext
        .map((ext) => ext.version)
        .filter((v) => v.length > 0)
    );

    return versions.size === 1;
  });
</script>

<Overlay
  title={texts.versions.title}
  collapsible={false}
  useDropShadow={true}
  class="w-[350px] max-h-full pointer-events-auto"
  titleClass="h-[32px] qt-label highlight pl-2"
  backgroundClass='!opacity-98'
  onCloseClicked={() => {
    ui.overlays.versions.visible = false;
  }}
>
  <Column class='gap-3 p-4'>
    {#each data.ext as info, i (i)}
      {@render ExtInfoRow(info)}
      <Separator />
    {/each}

    {#if !okay}
      {@render VersionMismatchWarning()}
    {/if}

    {@render RefreshIcon()}
  </Column>
</Overlay>

<!-- snippet -->
{#snippet ExtInfoRow(info: ExtInfo)}
  <Row class='w-full'>
    <button class='cursor-pointer'
      onclick={() => {
        viewlogic.openMarketplace(info.id);
      }}
    >
      <Row>
        {@render ExtStatusCircleIcon(info)}
        <p>{info.name}</p>
      </Row>
    </button>
    <div class='grow'></div>
    {@render ExtVersionAndBadge(info)}
    {@render ExtVersionWarning(info)}
  </Row>
{/snippet}

{#snippet ExtStatusCircleIcon(info: ExtInfo)}
  {#if info.version.length !== 0}
    <CircleSmall
      fill={info.active ? 'green' : 'gray'}
      stroke-opacity={0}
    />
  {:else}
    <X class='' color='gray' />
  {/if}
{/snippet}

{#snippet ExtVersionAndBadge(info: ExtInfo)}
  {#if info.preRelease}
    <p class='qt-badge'>PreRelease</p>
  {/if}

  <p>
    {info.version || texts.versions.notInstalled}
  </p>
{/snippet}

{#snippet ExtVersionWarning(info: ExtInfo)}
  {#if info.version.length === 0}
    <Minus />
  {:else if info.version !== qtcoreVersion}
    <TriangleAlert style='color: var(--qt-active-color);'/>
  {:else}
    <Check />
  {/if}
{/snippet}

{#snippet RefreshIcon()}
  <Row>
    <div class='grow'></div>
    <IconButton
      icon={RefreshCcw}
      text={texts.versions.btnRefresh}
      onClicked={async () => {
        void viewlogic.refreshAndReloadData('ext-info');
      }}
    />
  </Row>
{/snippet}

{#snippet VersionMismatchWarning()}
  <Row class='qt-warning p-2'>
    <TriangleAlert />
    <p>
      {texts.versions.mismatchError}
    </p>
  </Row>
{/snippet}
