<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { P } from 'flowbite-svelte';
  import { List } from '@lucide/svelte';

  import * as texts from '@/apps/texts';
  import InputWithIssue from '@/comps/InputWithIssue.svelte';
  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import type { QrcPropName } from './types.svelte';

  const fields = [
    {
      name: 'alias' as QrcPropName,
      label: texts.qrc.props.alias,
      input: ui.inputs.alias,
      isEnabled: () => { return ui.cursor.currentPos.isFile() ?? false; }
    },
    {
      name: 'prefix' as QrcPropName,
      label: texts.qrc.props.prefix,
      input: ui.inputs.prefix,
      isEnabled: () => { return ui.cursor.currentPos.isGroup() ?? false; }
    },
    {
      name: 'lang' as QrcPropName,
      label: texts.qrc.props.language,
      input: ui.inputs.language,
      isEnabled: () => { return ui.cursor.currentPos.isGroup() ?? false; }
    }
  ];
</script>

<div class="flex flex-col gap-2 qt-surface p-2">
  <div class="flex flex-row gap-2 items-center qt-label highlight">
    <List />
    {texts.qrc.props.title}
  </div>
  <div class="grid grid-cols-[max-content_1fr] gap-2 items-center ml-2">
    {#each fields as { name, label, input, isEnabled } (name)}
      <P class={`qt-label ${isEnabled() ? '' : 'dimmed'}`}>
        {label}:
      </P>
      <InputWithIssue
        bind:value={input.value}
        level='error'
        message={input.error}
        disabled={!isEnabled()}
        onInput={() => { void viewlogic.setProp(name); }}
      />
    {/each}
  </div>
</div>
