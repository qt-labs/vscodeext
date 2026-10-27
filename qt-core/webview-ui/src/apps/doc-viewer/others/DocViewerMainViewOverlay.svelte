<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import ScrollToTopButton from '@/comps/ScrollToTopButton.svelte';
  import { ui } from '../states.svelte'
  import * as viewlogic from '../viewlogic.svelte';
</script>

<div class='absolute right-0 bottom-0'>
  {#if (ui.iframe.scrollTop ?? 0) > 200}
    <ScrollToTopButton
      onClicked={() => {
        viewlogic.scrollToTop();
      }}
    />
  {/if}
</div>
