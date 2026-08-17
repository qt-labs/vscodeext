<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type ExEntry } from '@shared/ex-browser';
  import * as utils from '@/utils/utils';

  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';
  import ExTagList from '../others/ExTagList.svelte';
  import ExThumbnail from '../others/ExThumbnail.svelte';
  import ExSeparator from '../others/ExSeparator.svelte';

  let {
    example
  }: {
    example: ExEntry;
  } = $props();

  function select() {
    viewlogic.selectExample(example);
  }
</script>

<div
  data-role="item-area"
  class="w-full h-full flex flex-col relative"
  class:selected={example === ui.selected.example}
  role="button"
  tabindex="0"
  onclick={select}
  onkeydown={(e) => {
    if (e.key === 'Enter') {
      select();
    }
  }}
>
  <div data-role="item-thumbnail">
    <ExThumbnail {example} />
  </div>

  <div data-role="item-module" class="absolute top-[8px] left-[8px]">
    {utils.addSpaceBeforeUppercase(example.module)}
  </div>

  <div data-role="item-name">
    {example.name}
  </div>

  <ExSeparator />
  <ExTagList usage="card" tags={example.tags} />
</div>

<style>
  [data-role='item-area'] {
    padding: var(--qt-spacing-xl);
    gap: var(--qt-spacing-m);
  }

  [data-role='item-thumbnail'] {
    flex: 1;
    min-height: 110px;
    background: var(--qt-bg-default);
    overflow: hidden;
  }

  [data-role='item-module'] {
    padding: 0 6px;
    color: #f2f2f2;
    background: rgba(0, 0, 0, 0.62);
    border-radius: var(--qt-radius-s);
    font-size: var(--qt-font-3xs);
    font-weight: var(--qt-font-semibold);
    line-height: 1.8;
  }
</style>
