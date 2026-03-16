<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import EmptyState from '@/comps/EmptyState.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import { courses as texts } from '@/apps/texts';

  import { data } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
</script>

{#if data.raw.length === 0}
  <EmptyState text={texts.empty.title} class='!gap-8'>
    <IconButton
      text={texts.empty.openAcademy}
      onClicked={() => {
        viewlogic.runAction('open-academy-home');
      }}
    />
  </EmptyState>
{:else if data.refined.length === 0}
  <EmptyState text={texts.empty.title} class='!gap-10'>
    {texts.empty.adjustFilter}
  </EmptyState>
{/if}
