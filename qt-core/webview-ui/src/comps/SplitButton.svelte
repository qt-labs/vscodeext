<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { nanoid } from 'nanoid';
  import Button from 'flowbite-svelte/Button.svelte';
  import Dropdown from 'flowbite-svelte/Dropdown.svelte';
  import P from 'flowbite-svelte/P.svelte';
  import { ChevronDown } from '@lucide/svelte';

  let {
    text = '',
    icon = undefined,
    disabled = false,
    options = [] as { value: string; label: string }[],
    selectedValue = $bindable(''),
    onClicked = () => {},
    onValueChanged = (_value: string) => {}
  }: {
    text?: string;
    icon?: any;
    disabled?: boolean;
    options: { value: string; label: string }[];
    selectedValue?: string;
    onClicked?: () => void;
    onValueChanged?: (value: string) => void;
  } = $props();

  const id = `splitbutton_${nanoid()}`;
  let dropdownOpen = $state(false);

  function handleOptionClick(value: string) {
    selectedValue = value;
    dropdownOpen = false;
    onValueChanged(value);
  }

  function handleMainButtonClick() {
    onClicked();
  }

  function handleDropdownToggle(e: MouseEvent) {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  }

  const selectedLabel = $derived(
    options.find(opt => opt.value === selectedValue)?.label || text
  );

  const currentIndex = $derived(
    options.findIndex(opt => opt.value === selectedValue)
  );
</script>

<div class="inline-flex relative">
  <Button
    {disabled}
    class="qt-button rounded-r-none border-r-0"
    on:click={handleMainButtonClick}
  >
    {#if icon}
      {@const IconComp = icon}
      <IconComp class="mr-1" />
    {/if}
    {selectedLabel}
  </Button>
  <button
    {disabled}
    class="qt-button rounded-l-none px-2 {dropdownOpen ? 'active' : ''}"
    onclick={handleDropdownToggle}
  >
    <ChevronDown size={16} />
  </button>
  <Dropdown
    open={dropdownOpen}
    placement="top"
    classContainer="qt-picker-list"
    style="min-width: 200px; width: max-content;"
  >
    {#each options as option, i (option.value)}
      <P
        role="option"
        class={`qt-item ${i === currentIndex ? 'selected' : ''}`}
        onclick={() => handleOptionClick(option.value)}
      >
        {option.label}
      </P>
    {/each}
  </Dropdown>
</div>
