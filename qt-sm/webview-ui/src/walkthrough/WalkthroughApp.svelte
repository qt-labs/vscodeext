<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import type { MessageToWebview, MessageToExtension, WalkthroughStepData } from './types';
  import Walkthrough from './Walkthrough.svelte';

  // @ts-ignore — acquireVsCodeApi is injected by the host
  const vscodeApi =
    typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;

  function post(msg: MessageToExtension) {
    vscodeApi?.postMessage(msg);
  }

  // State — always initialised; populated by 'init' message.
  let wtTitle = $state('');
  let wtDescription = $state('');
  let steps = $state<WalkthroughStepData[]>([]);
  let successTitle = $state<string | undefined>(undefined);
  let successMessage = $state<string | undefined>(undefined);
  let initialized = $state(false);
  let reviewingStepId = $state<string | null>(null);

  function completeStep(stepId: string) {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx === -1 || steps[idx].status !== 'active') return;
    steps[idx] = { ...steps[idx], status: 'completed' };
    const nextIdx = steps.findIndex((s, i) => i > idx && s.status === 'locked');
    if (nextIdx !== -1) {
      steps[nextIdx] = { ...steps[nextIdx], status: 'active' };
    }
    steps = [...steps];
  }

  function resetStep(stepId: string) {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;
    steps[idx] = { ...steps[idx], status: 'active' };
    for (let i = idx + 1; i < steps.length; i++) {
      if (steps[i].status === 'active') {
        steps[i] = { ...steps[i], status: 'locked' };
      }
    }
    steps = [...steps];
  }

  function handleAction(stepId: string, command: string, commandArgs?: unknown) {
    // $state.snapshot strips Svelte 5 proxies so postMessage can
    // structured-clone the payload without a DataCloneError.
    const plain = commandArgs !== undefined ? $state.snapshot(commandArgs) : undefined;
    post({ type: 'action', stepId, command, commandArgs: plain });
  }

  function handleReview(stepId: string) {
    // Toggle the review expansion locally — no extension round-trip needed.
    reviewingStepId = reviewingStepId === stepId ? null : stepId;
  }

  function handleReset() {
    post({ type: 'resetAll' });
  }

  function handleMarkDone() {
    // The extension sets the global flag and closes the walkthrough panel.
    post({ type: 'markDone' });
  }

  // Register listener immediately at module evaluation time — NOT in $effect.
  // This guarantees it's ready before the extension's setTimeout fires.
  function handleMessage(event: MessageEvent) {
    console.debug('WalkthroughApp received message:', event.data);1
    const msg = event.data as MessageToWebview;
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'init':
        wtTitle = msg.payload.title;
        wtDescription = msg.payload.description;
        steps = structuredClone(msg.payload.steps);
        successTitle = msg.payload.successTitle;
        successMessage = msg.payload.successMessage;
        initialized = true;
        break;
      case 'stepCompleted':
        completeStep(msg.stepId);
        break;
      case 'stepReset':
        resetStep(msg.stepId);
        break;
    }
  }
  window.addEventListener('message', handleMessage);
</script>

<div class="walkthrough-app">
  {#if initialized}
    <Walkthrough
      title={wtTitle}
      description={wtDescription}
      {steps}
      {successTitle}
      {successMessage}
      {reviewingStepId}
      onaction={handleAction}
      onreview={handleReview}
      onreset={handleReset}
      onmarkdone={handleMarkDone}
    />
  {:else}
    <div class="loading">Loading…</div>
  {/if}
</div>

<style>
  .walkthrough-app {
    width: 100%;
    /* Pin to the viewport height (not min-height) so that when the
       walkthrough is taller than the screen, overflow-y has something to
       clip and shows an internal scrollbar instead of growing unbounded. */
    height: 100vh;
    background: var(--vscode-editor-background);
    color: var(--vscode-foreground);
    overflow-y: auto;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: var(--vscode-descriptionForeground);
    font-size: 0.9em;
  }
</style>
