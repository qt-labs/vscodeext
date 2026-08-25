<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  let {
    imageSrc = '',
    imageWidth = '150px',
    text = '',
    textHeightLines = 1,
    author = '',
    date = '',
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
  <div class='flex flex-col grow !gap-0 px-2 py-1 min-w-0'>
    {@render Title(text)}
    {@render Annotation(author, date)}
  </div>

  {@render Image()}
</button>

<!-- snippets -->
{#snippet Title(text: string)}
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
{/snippet}

{#snippet Annotation(author: string, date: string)}
  <div class='annotation flex flex-row w-full qt-label dimmed'>
    <span class='author self-start'>{author}</span>
    <div class='grow'></div>
    <span class='date self-end'>{date}</span>
  </div>
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

<style>
  .annotation {
    min-width: 0;

    & .author,
    & .date {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
</style>
