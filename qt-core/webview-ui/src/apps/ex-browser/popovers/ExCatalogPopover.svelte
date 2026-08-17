<svelte:options runes={true} />

<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import ExCatalogHeader from './ExCatalogHeader.svelte';
  import ExCatalogFooter from './ExCatalogFooter.svelte';
  import ExCatalogQtVersions from './ExCatalogQtVersions.svelte';
  import ExCatalogCategories from './ExCatalogCategories.svelte';
</script>

<div data-root class="qt-popover flex flex-col">
  <ExCatalogHeader />

  <div data-section class="flex flex-row">
    <div data-versions><ExCatalogQtVersions /></div>
    <div data-categories class="flex-1"><ExCatalogCategories /></div>
  </div>

  <div data-section>
    <ExCatalogFooter />
  </div>
</div>

<style>
  [data-root] {
    width: 480px;
    font-size: var(--qt-font-m);
    overflow: hidden;
  }

  [data-section] {
    max-height: 340px;
    border-top: 1px solid var(--qt-separator-color);
  }

  [data-versions] {
    width: 160px;
    padding: 6px 0;
    min-height: 0;
    overflow-y: auto;
  }

  [data-categories] {
    border-left: 1px solid var(--qt-separator-color);
    padding: 6px 0;
    min-height: 0;
    overflow-y: auto;
  }
</style>
