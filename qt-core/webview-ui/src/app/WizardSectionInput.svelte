<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Checkbox, Label } from 'flowbite-svelte';
  import { CheckOutline } from 'flowbite-svelte-icons';

  import IconButton from '@/comps/IconButton.svelte';
  import SectionLabel from '@/comps/SectionLabel.svelte';
  import InputWithIssue from '@/comps/InputWithIssue.svelte';
  import WorkingDirInput from './WorkingDirInput.svelte';
  import * as texts from './texts';
  import { data, input, ui } from './states.svelte';
  import {
    createItemFromSelectedPreset,
    validateInput
  } from './viewlogic.svelte';

  // let nameInputUi = $state<InputWithIssue | null>();

  // export function onEntered() {
  //   if (!import.meta.env.DEV) {
  //     input.workingDir =
  //       data.selected.type === 'file'
  //         ? data.configs.newFileBaseDir
  //         : data.configs.newProjectBaseDir;
  //   } else {
  //     input.workingDir = '/dev';
  //   }

  //   validateInput();
  // }
</script>

<div
  class={`grid gap-1.5
    grid-cols-[max-content_1fr] 
    grid-rows-[1fr_repeat(3,min-content)]`}
>
  <div class="h-full col-span-2 mb-1 flex flex-row items-center">
    <SectionLabel text={texts.wizard.nameAndLocation} />
  </div>

  <Label class="qt-label pl-4">{texts.wizard.name}</Label>
  <InputWithIssue
    bind:value={input.name}
    onInput={validateInput}
    level={input.issues.name.level}
    message={input.issues.name.message}
  />

  <Label class="qt-label pl-4">{texts.wizard.workingDir}</Label>
  <WorkingDirInput />

  <div></div>
  <div class="flex flex-row gap-2">
    {#if data.selected.type === 'project'}
      <Checkbox
        class="self-start qt-checkbox grow"
        bind:checked={input.saveProjectDir}
      >
        {texts.wizard.workingDirSaveCheckbox}
      </Checkbox>
    {:else}
      <div class="grow"></div>
    {/if}

    <IconButton
      text={texts.wizard.buttons.create}
      icon={CheckOutline}
      disabled={!ui.canCreate}
      onClicked={createItemFromSelectedPreset}
    ></IconButton>
  </div>
</div>
