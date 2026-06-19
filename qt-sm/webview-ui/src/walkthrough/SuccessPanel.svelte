<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { Check } from '@lucide/svelte';

  interface Props {
    title?: string;
    message?: string;
  }

  let {
    title = "You're all set!",
    message = 'Qt is installed and your first project is ready.'
  }: Props = $props();
</script>

<div
  class="success-card"
  role="status"
  aria-label="All steps completed"
  in:fade={{ duration: 400 }}
>
  <div
    class="success-icon"
    in:scale={{ duration: 400, delay: 100, start: 0.5 }}
  >
    <Check size={28} strokeWidth={3} />
  </div>
  <div class="success-body">
    <h2 class="success-title">{title}</h2>
    <p class="success-message">{message}</p>
  </div>
</div>

<style>
  .success-card {
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding: 24px;
    border: 2px solid var(--vscode-testing-iconPassed, rgba(22, 198, 12, 0.5));
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--vscode-testing-iconPassed, #16c60c) 8%,
      transparent
    );
  }

  .success-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--vscode-testing-iconPassed, #16c60c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .success-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .success-title {
    font-size: 1.5em;
    font-weight: 700;
    color: var(--vscode-foreground);
    margin: 0;
  }

  .success-message {
    font-size: 1em;
    color: var(--vscode-descriptionForeground);
    margin: 0;
    line-height: 1.5;
  }
</style>
