<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import QtHelpTocViewHeader from '../views/QtHelpTocViewHeader.svelte';
  import QtHelpTocViewContent from '../views/QtHelpTocViewContent.svelte';
  import QtHelpIndexViewHeader from '../views/QtHelpIndexViewHeader.svelte';
  import QtHelpIndexViewContent from '../views/QtHelpIndexViewContent.svelte';
  import QtHelpSearchViewHeader from '../views/QtHelpSearchViewHeader.svelte';
  import QtHelpSearchViewContent from '../views/QtHelpSearchViewContent.svelte';

  import { qtHelp as texts } from '@/apps/texts';
  import { data, ui } from '../states.svelte';
  import { type UiMode } from '../types.svelte';

  interface Props {
    mode: UiMode;
  }

  let {
    mode
  }: Props = $props();

  const itemCount = $derived.by(() => {
    switch (mode) {
      case 'toc': return data.toc.length;
      case 'index': return ui.index.model.items.length;
      case 'search': return data.search.result.length;
    }
  });

  const Header = $derived.by(() => {
    switch (mode) {
      case 'toc': return QtHelpTocViewHeader;
      case 'index': return QtHelpIndexViewHeader;
      case 'search': return QtHelpSearchViewHeader;
    }
  });

  const Content = $derived.by(() => {
    switch (mode) {
      case 'toc': return QtHelpTocViewContent;
      case 'index': return QtHelpIndexViewContent;
      case 'search': return QtHelpSearchViewContent;
    }
  });

</script>

<div data-role='area' class='flex flex-col w-full h-full'>
  <div data-role='header'>
    <Header visible={ui.mode === mode} />
  </div>

  <div data-role='content' class='grow'>
    <Content />
  </div>

  <span data-role="footer">
    {texts.totalItems(itemCount)}
  </span>
</div>

<style>
  [data-role='area'] {
    min-height: 0;
    overflow: hidden;
  }

  [data-role='header'] {
    padding: 5px 5px 5px 10px;
    background: var(--qt-bg-subtle);
    border-bottom: 1px solid var(--qt-stroke-subtle);
  }

  [data-role='content'] {
    overflow: auto;
  }

  [data-role='footer'] {
    padding: 5px 10px;
    text-align: right;
    background: var(--qt-bg-subtle);
    border-top: 1px solid var(--qt-stroke-subtle);
  }
</style>
