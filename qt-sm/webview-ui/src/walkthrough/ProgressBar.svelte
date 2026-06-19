<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    completed: number;
    total: number;
  }

  let { completed, total }: Props = $props();

  const progress = tweened(0, {
    duration: 400,
    easing: cubicOut
  });

  $effect(() => {
    progress.set(total > 0 ? (completed / total) * 100 : 0);
  });
</script>

<div
  class="progress-container"
  role="progressbar"
  aria-valuenow={completed}
  aria-valuemin={0}
  aria-valuemax={total}
  aria-label={`Step ${completed} of ${total} completed`}
>
  <div class="progress-header">
    <span class="progress-label">Progress</span>
    <span class="progress-count">{completed} of {total}</span>
  </div>
  <div class="progress-track">
    <div class="progress-fill" style="width: {$progress}%"></div>
  </div>
</div>

<style>
  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-label {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
  }

  .progress-count {
    font-size: 0.85em;
    font-weight: 500;
    color: var(--vscode-foreground);
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: var(
      --vscode-editorWidget-border,
      var(--vscode-widget-border, rgba(128, 128, 128, 0.2))
    );
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--vscode-button-background);
    border-radius: 2px;
  }
</style>
