<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Popover from '@/comps/Popover.svelte';
  import Separator from '@/comps/Separator.svelte';
  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
    import { Keyboard } from '@lucide/svelte';

  const availableSections = $derived.by(() => {
    const alphabet: string[] = [];
    const others: string[] = [];

    for (const s of ui.index.model.sections) {
      const name = s.letter_uc[0];

      if (/^[a-z]$/i.test(name)) {
        alphabet.push(name);
      } else {
        others.push(name);
      }
    }

    return { alphabet, others };
  });

  const currentSection = $derived.by(() => {
    return ui.index.viewState.currentSectionLetter;
  })

  function onKeydown(e: KeyboardEvent) {
    if (!ui.popovers.indexSelector.visible || e.repeat) {
      return;
    }

    if (e.key === 'Escape') {
      ui.popovers.indexSelector.hide();
    } else {
      viewlogic.jumpIndexToSection(e.key.toUpperCase());
    }

    e.stopPropagation();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<Popover
  controller={ui.popovers.indexSelector}
  placement='bottom-start'
  offset={5}
>
  <div data-role="area" class="qt-popover flex flex-col gap-3">
    <div data-role='guide' class='flex flex-row items-center justify-center'>
      <Keyboard class='small'/>
      Click or type a letter to jump
    </div>

    {@render sectionGrid(
      [...'abcdefghijklmnopqrstuvwxyz'],
      availableSections.alphabet
    )}

    {#if availableSections.others.length !== 0}
      <Separator />
      {@render sectionGrid(
        availableSections.others,
        availableSections.others
      )}
    {/if}
  </div>
</Popover>

<!-- snippets -->
{#snippet sectionGrid(fixedSections: string[], available: string[])}
  <div data-role="grid">
    {#each fixedSections as section (section)}
    {@const section_uc = section.toUpperCase()}
      <button
        data-role="letter"
        class="qt-button"
        class:active={section_uc === currentSection}
        disabled={!available.includes(section_uc)}
        onclick={() => {
          viewlogic.jumpIndexToSection(section_uc);
        }}
      >
        {section_uc}
      </button>
    {/each}
  </div>
{/snippet}

<style>
  [data-role='area'] {
    padding: 10px;
    min-width: 200px;
  }

  [data-role='guide'] {
    gap: 10px;
    margin-bottom: 5px;
    color: var(--qt-text-muted);
  }

  [data-role='grid'] {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  .qt-button[data-role='letter'] {
    width: 36px;
    height: 36px;
    padding: 4px;
    color: var(--qt-text-muted);
    border: 1px solid color-mix(in srgb, var(--qt-stroke-subtle) 50%, transparent);
    background: color-mix(in srgb, var(--qt-bg-input) 20%, transparent);

    &:hover {
      color: var(--qt-text-default);
      background: var(--qt-hover-bg);
    }

    &.active {
      color: var(--qt-selected-fg);
      background: var(--qt-selected-bg);
    }

    &:disabled {
      cursor: not-allowed;
      color: color-mix(in srgb, var(--qt-text-muted) 50%, transparent);
      border: none;
      background: none;
    }
  }
</style>
