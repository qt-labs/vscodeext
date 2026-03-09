<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Button from 'flowbite-svelte/Button.svelte';
  import {
    Type,
    Braces,
    Funnel,
    ZoomIn,
    ZoomOut,
    Settings,
    Fullscreen
  } from '@lucide/svelte';

  import * as viewlogic from './viewlogic.svelte';
  import { data, ui } from './states.svelte';
  import { qmltrace as texts } from '@/apps/texts';
  import { type FlameGraphKind } from '@shared/qml-trace';
  import IconButton from '@/comps/IconButton.svelte';

  const t = texts.header;
  const allKindButtons = [
    { kind: 'time' as FlameGraphKind, text: t.buttons.time },
    { kind: 'memory' as FlameGraphKind, text: t.buttons.memory },
    { kind: 'allocations' as FlameGraphKind, text: t.buttons.alloc },
  ]

  const roleButtons = [
    { role: 'in', icon: ZoomIn, tooltip: t.tooltips.zoomIn, round: 'l' },
    { role: 'out', icon: ZoomOut, tooltip: t.tooltips.zoomOut, round: 'x'  },
    { role: 'full', icon: Fullscreen, tooltip: t.tooltips.zoomOutFull, round: 'r' },
    { role: '_grow', icon: ZoomIn, tooltip: '', round: ''  },
    { role: 'config', icon: Settings, tooltip: t.tooltips.config, round: 'l' },
    { role: 'json', icon: Braces, tooltip: t.tooltips.jsonc, round: 'x' },
    { role: 'text', icon: Type, tooltip: t.tooltips.openAsText, round: 'r'  },
  ]

  const underlineClass =
    '[.vscode-high-contrast_&]:underline ' +
    '[.vscode-high-contrast_&]:underline-offset-5 ' +
    '[.vscode-high-contrast_&]:decoration-1  ';

  function onRoleButtonClicked(role: string) {
    if (role === 'in') {
      viewlogic.zoomTo('selected');
    } else if (role === 'out') {
      viewlogic.zoomTo('parent');
    } else if (role === 'full') {
      viewlogic.zoomTo('full');
    }

    if (role === 'config') {
      ui.overlays.config.visible = !ui.overlays.config.visible
    } else if (role === 'json') {
      viewlogic.openDataAsJsonc();
    } else if (role === 'text') {
      viewlogic.openFileInTextEditor();
    }
  }

</script>

<div class="w-full flex flex-row items-center gap-0 relative">
  <div class="pointer-events-auto flex flex-row">
    {#each allKindButtons as b, i (b.kind) }
      {@const lastIndex = allKindButtons.length - 1}
      <Button
        class={`
          qt-button${ui.kind === b.kind ? '' : '-flat'}
          -ml-px whitespace-nowrap
          ${i === 0 ? 'rounded-r-none!' : 'rounded-none!'}
          ${ui.kind === b.kind ? underlineClass : ''}
        `}
        onclick={() => {
          viewlogic.getFlameGraph(b.kind);
        }}
      >
        {b.text}
      </Button>
    {/each}

    <IconButton
      square
      class="w-1 rounded-l-none! -ml-px"
      flat={!ui.overlays.features.visible}
      icon={Funnel}
      tooltip={texts.header.tooltips.filter}
      tooltipPlacement='bottom'
      onClicked={(id: unknown, ev: MouseEvent) => {
        ui.overlays.features.visible = !ui.overlays.features.visible;
      }}
    />
  </div>

  <div class='w-[32px]'></div>

  {#each roleButtons as b, i (i)}
    {#if b.role === '_grow'}
      <div class="grow"></div>
    {:else}
      <IconButton
        flat square
        icon={b.icon}
        tooltip={b.tooltip}
        tooltipPlacement='bottom'
        class={`
          w-1 -ml-px
          ${b.round === 'l' ? 'rounded-r-none!' : ''}
          ${b.round === 'r' ? 'rounded-l-none!' : ''}
          ${b.round === 'x' ? 'rounded-none!' : ''}
        `}
        onClicked={() => onRoleButtonClicked(b.role)}
        visible={b.role !== 'text' || data.configs.filePath.endsWith('.qtd')}
        disabled={['in', 'out', 'full'].includes(b.role) && (
          (b.role === 'in')
            ? (!ui.selected || ui.selected.depth === 0 || (ui.base === ui.selected) || ui.selected._merged)
            : (!ui.base || ui.base?.depth === 0)
        )}
      />
    {/if}
  {/each}
</div>
