<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { Checkbox } from 'flowbite-svelte';

  import { toBool } from '@/utils/utils';
  import * as texts from '@/apps/texts';
  import type { PresetPromptStep } from './types.svelte';

  let {
    step = undefined as PresetPromptStep | undefined,
    onValueChanged = (_step: PresetPromptStep, _value: unknown) => {}
  } = $props();

  let checked = $state(false);

  onMount(() => {
    if (step?.default) {
      checked = toBool(step.default);
    }
  });
</script>

<Checkbox
  class="qt-checkbox"
  bind:checked
  on:change={() => {
    onValueChanged(step, checked);
  }}
>
  {texts.wizard.buttons.yes}
</Checkbox>
