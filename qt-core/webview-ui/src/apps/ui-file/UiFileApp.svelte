<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { ExternalLink } from '@lucide/svelte';

  import '@/styles/app.css';
  import { vscode } from '@/apps/vscode';
  import { CommandId } from '@shared/message';
  import { uiFile as texts } from '@/apps/texts';
  import Column from '@/comps/Column.svelte';

  let openDesignerButton: HTMLButtonElement;
  let openAsTextButton: HTMLButtonElement;

  function onKeyDown(e: KeyboardEvent) {
    if (!e.key.startsWith('Arrow')) {
      return;
    }

    const a = document.activeElement;
    const focused = (a === openDesignerButton) || (a === openAsTextButton);
    const next = !focused || (e.target === openAsTextButton)
      ? openDesignerButton
      : openAsTextButton;

    e.preventDefault();
    next.focus();
  }

  onMount(() => {
    window.addEventListener('keydown',onKeyDown);
    requestAnimationFrame(() => {
      openDesignerButton.focus();
    });
  });

</script>

<div class='w-screen h-screen p-2 flex flex-col gap-2'>
  <Column class='h-full !gap-10 justify-center items-center'>
    <Column class='w-[300px]'>
      {@render OpenDesignerButton()}
      {@render OpenAsTextButton()}
    </Column>
  </Column>
</div>

{#snippet OpenDesignerButton()}
  <button
    bind:this={openDesignerButton}
    class='
      qt-button
      w-full min-h-[60px]
      flex flex-row justify-center items-center gap-4 px-5
    '
    onkeydown={onKeyDown}
    onclick={() => {
      void vscode.post(CommandId.UiFileOpenInDesigner);
    }}
  >
    <ExternalLink/>
    <p>{texts.buttons.openDesigner}</p>
  </button>
{/snippet}

{#snippet OpenAsTextButton()}
  <div class='w-full flex flex-row justify-start'>
    <button
      bind:this={openAsTextButton}
      class='
        underline underline-offset-3 text-gray-500 cursor-pointer
        focus:qt-focus-outerRing
      '
      onkeydown={onKeyDown}
      onclick={() => {
        void vscode.post(CommandId.UiFileOpenInTextEditor);
      }}
    >
      {texts.buttons.openAsText}
    </button>
  </div>
{/snippet}
