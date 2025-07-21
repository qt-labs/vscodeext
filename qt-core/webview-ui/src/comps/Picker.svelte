<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';

  import type { PickerItem } from './types.svelte';
  import PickerList from './PickerList.svelte';
  import PickerTrigger from './PickerTrigger.svelte';

  let {
    open = $bindable(false),
    showIcon = true,
    items = [] as PickerItem[],
    defaultText = '',
    onSelected = (_: number) => {}
  } = $props();

  let width = $state(100);
  let currentIndex = $state(-1);
  let pickerList: PickerList;

  function onRejected() {
    open = false;
  }

  function onAccepted(i: number) {
    open = false;
    currentIndex = i;
    onSelected(currentIndex);
  }

  function onTriggered(r: DOMRect) {
    if (open) {
      open = false;
      return;
    }

    open = true;
    width = r.width;
    pickerList.focus();
    updateIndexFromDefault();
  }

  function updateIndexFromDefault() {
    if (currentIndex === -1 && defaultText.length > 0) {
      currentIndex = items.findIndex((e) => e.text === defaultText);
    }
  }

  onMount(updateIndexFromDefault);
</script>

<PickerTrigger
  text={items[currentIndex]?.text ?? '-'}
  active={open}
  {onTriggered}
/>

<PickerList
  bind:this={pickerList}
  active={open}
  {items}
  {width}
  {showIcon}
  {onAccepted}
  {onRejected}
  {currentIndex}
/>
