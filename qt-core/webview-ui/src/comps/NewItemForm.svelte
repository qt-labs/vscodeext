<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import P from 'flowbite-svelte/P.svelte';
  import Checkbox from 'flowbite-svelte/Checkbox.svelte';
  import { Check, FolderOpen } from '@lucide/svelte';

  import * as texts from '@/apps/texts';
  import IconButton from '@/comps/IconButton.svelte';
  import SplitButton from '@/comps/SplitButton.svelte';
  import InputWithIssue from '@/comps/InputWithIssue.svelte';
  import { type NewItemFormController } from './NewItemForm.logic.svelte';

  let {
    controller,
    selectedType,
    class: className = '',
    fieldNameClass = ''
  } : {
    controller: NewItemFormController;
    selectedType: string; // 'project' | 'file';
    class?: string;
    fieldNameClass?: string;
  } = $props();

  let elNameInput: InputWithIssue;
  const states = $derived(controller.states);
  const openInOptions = [
    { value: 'newWindow', label: texts.wizard.openInOptions.newWindow },
    { value: 'addToWorkspace', label: texts.wizard.openInOptions.addToWorkspace }
  ];

  onMount(() => {
    if (elNameInput) {
      elNameInput.focus();
    }
  })

</script>

<div
  class={`w-full
    grid gap-2
    grid-cols-[max-content_1fr]
    grid-rows-[repeat(3,min-content)] ${className}`}
>
  {@render FieldName(texts.wizard.name)}
  {@render NameInput()}

  {@render FieldName(texts.wizard.workingDir)}
  {@render WorkingDirInput()}

  <div></div>
  {@render BottomControls()}
</div>

<!-- snippets -->
{#snippet FieldName(text: string)}
  <P class={`qt-label flex items-center ${fieldNameClass}`}>
    {text}
  </P>
{/snippet}

{#snippet NameInput()}
  <InputWithIssue
    bind:this={elNameInput}
    bind:value={states.name}
    onInput={() => {
      controller.fireEvent('inputChanged');
    }}
    level={states.issues.name.level}
    message={states.issues.name.message}
  />
{/snippet}

{#snippet WorkingDirInput()}
  <div class="w-full grid grid-cols-[min-content_1fr] gap-0">
    <IconButton
      icon={FolderOpen}
      class="qt-button px-2 py-0 rounded-r-none! -mr-0.5 focus:z-1 min-w-[36px]"
      tooltip={texts.wizard.workingDirTooltip}
      onClicked={() => {
        controller.fireEvent('browseClicked');
      }}
      />

    <InputWithIssue
      bind:value={states.workingDir}
      class="rounded-l-none!"
      onInput={() => {
        controller.fireEvent('inputChanged');
      }}
      level={states.issues.workingDir.level}
      message={states.issues.workingDir.message}
    />
  </div>
{/snippet}

{#snippet BottomControls()}
  <div class="flex flex-row gap-2">
    {#if selectedType === 'project'}
      <Checkbox
        class="self-start qt-checkbox grow"
        bind:checked={states.saveProjectDir}
      >
        {texts.wizard.workingDirSaveCheckbox}
      </Checkbox>
    {:else}
      <div class="grow"></div>
    {/if}

    {#if selectedType === 'project'}
      <SplitButton
        text={texts.wizard.buttons.create}
        icon={Check}
        disabled={!states.acceptable}
        options={openInOptions}
        bind:selectedValue={states.openIn}
        onClicked={() => {
          controller.fireEvent('createClicked');
        }}
        onValueChanged={() => {
          controller.fireEvent('openInChanged', states.openIn);
        }}
      />
    {:else}
      <IconButton
        class={selectedType === 'project' ? '!rounded-r-none' : ''}
        text={texts.wizard.buttons.create}
        icon={Check}
        disabled={!states.acceptable}
        onClicked={() => {
          controller.fireEvent('createClicked');
        }}
      />
    {/if}
  </div>
{/snippet}
