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
    BrushCleaning
   } from "@lucide/svelte";

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
  <!-- backdrop -->
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

  <!-- contents -->
  <div class='qt-popup absolute flex flex-col p-2 select-none'>
    <!-- title -->
    <div class='w-full flex flex-row'>
      <p class="qt-label grow">{t.title}</p>
      <IconButton
        class='w-1 border-none!'
        flat square
        icon={X}
        onClicked={reject}
      />
    </div>

    <div class="m-1">
      <!-- look up directories -->
      <div class="w-full flex flex-row gap-1.5 items-center mb-1.5">
        <div class="grow flex flex-col">
          <div class="qt-label m-0!">{t.qmlDirsLabel}</div>
          <div class="qt-label m-0! dimmed font-light">{t.qmlDirsLabelHelp}</div>
        </div>

        {#each buttons as b (b.id)}
          <IconButton
            flat square class='w-1'
            icon={b.icon}
            tooltip={b.tooltip}
            tooltipPlacement="top-end"
            onClicked={() => { onIconClicked(b.id); }}
          />
        {/each}
      </div>
      <textarea
        bind:this={textArea}
        bind:value={text}
        class="w-full qt-input min-w-[500px] min-h-[150px] resize"
      ></textarea>
    </div>

    <!-- bottom buttons -->
    <div class="flex flex-row gap-2">
      <div class="grow"></div>
      <IconButton
        text={t.saveButton}
        onClicked={accept}
      />
    </div>

  </div>
</div>