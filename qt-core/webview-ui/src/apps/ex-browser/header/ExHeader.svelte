<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ui } from '../states.svelte';
  import ExTagList from '../others/ExTagList.svelte';

  import './ExHeader.css';
  import ExHeaderBreadcrumb from './ExHeaderBreadcrumb.svelte';
  import ExHeaderTagsButton from './ExHeaderTagsButton.svelte';
  import ExHeaderSearchInput from './ExHeaderSearchInput.svelte';
  import ExHeaderViewModeButtons from './ExHeaderViewModeButtons.svelte';
</script>

<div data-area='header' class="flex flex-col shrink-0 gap-[7px]">
  <div class="flex flex-row gap-[6px]">
    <ExHeaderBreadcrumb />
    <ExHeaderTagsButton />
    <ExHeaderSearchInput />
    <ExHeaderViewModeButtons />
  </div>

  {#if ui.filter.tags.length}
    <ExTagList usage="header" tags={ui.filter.tags} />
  {/if}
</div>
