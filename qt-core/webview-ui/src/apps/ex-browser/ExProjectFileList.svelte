<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import {
    File,
    FileBox,
    FolderTree,
    ExternalLink,
  } from '@lucide/svelte';
  import type { Component } from 'svelte';

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import { exBrowser as texts } from '@/apps/texts';

  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  const example = $derived(ui.selected.example);
  const resolvedPaths = $derived.by(() => {
    const id = ui.selected.example?.projectPath;
    return id ? data.resolvedPaths[id] : undefined;
  });

  const toolButtons = $derived([
    {
      icon: FolderTree,
      toolTip: texts.projectToolbar.openInVscode,
      task: () => {
        viewlogic.runExAction('project-open');
      }
    },
    {
      icon: ExternalLink,
      toolTip: texts.projectToolbar.reveal,
      task: () => {
        viewlogic.runExAction('project-reveal');
      }
    }
  ]);
</script>

{#if example}
  <Column class='w-full !gap-1'>
    <Row class='w-full'>
      <div class='grow self-center'>
        {texts.details.files.title}
      </div>

      {#each toolButtons as item (item)}
        <IconButton
          flat square
          icon={item.icon}
          tooltip={item.toolTip}
          class='w-1 border-0! -ml-3'
          onClicked={item.task}
        />
      {/each}
    </Row>

    {@render FileButton(FileBox, example.projectPath, () => {
      viewlogic.runExAction('project-open-file');
    })}

    {#each example.filesToOpen as file (file)}
      {@const exists = (resolvedPaths?.filesToOpen[file] !== undefined)}
      {#if exists}
        {@render FileButton(File, file, () => {
          viewlogic.runExAction('file-open', { file });
        })}
      {/if}
    {/each}
  </Column>
{/if}

<!-- snippets -->
{#snippet FileButton(Icon: Component, file: string, onClicked: () => void)}
  <Row>
    <Icon class='shrink-0' />
    <button
      class='flex-1 min-w-0 hover:cursor-pointer'
      onclick={onClicked}
    >
      <div
        dir='rtl'
        class={`
          text-left min-w-0
          whitespace-nowrap overflow-hidden overflow-ellipsis
        `}
      >
        {file}
      </div>
    </button>
  </Row>
{/snippet}
