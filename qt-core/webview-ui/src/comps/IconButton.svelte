<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { Placement } from '@floating-ui/dom';
  import { Button, Tooltip } from 'flowbite-svelte';
  import { Check } from '@lucide/svelte';

  let {
    id = '',
    text = '',
    tooltip = '',
    tooltipPlacement = 'top' as Placement,
    icon = Check as (typeof Check | undefined),
    flat = false,
    square = false,
    visible = true,
    disabled = false,
    class: className = '',
    iconClass = '',
    align = 'row' as 'row' | 'col',
    onClicked = () => {}
  } = $props();
</script>

{#if visible}
  <Button
    {disabled}
    class={`
      qt-button${flat ? '-flat' : ''} ${className}
      ${square ? 'aspect-square' : ''}
    `}
    on:click={(ev: MouseEvent) => {
      onClicked(id, ev);
      ev.stopPropagation();
    }}
  >
    {@const IconComp = icon}
    <div class={`
      flex flex-${align} items-center
      ${align === 'col' ? 'gap-1' : ''}
    `}>
      {#if IconComp}
        <IconComp
          class={`${text.length === 0 ? '-m-1' : 'mr-1'} ${iconClass}`}
        />
      {/if}
      {text}
    </div>
  </Button>

  {#if tooltip.length !== 0}
    <Tooltip
      placement={tooltipPlacement}
      data-placement={tooltipPlacement}
      class="qt-tooltip"
      strategy='fixed'
      offset={10}
    >
      {tooltip}
    </Tooltip>
  {/if}
{/if}
