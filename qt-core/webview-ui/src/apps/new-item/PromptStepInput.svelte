<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { Input } from 'flowbite-svelte';
  import type { PresetPromptStep } from './types.svelte';

  let {
    step = undefined as PresetPromptStep | undefined,
    onValueChanged = (_step: PresetPromptStep, _value: unknown) => {}
  } = $props();

  let value = $state('');

  onMount(() => {
    if (step?.default) {
      value = step.default;
    }
  });
</script>

<Input
  type="text"
  class="qt-input w-full"
  bind:value
  on:input={() => {
    onValueChanged(step, value);
  }}
/>
