<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Checkbox from 'flowbite-svelte/Checkbox.svelte';
  import P from 'flowbite-svelte/P.svelte';
  import Button from 'flowbite-svelte/Button.svelte';

  import Overlay from '@/comps/Overlay.svelte';
  import { qmltrace as texts } from '@/apps/texts';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  const t = texts.featuresOverlay;
  const all = $derived.by(() => {
    const list = texts.featureNames.map(([feature, label]) => {
      return { count: 0, label, feature };
    });

    if (data.flame) {
      for (const [key, value] of Object.entries(data.flame.metadata.stats)) {
        const i = list.findIndex((item) => item.feature === key.toLowerCase());
        if (i >= 0) {
          list[i].count = value;
        }
      }
    }

    return list;
  });

  function onCheckChanged(e: Event) {
    const target = e.target as HTMLInputElement;
    const feature = target.value;
    viewlogic.setFeatureEnabled(feature, target.checked);
    viewlogic.getFlameGraph(ui.kind);
  }

  function onMouseEvent(ev: MouseEvent) {
    const target = ev.target as HTMLParagraphElement;
    const feature = target.dataset.feature

    if (ev.type === 'mouseenter' || ev.type === 'mouseleave') {
      viewlogic.setHighlightedFeature(ev.type === 'mouseenter' ? feature : undefined);
      ev.stopPropagation();
    }
  }

</script>

<Overlay
  title={texts.featuresOverlay.title}
  class="min-w-[200px]"
  titleClass="h-[32px]"
  bind:collapsed={ui.overlays.features.collapsed}
  onCloseClicked={() => { ui.overlays.features.visible = false; }}
>
  <div class="flex flex-col gap-1">
    {#each all as item, key (key)}
      <P
        class="flex flex-row"
        data-feature={item.feature}
        onmouseenter={onMouseEvent}
        onmouseleave={onMouseEvent}
      >
        <Checkbox
          class="qt-checkbox grow select-none"
          value={item.feature}
          checked={ui.features.enabled.has(item.feature)}
          onchange={onCheckChanged}
        >
          {item.label}
        </Checkbox>
        <div class="qt-label dimmed select-none pointer-events-none m-0! pr-1">
          {item.count || ''}
        </div>
      </P>
    {/each}

    <div class='flex flex-row mt-3 gap-2'>
      <div class='grow'></div>
      <Button
        class='qt-button p-2'
        onclick={() => {
          viewlogic.setAllFeaturesEnabled(true);
          viewlogic.getFlameGraph(ui.kind);
        }}
      >
        {t.selectAllButton}
      </Button>

      <Button
        class='qt-button p-2'
        onclick={() => {
          viewlogic.setAllFeaturesEnabled(false);
          viewlogic.getFlameGraph(ui.kind);
        }}
      >
        {t.clearButton}
      </Button>
    </div>
  </div>
</Overlay>
