<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { P } from 'flowbite-svelte';

  import * as texts from '@/apps/texts';
  import SectionLabel from '@/comps/SectionLabel.svelte';
  import { data } from './states.svelte';
  import PresetList from './PresetList.svelte';
  import PresetTypeSelector from './PresetTypeSelector.svelte';
  import PresetOptionsTable from './PresetOptionsTable.svelte';
  import PresetOptionsHeader from './PresetOptionsHeader.svelte';
</script>

<div
  class={`
      grow grid gap-2
      grid-rows-[min-content_1fr]
      grid-cols-[min-content_minmax(300px,1fr)_1fr]
      `}
>
  <SectionLabel text={texts.wizard.presetList} class="w-full col-span-3" />
  <PresetTypeSelector />
  <PresetList />
  <div class="flex flex-col">
    <SectionLabel text={texts.wizard.description} />
    <div>
      <P class="qt-label whitespace-pre-wrap leading-relaxed"
        >{(data.selected.preset?.description ?? '').replaceAll('\n', '\n\n')}
      </P>
    </div>
    <div class="flex-grow"></div>

    {#if data.selected.preset?.steps}
      <PresetOptionsHeader />
      <PresetOptionsTable />
    {/if}
  </div>
</div>
