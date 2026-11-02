<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import ScrollToTopButton from '@/comps/ScrollToTopButton.svelte';
  import { ui } from '../states.svelte'
  import * as helpers from '../helpers';
  import * as viewlogic from '../viewlogic.svelte';
</script>

<div class='absolute left-0 bottom-0 w-full flex flex-row'>
  {#if ui.iframe.hoveredUri}
    <span data-role='hover-uri' class='self-end'>
      {helpers.toFileUriIfServer(ui.iframe.hoveredUri)}
    </span>
  {/if}

  <div class='grow'></div>

  {#if (ui.iframe.scrollTop ?? 0) > 200}
    <div class='absolute right-0 bottom-0 m-[5px]'>
      <ScrollToTopButton
        onClicked={() => {
          viewlogic.scrollToTop();
        }}
      />
    </div>
  {/if}
</div>

<style>
  [data-role='hover-uri'] {
    @apply truncate;
    padding: 2px 8px;
    border: 1px solid var(--qt-stroke-subtle);
    color: var(--qt-text-muted);
    background: var(--qt-bg-subtle);
    word-break: break-all;
  }
</style>
