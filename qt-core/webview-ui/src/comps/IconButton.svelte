<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import type { Placement } from '@floating-ui/dom';
  import { Button, Tooltip } from 'flowbite-svelte';
  import { CheckOutline } from 'flowbite-svelte-icons';

  let {
    id = '',
    text = '',
    tooltip = '',
    tooltipPlacement = 'top' as Placement,
    icon = CheckOutline,
    flat = false,
    visible = true,
    disabled = false,
    class: className = '',
    onClicked = () => {}
  } = $props();
</script>

{#if visible}
  <Button
    {disabled}
    class={`qt-button ${flat ? 'flat' : ''} ${className}`}
    on:click={() => {
      onClicked(id);
    }}
  >
    {@const IconComp = icon}
    {#if IconComp}
      <IconComp class="mr-1" />
    {/if}
    {text}
  </Button>

  {#if tooltip.length !== 0}
    <Tooltip
      placement={tooltipPlacement}
      data-placement={tooltipPlacement}
      class="qt-tooltip"
      offset={10}
    >
      {tooltip}
    </Tooltip>
  {/if}
{/if}
