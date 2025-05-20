<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Button } from 'flowbite-svelte';
  import { FolderOpenOutline } from 'flowbite-svelte-icons';

  import InputWithIssue from '@/comps/InputWithIssue.svelte';
  import * as texts from './texts';
  import { input } from './states.svelte';
  import { onWorkingDirBrowseClicked, validateInput } from './viewlogic.svelte';
</script>

<div class="w-full grid grid-cols-[min-content_1fr] gap-0">
  <Button
    class="qt-button px-2 py-0 rounded-r-none! z-1"
    title={texts.wizard.workingDirTooltip}
    on:click={onWorkingDirBrowseClicked}
    ><FolderOpenOutline />
  </Button>

  <InputWithIssue
    bind:value={input.workingDir}
    onInput={validateInput}
    level={input.issues.workingDir.level}
    message={input.issues.workingDir.message}
  />
</div>
