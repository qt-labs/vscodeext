<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import type { Component } from 'svelte';
  import { P } from 'flowbite-svelte';

  import { data, ui } from './states.svelte';
  import type { PresetPromptStep } from './types.svelte';
  import PromptStepInput from './PromptStepInput.svelte';
  import PromptStepPicker from './PromptStepPicker.svelte';
  import PromptStepConfirm from './PromptStepConfirm.svelte';

  const steps = $derived(data.selected.preset?.steps);

  type Props = {
    step: PresetPromptStep | undefined;
    onValueChanged: (_step: PresetPromptStep, _value: unknown) => void;
  };

  const stepComponents: Record<string, Component<Props, object, ''>> = {
    input: PromptStepInput,
    picker: PromptStepPicker,
    confirm: PromptStepConfirm
  };

  function onValueChanged(step: PresetPromptStep, value: unknown) {
    ui.unsavedOptionChanges[step.id] = value;
  }
</script>

{#if steps}
  <div class="grid grid-cols-[1fr_max-content] gap-1">
    {#each steps as step (step.id)}
      <P class="qt-label">{step.question}</P>
      {#if step.type in stepComponents}
        {@const Comp = stepComponents[step.type]}
        <div class="flex item-center min-w-[150px]">
          <Comp {step} {onValueChanged} />
        </div>
      {:else}
        <P class="qt-label">{step.default}</P>
      {/if}
    {/each}
  </div>
{/if}
