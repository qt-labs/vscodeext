<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { onMount } from "svelte";
  import {
    X,
    FolderPlus,
    PackagePlus,
    BrushCleaning,
   } from "@lucide/svelte";

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import IconButton from "@/comps/IconButton.svelte";
  import { qmltrace as texts } from '@/apps/texts';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  const t = texts.configDialog;
  const buttons = [
    { id: 1, icon: FolderPlus, tooltip: t.tooltips.browse },
    { id: 2, icon: PackagePlus, tooltip: t.tooltips.workspaces },
    { id: 3, icon: BrushCleaning, tooltip: t.tooltips.clear },
  ]

  let text = $state('');
  let textArea = $state(undefined as HTMLTextAreaElement | undefined);

  function reject() {
    ui.overlays.config.visible = false;
  }

  function accept() {
    viewlogic.setConfigsAndReload(text);
    ui.overlays.config.visible = false;
  }

  function onIconClicked(id: number) {
    if (id === 1) {
      addDirsFrom('dialog');
    } else if (id === 2) {
      addDirsFrom('workspaces');
    } else if (id === 3) {
      text = '';
    }
  }

  async function addDirsFrom(source: 'dialog' | 'workspaces') {
    const dirs = await viewlogic.getFoldersToAdd(source);
    if (dirs.length === 0) {
      return;
    }

    dirs.forEach((dir) => {
      const trimmed = dir.trim();
      if (trimmed.length !== 0) {
        text = text.trim();
        text = `${text}${text.length !== 0 ? '\n' : ''}${trimmed}`;
      }
    });

    activateTextArea();
  }

  function activateTextArea() {
    queueMicrotask(() => {
      if (textArea) {
        textArea.focus();
        textArea.scrollTop = textArea.scrollHeight;
      }
    });
  }

  onMount(() => {
    text = data.configs.additionalDirs.join('\n');
    activateTextArea();
  })
</script>

<div class="fixed inset-0 flex items-center justify-center">
  {@render Backdrop()}

  <Column class='qt-popup absolute p-3 gap-4 select-none'>
    {@render Title()}
    {@render QmlLookupDirs()}
    {@render Footer()}
  </Column>
</div>

<!-- snippets -->
{#snippet Backdrop()}
  <div
    class="w-full h-full"
    tabindex="0"
    role="button"
    onkeydown={() => {}}
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        reject();
      }
    }}
  ></div>
{/snippet}

{#snippet Title()}
  <Row class='w-full items-center'>
    <div class="qt-label grow">{t.title}</div>
    <IconButton
      class='w-1 border-none!'
      flat square
      icon={X}
      onClicked={reject}
    />
  </Row>
{/snippet}

{#snippet Footer()}
  <Row>
    <div class="grow"></div>
    <IconButton
      text={t.saveButton}
      onClicked={accept}
    />
  </Row>
{/snippet}

{#snippet QmlLookupDirs()}
  <Column>
    <Row class="w-full items-center">
      <Column class="grow !-space-y-2">
        {@render ItemLabel(t.qmlDirsLabel)}
        {@render ItemLabelDimmed(t.qmlDirsLabelHelp)}
      </Column>

      {#each buttons as b (b.id)}
        <IconButton
          flat square
          class='w-1'
          icon={b.icon}
          tooltip={b.tooltip}
          tooltipPlacement="top-end"
          onClicked={() => {
            onIconClicked(b.id);
          }}
        />
      {/each}
    </Row>
    <textarea
      bind:this={textArea}
      bind:value={text}
      class="w-full qt-input min-w-[500px] min-h-[150px] resize"
    ></textarea>
  </Column>
{/snippet}

{#snippet ItemLabel(text: string)}
  <div class="qt-label">{text}</div>
{/snippet}

{#snippet ItemLabelDimmed(text: string)}
  <div class="qt-label dimmed font-light">{text}</div>
{/snippet}
