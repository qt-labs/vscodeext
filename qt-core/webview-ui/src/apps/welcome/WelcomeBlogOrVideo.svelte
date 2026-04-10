<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import * as format from '@/utils/format'
  import {
    isBlogArticle,
    type RssSource,
    type VideoEntry,
    type BlogArticle,
  } from '@shared/welcome';

  import EmptyState from '@/comps/EmptyState.svelte';
  import ImageTextCard from '@/comps/ImageTextCard.svelte';
  import { welcome as texts } from '@/apps/texts';

  import { data } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  let {
    source = 'blog' as RssSource,
    items = [] as (BlogArticle | VideoEntry)[]
  } = $props();

  const title = $derived(
    (source === 'blog') ? texts.blogTitle : texts.videoTitle
  );

  function nameText(item: BlogArticle | VideoEntry) {
    if (!isBlogArticle(item)) {
      return '';
    }

    // expected: "mail-id@qt.io (namea name)";
    const nameMatch = item.author.match(/\(([^)]+)\)/);
    return nameMatch?.[1] ?? '';
  };

  function dateText(item: BlogArticle | VideoEntry) {
    return format.dateAsLocaleString(new Date(item.publishedDate))
  };

</script>

<Column class='w-full gap-3'>
  <Row>
    {@render SectionTitle(title)}
    {@render ShowAllButton(() => {
      viewlogic.openWebsite(
        source === 'blog' ? 'qt-blogs' : 'qt-youtube-channel'
      );
    })}
  </Row>

  {#if items.length === 0}
    <EmptyState
      class='qt-panel !h-[300px]'
      text={texts.emptyData}
    />
  {:else}
    {#each items as item, i (i)}
      <ImageTextCard
        imageSrc={item.thumbnail}
        imageWidth='110px'
        imageOnRight={true}
        text={item.title}
        textHeightLines={2}
        annotationLeft={nameText(item)}
        annotationRight={dateText(item)}
        class='
          hover:-translate-x-1 hover:drop-shadow-sm
          hover:shadow-[-10px_0_0_0_var(--qt-active-color)]
          duration-100 ease-out drop-shadow-black
        '
        onClicked={() => {
          viewlogic.openUrl(item.link);
        }}
      />
    {/each}

    {@render TimestampButton(
      source,
      source === 'blog' ? data.timestamps.blog : data.timestamps.video
    )}
  {/if}
</Column>

{#snippet ShowAllButton(onClicked: () => void)}
  <button
    class='flex felx-row text-left hover:cursor-pointer'
    onclick={() => {
      onClicked();
    }}
  >
    {texts.showAll}
    <ChevronRight class='ml-2' />
  </button>
{/snippet}

{#snippet SectionTitle(text: string)}
  <p class='qt-label highlight !text-xl grow'>
    {text}
  </p>
{/snippet}


{#snippet TimestampButton(source: RssSource,  ms: number)}
  <Row class='justify-end -mt-1'>
    <button
      class='qt-label dimmed hover:cursor-pointer'
      onclick={() => {
        viewlogic.refreshAndReloadData(source);
      }}
    >
      {format.timeAgo(new Date(ms))}
    </button>
  </Row>
{/snippet}
