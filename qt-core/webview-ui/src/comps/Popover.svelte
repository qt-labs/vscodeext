<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Snippet } from 'svelte';
  import { type Placement } from '@floating-ui/dom';
  import { clickOutside, portal, placeNear } from '@/utils/actions';
  import { type PopoverControllerBase } from './Popover.logic.svelte';

  interface Props {
    controller: PopoverControllerBase;
    offset?: number;
    placement?: Placement;
    zIndex?: number;
    onClose?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    controller,
    placement = 'bottom-start',
    offset = 0,
    zIndex = 1,
    onClose,
    children,
  }: Props = $props();

  function onClickOutside(e: MouseEvent) {
    onClose?.(e);
    controller.hide();
    e.stopPropagation();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && controller.visible) {
      controller.hide();
      e.stopPropagation();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if controller.visible}
  <div
    use:portal
    use:placeNear={{ ref: controller.refEl, placement, offset }}
    use:clickOutside={onClickOutside}
    style:z-index={zIndex}
  >
    {@render children()}
  </div>
{/if}
