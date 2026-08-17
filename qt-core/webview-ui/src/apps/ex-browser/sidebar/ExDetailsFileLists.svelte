<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { data, ui } from '../states.svelte';
  import * as viewlogic from '../viewlogic.svelte';

  const example = $derived(ui.selected.example);
  const filesSorted = $derived.by(() => {
    return [...(example?.filesToOpen ?? [])].sort();
  });

  const resolvedPaths = $derived.by(() => {
    const id = ui.selected.example?.projectPath;
    return id ? data.resolvedPaths[id] : undefined;
  });

  const projectDir = $derived.by(() => {
    if (!example?.projectPath) {
      return '';
    }

    const full = example?.projectPath;
    const index = full.lastIndexOf('/');
    return index === -1 ? '' : full.slice(0, index + 1);
  });

  function shortenPath(filePath: string): string {
    return filePath.startsWith(projectDir)
      ? filePath.slice(projectDir.length)
      : filePath;
  }
</script>

{#if example}
  <div class="flex flex-col">
    {@render fileButton(shortenPath(example.projectPath), () => {
      viewlogic.runExAction('project-open-file');
    })}

    {#each filesSorted as file (file)}
      {@const exists = resolvedPaths?.filesToOpen[file] !== undefined}
      {#if exists}
        {@render fileButton(shortenPath(file), () => {
          viewlogic.runExAction('file-open', { file });
        })}
      {/if}
    {/each}
  </div>
{/if}

{#snippet fileButton(file: string, onClicked: () => void)}
  <button
    data-role="project-file"
    class="flex flex-row grow"
    onclick={onClicked}
  >
    {file}
  </button>
{/snippet}

<style>
  [data-role='project-file'] {
    color: var(--qt-text-default);
    background: none;
    border: none;
    cursor: pointer;
    overflow: hidden;
    line-height: 18px;
    word-break: break-word;
    font-family: inherit;
    font-size: var(--qt-font-xs);
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: left;

    &:hover {
      color: var(--qt-accent-info);
    }
  }
</style>
