<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ExternalLink } from '@lucide/svelte';
  import { vscode } from '@/apps/vscode';
  import { CommandId } from '@shared/message';

  import '@/styles/app.css';
  import { uiFile as texts } from '@/apps/texts';
  import Column from '@/comps/Column.svelte';

  async function post(id: CommandId, payload?: unknown) {
    await vscode.post(id, payload);
  }

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
    class='
      qt-button
      w-full min-h-[60px]
      flex flex-row justify-center items-center gap-4 px-5
    '
    onclick={() => {
      void post(CommandId.UiFileOpenInDesigner);
    }}
  >
    <ExternalLink/>
    <p>{texts.buttons.openDesigner}</p>
  </button>
{/snippet}

{#snippet OpenAsTextButton()}
  <div class='w-full flex flex-row justify-start'>
    <button
      class='underline underline-offset-3 text-gray-500 cursor-pointer'
      onclick={() => {
        void post(CommandId.UiFileOpenInTextEditor);
      }}
    >
      {texts.buttons.openAsText}
    </button>
  </div>
{/snippet}

