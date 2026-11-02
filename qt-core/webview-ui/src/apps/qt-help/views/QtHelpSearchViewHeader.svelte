<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { qtHelp as texts } from '@/apps/texts';
  import QtHelpInputBox from '../others/QtHelpInputBox.svelte';
  import { ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  let {
    visible = false
  } = $props();

  let inputEl = $state<HTMLInputElement>();

  $effect(() => {
    if (visible) {
      inputEl?.focus();
      inputEl?.select();
    }
  })
</script>

<div class='flex flex-row w-full gap-2'>
  <span class='self-center'>
    {texts.search.title}
  </span>

  <QtHelpInputBox
    bind:inputEl={inputEl}
    bind:value={ui.search.keyword}
    placeholder={texts.search.placeholder}
    onSearch={() => {
      viewlogic.search(ui.search.keyword);
    }}
  />
</div>
