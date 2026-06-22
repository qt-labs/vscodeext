<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { CheckCheck } from '@lucide/svelte';

  import type { WalkthroughStepData } from './types';
  import ProgressBar from './ProgressBar.svelte';
  import WalkthroughStep from './WalkthroughStep.svelte';
  import SuccessPanel from './SuccessPanel.svelte';

  interface Props {
    title: string;
    description: string;
    steps: WalkthroughStepData[];
    successTitle?: string;
    successMessage?: string;
    reviewingStepId?: string | null;
    onaction?: (stepId: string, command: string, commandArgs?: unknown) => void;
    onreview?: (stepId: string) => void;
    onreset?: () => void;
    onmarkdone?: () => void;
  }

  let {
    title,
    description,
    steps,
    successTitle,
    successMessage,
    reviewingStepId = null,
    onaction,
    onreview,
    onreset,
    onmarkdone
  }: Props = $props();

  const completedCount = $derived(
    steps.filter((s) => s.status === 'completed').length
  );
  const allCompleted = $derived(
    steps.length > 0 && completedCount === steps.length
  );

  // Partition steps around the active one so the active card
  // visually breaks out of the compact-row flow.
  const activeIdx = $derived(steps.findIndex((s) => s.status === 'active'));
  const beforeActive = $derived(
    activeIdx === -1
      ? steps.filter((s) => s.status === 'completed')
      : steps.slice(0, activeIdx)
  );
  const activeStep = $derived(
    activeIdx === -1 ? null : (steps[activeIdx] ?? null)
  );
  const afterActive = $derived(
    activeIdx === -1 ? [] : steps.slice(activeIdx + 1)
  );
</script>

{#snippet markDoneControl()}
  <button
    class="mark-done-btn"
    onclick={() => onmarkdone?.()}
    aria-label="Mark walkthrough as done"
  >
    <CheckCheck size={16} />
    Mark Done
  </button>
{/snippet}

<div class="walkthrough" role="region" aria-label={title}>
  <!-- Header is always shown, including when the walkthrough is complete -->
  <div class="header">
    <h1 class="wt-title">{title}</h1>
    <p class="wt-description">{description}</p>
  </div>

  <div class="progress-wrapper">
    <ProgressBar completed={completedCount} total={steps.length} />
  </div>

  {#if allCompleted}
    <!-- All-complete view: completed rows + success card + footer -->
    <div class="timeline" role="list" aria-label="Walkthrough steps">
      <div class="rail rail-completed rail-full" aria-hidden="true"></div>
      {#each steps as step, i (step.id)}
        <WalkthroughStep {step} index={i} reviewing={step.id === reviewingStepId} {onaction} {onreview} />
      {/each}
    </div>

    <div class="success-wrapper">
      <SuccessPanel title={successTitle} message={successMessage} />
    </div>

    <div class="footer">
      <button
        class="reset-link"
        onclick={() => onreset?.()}
        aria-label="Reset walkthrough"
      >
        Reset walkthrough
      </button>
      <span class="completed-label">Completed</span>
    </div>
  {:else}
    <!-- In-progress view: timeline with active card -->
    <div class="timeline" role="list" aria-label="Walkthrough steps">
      <!-- Completed steps before active; carry the blue rail -->
      {#if beforeActive.length > 0}
        <div class="completed-region">
          <div class="rail rail-completed" aria-hidden="true"></div>
          {#each beforeActive as step, i (step.id)}
            <WalkthroughStep {step} index={i} reviewing={step.id === reviewingStepId} {onaction} {onreview} />
          {/each}
        </div>
      {/if}

      <!-- Active step + any locked steps below it. The grey rail lives here
           so it only connects the active circle down to the last locked
           circle — never dangling below a last-step active card. -->
      {#if activeStep}
        <div class="active-region">
          {#if afterActive.length > 0}
            <div class="rail rail-locked" aria-hidden="true"></div>
          {/if}

          {#key activeStep.id}
            <WalkthroughStep
              step={activeStep}
              index={activeIdx}
              {onaction}
              {onreview}
            />
          {/key}

          {#each afterActive as step, i (step.id)}
            <WalkthroughStep
              {step}
              index={beforeActive.length + 1 + i}
              reviewing={step.id === reviewingStepId}
              {onaction}
              {onreview}
            />
          {/each}
        </div>
      {/if}
    </div>

    <div class="footer">
      <button
        class="reset-link"
        onclick={() => onreset?.()}
        aria-label="Reset walkthrough"
      >
        Reset walkthrough
      </button>
      {#if activeStep}
        <span class="next-label">Next: {activeStep.title}</span>
      {/if}
      {@render markDoneControl()}
    </div>
  {/if}
</div>

<style>
  .walkthrough {
    display: flex;
    flex-direction: column;
    max-width: 680px;
    margin: 0 auto;
    padding: 24px 16px;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
  }

  .header {
    margin-bottom: 4px;
  }

  .wt-title {
    font-size: 1.4em;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin: 0 0 6px;
  }

  .wt-description {
    font-size: 0.9em;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .progress-wrapper {
    margin-bottom: 28px;
  }

  .timeline {
    display: flex;
    flex-direction: column;
    position: relative;
    margin-left: 6px;
    gap: 8px;
  }

  .completed-region,
  .active-region {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Vertical timeline rail, drawn behind the step circles */
  .rail {
    position: absolute;
    left: 22px;
    width: 2px;
    z-index: 0;
  }

  /* Grey rail within the active region: starts at the active step's circle
     (≈18px down from the card top) and stops at the *top edge* of the last
     step's circle so the line ends at the circle instead of running into it.
     The last row is 48px tall with a 36px circle centred in it, so the circle
     top sits 42px above the region bottom. Only rendered when locked steps
     follow, so it never dangles below the active card on the final step. */
  .rail-locked {
    top: 18px;
    bottom: 42px;
    background: var(
      --vscode-editorWidget-border,
      rgba(128, 128, 128, 0.2)
    );
  }

  /* Blue rail over the completed portion; extends down to the active
     step's circle (timeline gap 8px + circle centre 22px ≈ 30px). */
  .rail-completed {
    top: 24px;
    bottom: -30px;
    background: var(--vscode-button-background);
  }

  /* When every step is complete the blue rail spans the full timeline. */
  .rail-full {
    bottom: 24px;
  }

  .success-wrapper {
    margin-top: 32px;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-top: 24px;
    padding-top: 16px;
  }

  .reset-link {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--vscode-textLink-foreground);
    font-size: 0.95em;
    cursor: pointer;
    font-family: inherit;
  }

  .reset-link:hover {
    text-decoration: underline;
  }

  .reset-link:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 2px;
  }

  .completed-label,
  .next-label {
    color: var(--vscode-descriptionForeground);
    font-size: 0.95em;
  }

  /* Link-style "Mark Done", matching the default VS Code walkthrough. */
  .mark-done-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--vscode-textLink-foreground);
    font-size: 0.95em;
    cursor: pointer;
    font-family: inherit;
  }

  .mark-done-btn:hover {
    text-decoration: underline;
  }

  .mark-done-btn:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 2px;
  }
</style>
