<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { slide, fade } from 'svelte/transition';
  import { Check, Lock } from '@lucide/svelte';

  import type { WalkthroughStepData } from './types';

  interface Props {
    step: WalkthroughStepData;
    index: number;
    reviewing?: boolean;
    onaction?: (stepId: string, command: string, commandArgs?: unknown) => void;
    onreview?: (stepId: string) => void;
  }

  let { step, index, reviewing = false, onaction, onreview }: Props = $props();
</script>

{#if step.status === 'active'}
  <!--
    Active step: number circle on the timeline rail, with a large
    expanded card to its right.
  -->
  <div
    class="active-step"
    role="listitem"
    aria-current="step"
    aria-label={`Step ${index + 1}: ${step.title}, current step`}
    transition:slide={{ duration: 300 }}
  >
    <div class="active-step-number">{index + 1}</div>
    <div class="active-card">
      <div class="active-content">
        <h3 class="active-title">{step.title}</h3>
        <p class="active-description">{step.description}</p>
        {#if step.actions?.length}
          <div
            class="active-actions"
            transition:fade={{ duration: 200, delay: 100 }}
          >
            {#each step.actions as action}
              {#if action.text}
                <span class="action-separator">{action.label}</span>
              {:else}
                <button
                  class={action.primary
                    ? 'action-btn-primary'
                    : 'action-btn-secondary'}
                  class:trailing={action.trailing}
                  disabled={action.disabled}
                  onclick={() => onaction?.(step.id, action.command ?? '', action.commandArgs)}
                >
                  {action.label}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else if step.status === 'completed'}
  <!-- Completed step: compact row, expands to review card when reviewing -->
  <div
    class="timeline-row completed-row"
    role="listitem"
    aria-label={`Step ${index + 1}: ${step.title}, completed`}
    transition:slide={{ duration: 250 }}
  >
    <div class="step-left">
      <div class="check-circle">
        <Check size={16} strokeWidth={3} />
      </div>
      <span class="step-title">{step.title}</span>
    </div>
    <button
      class="review-btn"
      onclick={() => onreview?.(step.id)}
      aria-label={reviewing ? `Close review of ${step.title}` : `Review ${step.title}`}
      aria-expanded={reviewing}
    >
      {reviewing ? 'Close' : 'Review'}
      <span class="review-arrow">{reviewing ? '‹' : '›'}</span>
    </button>
  </div>
  {#if reviewing}
    <div
      class="review-card"
      role="region"
      aria-label={`Review: ${step.title}`}
      transition:slide={{ duration: 250 }}
    >
      <p class="review-description">{step.description}</p>
      {#if step.actions?.length}
        <div class="active-actions" transition:fade={{ duration: 200, delay: 50 }}>
          {#each step.actions as action}
            {#if action.text}
              <span class="action-separator">{action.label}</span>
            {:else}
              <button
                class={action.primary ? 'action-btn-primary' : 'action-btn-secondary'}
                class:trailing={action.trailing}
                disabled={action.disabled}
                onclick={() => onaction?.(step.id, action.command ?? '', action.commandArgs)}
              >
                {action.label}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{:else}
  <!-- Locked step: timeline row, greyed out -->
  <div
    class="timeline-row locked-row"
    role="listitem"
    aria-label={`Step ${index + 1}: ${step.title}, locked`}
    transition:slide={{ duration: 250 }}
  >
    <div class="step-left">
      <div class="lock-circle">
        <Lock size={14} />
      </div>
      <span class="step-title locked-title">{step.title}</span>
    </div>
  </div>
{/if}

<style>
  /* ── Active step (circle on rail + card) ── */
  .active-step {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    padding: 0 4px;
  }

  .active-step-number {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9em;
    font-weight: 600;
    flex-shrink: 0;
    /* position:relative so z-index applies and the circle paints over the
       timeline rail (which is absolutely positioned). */
    position: relative;
    z-index: 1;
  }

  .active-card {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--vscode-focusBorder);
    border-radius: 6px;
    background: var(--vscode-editor-background);
    padding: 20px;
  }

  .active-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .active-title {
    font-size: 1em;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin: 0;
    line-height: 1.4;
  }

  .active-description {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    margin: 0;
    line-height: 1.5;
  }

  .active-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  /* Trailing actions (e.g. "Reset password") sit at the row's right edge. */
  .active-actions .trailing {
    margin-left: auto;
  }

  /* Plain-text separator between buttons (e.g. "Sign In *or* Create Account"). */
  .action-separator {
    align-self: center;
    color: var(--vscode-descriptionForeground);
    font-size: 0.85em;
  }

  .action-btn-primary {
    padding: 6px 14px;
    border-radius: 2px;
    border: 1px solid var(--vscode-button-border, transparent);
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font-size: 0.85em;
    cursor: pointer;
    font-family: inherit;
    line-height: 1.4;
  }

  .action-btn-primary:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .action-btn-primary:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 2px;
  }

  .action-btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .action-btn-secondary {
    padding: 6px 14px;
    border-radius: 2px;
    border: 1px solid
      var(
        --vscode-button-secondaryBorder,
        var(--vscode-widget-border, rgba(128, 128, 128, 0.4))
      );
    background: var(--vscode-button-secondaryBackground, transparent);
    color: var(
      --vscode-button-secondaryForeground,
      var(--vscode-foreground)
    );
    font-size: 0.85em;
    cursor: pointer;
    font-family: inherit;
    line-height: 1.4;
  }

  .action-btn-secondary:hover {
    background: var(
      --vscode-button-secondaryHoverBackground,
      rgba(128, 128, 128, 0.1)
    );
  }

  .action-btn-secondary:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 2px;
  }

  /* ── Compact timeline rows ── */
  .timeline-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
    min-height: 48px;
  }

  .step-left {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .check-circle {
    box-sizing: border-box;
    width: 36px;
    height: 36px;
    border: 2px solid var(--vscode-button-background);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--vscode-editor-background);
    color: var(--vscode-button-background);
    position: relative;
    z-index: 1;
  }

  .lock-circle {
    box-sizing: border-box;
    width: 36px;
    height: 36px;
    border: 2px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--vscode-editor-background);
    color: var(--vscode-descriptionForeground);
    position: relative;
    z-index: 1;
  }

  .step-title {
    font-size: 1.1em;
    font-weight: 600;
    color: var(--vscode-foreground);
    line-height: 1.4;
  }

  .locked-title {
    color: var(--vscode-descriptionForeground);
    opacity: 0.6;
  }

  /* The row is lifted above the timeline rail so its opaque circle fill masks
     the line. We deliberately do NOT dim the row with `opacity` here: that
     would make the circle fill translucent and let the rail show through the
     icon. Dimming is applied to the glyph and title individually instead. */
  .locked-row {
    position: relative;
    z-index: 1;
  }

  .lock-circle :global(svg) {
    opacity: 0.6;
  }

  .review-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    font-size: 0.95em;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .review-btn:hover {
    color: var(--vscode-foreground);
  }

  .review-btn:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 2px;
  }

  .review-arrow {
    font-size: 1.3em;
    line-height: 1;
  }

  /* ── Review expansion ── */
  .review-card {
    margin-left: 54px;
    padding: 12px 0 8px;
  }

  .review-description {
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 12px;
    line-height: 1.5;
  }
</style>
