<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Row from './Row.svelte';
  import Column from './Column.svelte';

  let {
    imageSrc = '',
    imageWidth = '150px',
    imageOnRight = true,
    text = '',
    textHeightLines = 1,
    annotationLeft = '',
    annotationRight = '',
    class: className = '',
    imageClass = '',
    imageContainerClass ='',
    onClicked = () => {}
  } = $props();

</script>

<button
  class={`qt-surface flex flex-row gap-2 hover:cursor-pointer ${className}`}
  onclick={() => {
    onClicked();
  }}
>
  {#if imageOnRight}
    {@render Text()}
    {@render Image()}
  {:else}
    {@render Image()}
    {@render Text()}
  {/if}
</button>

<!-- snippets -->
{#snippet Text()}
  <Column class='grow !gap-0 px-2 py-1'>
    <p
      class='qt-label grow text-left overflow-hidden'
      style={`
        height: calc(1.5rem * ${textHeightLines});
        display: -webkit-box;
        -webkit-line-clamp: ${textHeightLines};
        -webkit-box-orient: vertical;
      `}
  >
      {text}
    </p>
    <Row class='w-full qt-label dimmed'>
      <p class='self-start'>{annotationLeft}</p>
      <div class='grow'></div>
      <p class='self-end'>{annotationRight}</p>
    </Row>
  </Column>
{/snippet}

{#snippet Image()}
  {#if imageSrc.length !== 0}
    <div
      class={`relative flex shrink-0 bg-gray-500/50 ${imageContainerClass}`}
      style={`width: ${imageWidth};`}
    >
      <img
        src={imageSrc}
        alt={imageSrc}
        class={`absolute inset-0 w-full h-full object-cover ${imageClass}`}
      />
    </div>
  {/if}
{/snippet}