<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Copy, Trash2 } from '@lucide/svelte';

  import * as texts from '@/apps/texts';
  import * as viewlogic from './viewlogic.svelte';
  import PickerList from '@/comps/PickerList.svelte';

  let {
    open = false,
    onClosed = () => {}
  } = $props();

  const items = [
    {
      icon: Copy,
      text: texts.qrc.menu.copyUrl,
      action: () => { viewlogic.runClipboardAction('copy-resource-url'); }
    },
    {
      icon: Copy,
      text: texts.qrc.menu.copyPath,
      action: () => { viewlogic.runClipboardAction('copy-resource-path'); }
    },
    {
      icon: Trash2,
      text: texts.qrc.menu.delete,
      action: () => { viewlogic.removeCurrent(); }
    }
  ];

  function onItemClickedAt(index: number) {
    items[index].action();
    open = false;
    onClosed();
  }
</script>

{#if open}
  <PickerList
    active={true}
    {items}
    width={200}
    currentIndex="-1"
    onRejected={onClosed}
    onAccepted={onItemClickedAt}
  />
{/if}
