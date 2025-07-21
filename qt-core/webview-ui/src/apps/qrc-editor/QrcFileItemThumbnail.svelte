<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { File } from '@lucide/svelte';

  import { data } from './states.svelte';
  import { FileNodeWrapper } from './types.svelte';
  import * as viewlogic from './viewlogic.svelte';

  let {
    file = new FileNodeWrapper()
  }: {
    file: FileNodeWrapper
  } = $props();

  let info = $derived.by(() => { return data.fileInfo[file.text]; });
  let url = $derived.by(() => { return info?.thumbnailUrl; });
  const sizeClass = 'w-[16px] h-[16px]';

  onMount(() => {
    viewlogic.updateFileInfo(file);
  });
</script>

{#if info && info.thumbnailUrl.length !== 0}
  <img src={url} alt="thumbnail"
    class={`${sizeClass} object-contain qt-checker-4px`}
  />
{:else}
  <div class={`flex items-center justify-center ${sizeClass}`}>
    {#if info?.exists}
      <File />
    {/if}
  </div>
{/if}
