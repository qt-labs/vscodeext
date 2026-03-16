<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Check } from '@lucide/svelte';

  import { type ExEntry } from '@shared/ex-browser';
  import ExThumbnail from './ExThumbnail.svelte';
  import { ui } from './states.svelte';
  import { exBrowser as texts } from '@/apps/texts';
  import * as viewlogic from './viewlogic.svelte';

  let {
    example = undefined as ExEntry | undefined,
  } = $props();

  let hovered = $state(false);
  let featured = $derived(example?.highlighted ? true : false);

  const qtDark = '#00414A';
  const qtLight = '#2CDE85';
  const opacity = $derived(hovered ? '100%' : '85%');
  const accentBackground = $derived(ui.theme.states.dark ? qtDark : qtLight);
  const accentForeground = $derived(ui.theme.states.dark ? qtLight : qtDark);
  const backgroundColor = $derived(featured ? accentBackground : '#999999');
  const foregroundColor = $derived(featured ? accentForeground : '#000000');

  function onClicked() {
    viewlogic.selectExample(example);
  }

  function createQtShapePath(size: string) {
    return `polygon(
      ${size} 0,
      100% 0,
      100% calc(100% - ${size}),
      calc(100% - ${size}) 100%,
      0 100%,
      0 ${size}
    );`
  }
</script>

<button
  class={`
    qt-surface !border-none relative group
    hover:-translate-y-2 transition-all duration-150 ease-out
    ${example?.highlighted ? 'row-span-2' : ''}
    `}
  style:padding={`calc(var(--spacing) * ${featured ? 0.8 : 0.4})`}
  style:clip-path={createQtShapePath('20px')}
  style:background-color={backgroundColor}
  onclick={onClicked}
  onmouseenter={() => { hovered = true; }}
  onmouseleave={() => { hovered = false; }}
>
  <div
    class='w-full h-full'
    style:clip-path={createQtShapePath('19px')}
  >
    {#if example}
      <ExThumbnail
        {example}
        lazyLoading={true}
        imageClass={`
          scale-110 brightness-85 saturate-85
          group-hover:brightness-100 group-hover:saturate-100
        `}
      />

      <div
        class='absolute left-0 bottom-0 w-full py-2 text-center'
        style:opacity={opacity}
        style:color={foregroundColor}
        style:background-color={backgroundColor}
      >
        <div class='whitespace-nowrap overflow-hidden overflow-ellipsis px-3'>
          {example.name}
        </div>
      </div>

      {#if featured}
        <div
          class={`
            absolute right-0 top-0 py-2 px-3 rounded-bl-2xl
            flex flex-row gap-1.5
          `}
          style:opacity={opacity}
          style:color={foregroundColor}
          style:background-color={backgroundColor}
        >
          <Check />
          {texts.featuredBadge}
        </div>
      {/if}
    {/if}
  </div>
</button>

