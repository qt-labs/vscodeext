<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Checkbox, P } from 'flowbite-svelte';
  import { Check, FolderOpen } from '@lucide/svelte';

  import IconButton from '@/comps/IconButton.svelte';
  import SectionLabel from '@/comps/SectionLabel.svelte';
  import InputWithIssue from '@/comps/InputWithIssue.svelte';
  import * as texts from '@/apps/texts';
  import { data, input, ui } from './states.svelte';
  import {
    onWorkingDirBrowseClicked,
    createItemFromSelectedPreset,
    validateInput,
  } from './viewlogic.svelte';
</script>

<div
  class={`grid gap-2
    grid-cols-[max-content_1fr]
    grid-rows-[1fr_repeat(3,min-content)]`}
>
  <div class="h-full col-span-2 mb-1 flex flex-row items-center">
    <SectionLabel text={texts.wizard.nameAndLocation} />
  </div>

  <!-- name -->
  <P class="qt-label pl-4">{texts.wizard.name}</P>
  <InputWithIssue
    bind:value={input.name}
    onInput={validateInput}
    level={input.issues.name.level}
    message={input.issues.name.message}
  />

  <!-- working directory -->
  <P class="qt-label pl-4">{texts.wizard.workingDir}</P>
  <div class="w-full grid grid-cols-[min-content_1fr] gap-0">
    <IconButton
      icon={FolderOpen}
      class="qt-button px-2 py-0 rounded-r-none! -mr-0.5 focus:z-1 min-w-[36px]"
      tooltip={texts.wizard.workingDirTooltip}
      onClicked={onWorkingDirBrowseClicked}
      />
    <InputWithIssue
      bind:value={input.workingDir}
      class="rounded-l-none!"
      onInput={validateInput}
      level={input.issues.workingDir.level}
      message={input.issues.workingDir.message}
    />
  </div>

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
      icon={Check}
      disabled={!ui.canCreate}
      onClicked={createItemFromSelectedPreset}
    ></IconButton>
  </div>
</div>
