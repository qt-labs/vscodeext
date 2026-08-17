<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';

  import { type ExEntry } from '@shared/ex-browser';
  import * as viewlogic from '../viewlogic.svelte';

  let {
    example = undefined as ExEntry | undefined,
    lazyLoading = true,
    onLoaded = (() => {}) as (() => void) | undefined
  } = $props();

  let container = $state<HTMLDivElement | undefined>();
  let srcPromise = $state<Promise<string> | undefined>(undefined);

  function fetchSrc() {
    if (example) {
      srcPromise = viewlogic.resolveImageUrl(example);
    }
  }

  $effect(() => {
    void example; // to re-run when example changes
    srcPromise = undefined;
    if (!lazyLoading) {
      fetchSrc();
      return;
    }

    if (container) {
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          fetchSrc();
          observer.disconnect();
        }
      });

      observer.observe(container);
      return () => observer.disconnect();
    }
  });

  onMount(fetchSrc);
</script>

<div bind:this={container} data-root class="w-full h-full relative">
  {#if example}
    {#await srcPromise then src}
      <img
        {src}
        alt={example.imageUrl}
        title={example.description}
        class="w-full h-full absolute"
        onload={onLoaded}
      />
    {:catch _err}
      <div class="wrap-anywhere">
        {example.imageUrl}
      </div>
    {/await}
  {/if}
</div>

<style>
  [data-root] {
    flex: 1;
    min-height: 220px;
    border-radius: var(--qt-radius-m);
    background: var(--qt-bg-default);
    overflow: hidden;

    & > img {
      object-fit: cover;
      object-position: top;
    }
  }
</style>
