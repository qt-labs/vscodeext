<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Picker from '@/comps/Picker.svelte';
  import type { PresetPromptStep, PickerItem } from './types.svelte';

  let {
    step = undefined as PresetPromptStep | undefined,
    onValueChanged = (_step: PresetPromptStep, _value: unknown) => {}
  } = $props();

  let defaultText = $derived(step?.default ?? '');
  let items = $derived.by(() => {
    if (!step?.items) {
      return [] as PickerItem[];
    }

    return step.items.map((e) => {
      return { text: e.text, icon: undefined };
    });
  });

  function onSelected(i: number) {
    onValueChanged(step, items[i].text);
  }
</script>

<Picker {items} {defaultText} {onSelected} showIcon={false} />
