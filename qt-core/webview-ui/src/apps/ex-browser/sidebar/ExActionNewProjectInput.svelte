<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { Check } from '@lucide/svelte';

  import { icons, glyphs } from '@/symbols';
  import { type OpenInPreference } from '@shared/types';
  import { clickOutside, portal, placeNear } from '@/utils/actions';
  import { exBrowser } from '@/apps/texts';

  import { ui } from '../states.svelte';
  import ExCheckBox from '../others/ExCheckBox.svelte';
  import ExValidationInput from '../others/ExValidationInput.svelte';
  import ExSeparator from '../others/ExSeparator.svelte';

  let compNameInput: ExValidationInput;
  const controller = $derived(ui.sidebar.newProject.input);
  const states = $derived(controller.states);

  let createMenu = $state({
    visible: false,
    reference: undefined as HTMLButtonElement | undefined
  });

  const texts = exBrowser.details.actions.newProject;
  const createButtonText = $derived.by(() => {
    return controller.states.openIn === 'newWindow'
      ? texts.createButton.new
      : texts.createButton.add;
  });

  function onInput() {
    controller.fireEvent('inputChanged');
  }

  onMount(() => {
    if (compNameInput) {
      compNameInput.focus();
    }
  });
</script>

<div data-root class="flex flex-col gap-[13px]">
  <span data-role="note">{texts.note}</span>

  <!-- name -->
  <div class="flex flex-col gap-[4px]">
    <div data-role="input-field-name">{texts.name}</div>
    <ExValidationInput
      bind:this={compNameInput}
      bind:value={states.name}
      level={states.issues.name.level}
      message={states.issues.name.message}
      {onInput}
    />
  </div>

  <!-- working dir -->
  <div class="flex flex-col gap-[4px]">
    <div data-role="input-field-name">{texts.workingDir}</div>
    <div class="w-full relative">
      <ExValidationInput
        bind:value={states.workingDir}
        level={states.issues.workingDir.level}
        message={states.issues.workingDir.message}
        {onInput}
      />

      <button
        data-role="browse-dir"
        data-validation={states.issues.workingDir.level}
        class="qt-button qt-absolute-cy h-full"
        onclick={() => {
          controller.fireEvent('browseClicked');
        }}
      >
        <icons.FolderOpen />
      </button>
    </div>

    <ExCheckBox text={texts.workingDirSaveCheckbox} />
  </div>

  {@render createButtonAndOptions()}

  {#if createMenu.visible}
    <div
      use:portal
      use:placeNear={{ ref: createMenu.reference, placement: 'bottom-end' }}
      use:clickOutside={(e: MouseEvent) => {
        e.stopPropagation();
        createMenu.visible = false;
      }}
      data-role="menu"
      class="qt-dropdown fixed flex flex-col"
    >
      <div data-role='menu-note'>{texts.menuItem.note}</div>
      <ExSeparator />
      {@render createMenuItem(texts.menuItem.new, 'newWindow')}
      {@render createMenuItem(texts.menuItem.add, 'addToWorkspace')}
    </div>
  {/if}
</div>

<!-- snippets -->
{#snippet createButtonAndOptions()}
  <div class="flex flex-row gap-[2px]">
    <div class="grow"></div>
    <button
      data-variant="primary"
      data-role="create"
      class="qt-button"
      disabled={!states.acceptable}
      onclick={() => {
        controller.fireEvent('createClicked');
      }}
    >
      {createButtonText}
    </button>

    <button
      bind:this={createMenu.reference}
      data-variant="primary"
      data-role="open-menu"
      class="qt-button flex justify-center"
      disabled={!states.acceptable}
      onclick={(e: MouseEvent) => {
        createMenu.visible = true;
        e.stopPropagation();
      }}
    >
      {glyphs.triangleDown}
    </button>
  </div>
{/snippet}

{#snippet createMenuItem(text: string, openIn: OpenInPreference)}
  <button
    data-role="menu-item"
    class="flex flex-row items-center"
    onclick={() => {
      controller.fireEvent('openInChanged', openIn);
      controller.states.openIn = openIn;
      createMenu.visible = false;
    }}
  >
    {#if controller.states.openIn === openIn}
      <Check size={14} />
    {:else}
      <div class="w-[14px]"></div>
    {/if}
    {text}
  </button>
{/snippet}

<style>
  [data-root] {
    padding: 10px;
    background: var(--qt-button-secondary-bg);
    border-radius: var(--qt-radius-s);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  [data-role='note'] {
   font-size: var(--qt-font-xs);
    padding: 0px 10px;
    color: var(--qt-text-muted);
  }

  [data-role='input-field-name'] {
    font-size: var(--qt-font-xs);
    color: var(--qt-text-muted);
  }

  [data-role='create'] {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  [data-role='open-menu'] {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  [data-role='menu-note'] {
    padding: 5px 10px;
    color: var(--qt-text-muted);
    font-size: var(--qt-font-xs);
  }

  [data-role='menu-item'] {
    gap: 8px;
    width: 100%;
    padding: 5px 10px;
    background: none;
    border: none;
    color: var(--qt-dropdown-fg);
    cursor: pointer;
    text-align: left;
    font-size: var(--qt-font-s);

    &:hover {
      background: var(--qt-selected-bg);
      color: var(--qt-selected-fg);
    }
  }

  .qt-button {
    &[data-role='browse-dir'] {
      padding: 0 8px 0 0;
      background: none;
      border: none;
      border-radius: 0;
      right: 0px;
    }
  }
</style>
