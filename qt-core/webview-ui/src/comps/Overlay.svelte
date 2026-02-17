<!--
  Copyright (C) 2026 The Qt Company Ltd.
  SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  import { ChevronDown, X } from '@lucide/svelte';

  import IconButton from './IconButton.svelte';

  let {
    title = '(title)',
    closable = true,
    collapsible = true,
    collapsed = $bindable(false),
    class: className = '',
    bodyClass: bodyClassName = '',
    titleClass: titleClassName = '',
    backgroundClass: backgroundClassName = '',
    toolbar = undefined as Snippet | undefined,
    children = undefined as Snippet | undefined,
    onTitleClicked = () => {},
    onCloseClicked = () => {}
  } = $props();

  let hovered = $state(false);

  function onTitleButtonClicked() {
    if (collapsible) {
      collapsed = !collapsed;
    }

    onTitleClicked();
  }
</script>

<div
  class={`relative flex flex-col min-w-[100px] p-1 gap-1 ${className}`}
  role='toolbar'
  tabindex='0'
  onmouseenter={() => { hovered = true; }}
  onmouseleave={() => { hovered = false; }}
>
  <!-- background -->
  <div
    class={`
      absolute w-full h-full -z-1 top-0 left-0 qt-overlay
      ${hovered ? '' : (collapsed ? 'opacity-20' : 'opacity-80')}
      ${backgroundClassName}
    `}
  >
  </div>

  <!-- title -->
  <div class={`flex flex-row gap-2 items-stretch ${titleClassName}`}>
    <button
      class={`
        flex flex-row gap-1 items-center
        ${toolbar ? '' : 'grow'}
        ${collapsible ? 'cursor-pointer' : ''}
      `}
      onclick={onTitleButtonClicked}
    >
      <ChevronDown
        class={`
          transition-transform duration-200 flex-shrink-0
          ${collapsible && collapsed ? '-rotate-90' : ''}
        `}
      />
      <div class="qt-label-lighlight whitespace-nowrap">
        {title}
      </div>
    </button>

    {@render toolbar?.()}

    {#if closable}
      <IconButton
        icon={X} flat square
        class='w-1 border-0!'
        onClicked={() => { onCloseClicked(); }}
      />
    {/if}
  </div>

  <!-- body -->
  {#if !collapsible || !collapsed}
    <div
      class={`w-full p-1 ${bodyClassName}`}
      transition:slide={{ duration: 150 }}
    >
      {@render children?.()}
    </div>
  {/if}
</div>
