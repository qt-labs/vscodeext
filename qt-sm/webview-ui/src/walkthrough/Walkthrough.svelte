<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { CheckCheck } from '@lucide/svelte';

  import type { PrivacyKey, SignInPhase, WalkthroughStepData } from './types';
  import ProgressBar from './ProgressBar.svelte';
  import WalkthroughStep from './WalkthroughStep.svelte';
  import SuccessPanel from './SuccessPanel.svelte';

  interface Props {
    title: string;
    description: string;
    steps: WalkthroughStepData[];
    successTitle?: string;
    successMessage?: string;
    /** Whether the user has marked the whole walkthrough as done. */
    getStartedDone?: boolean;
    reviewingStepId?: string | null;
    onaction?: (stepId: string, command: string, commandArgs?: unknown) => void;
    onreview?: (stepId: string) => void;
    onreset?: () => void;
    onmarkdone?: () => void;
    onsignincontinue?: () => void;
    onprivacy?: (key: PrivacyKey, enabled: boolean) => void;
  }

  let {
    title,
    description,
    steps,
    successTitle,
    successMessage,
    getStartedDone = false,
    reviewingStepId = null,
    onaction,
    onreview,
    onreset,
    onmarkdone,
    onsignincontinue,
    onprivacy
  }: Props = $props();

  const completedCount = $derived(
    steps.filter((s) => s.status === 'completed').length
  );
  const allCompleted = $derived(
    steps.length > 0 && completedCount === steps.length
  );
  // Resetting only makes sense once there is progress (or a done flag) to
  // clear; otherwise the button is a no-op and stays hidden.
  const canReset = $derived(completedCount > 0 || getStartedDone);

  const activeIdx = $derived(steps.findIndex((s) => s.status === 'active'));
  const activeStep = $derived(activeIdx === -1 ? null : (steps[activeIdx] ?? null));
  // Once signed in (1d) the sign-in itself is finished, so the footer points
  // at the following step.
  const nextStep = $derived.by(() => {
    if (!activeStep) return null;
    if (activeStep.signIn?.phase === 'signedIn') {
      return steps[activeIdx + 1] ?? activeStep;
    }
    return activeStep;
  });

  // Screen reader announcements for the sign-in phase changes. The initial
  // phase is not announced, only transitions after the first render.
  const signInStep = $derived(steps.find((s) => s.signIn !== undefined));
  let announcement = $state('');
  let lastAnnounced: SignInPhase | undefined | null = null;

  function announcementFor(phase: SignInPhase | undefined, email?: string) {
    switch (phase) {
      case 'signing':
        return 'Waiting for you to sign in in the browser.';
      case 'stalled':
        return "We haven't heard back from the browser yet.";
      case 'failed':
        return 'Sign-in failed.';
      case 'signedIn':
        return `Signed in as ${email ?? 'your Qt Account'}.`;
      default:
        return '';
    }
  }

  $effect(() => {
    const phase = signInStep?.signIn?.phase;
    const email = signInStep?.signIn?.email;
    if (lastAnnounced === null) {
      lastAnnounced = phase;
      return;
    }
    if (phase === lastAnnounced) return;
    lastAnnounced = phase;
    announcement = announcementFor(phase, email);
  });
</script>

<div class="walkthrough" role="region" aria-label={title}>
  <div class="head">
    <h1 class="title">{title}</h1>
  </div>
  <p class="intro">{description}</p>

  <div class="progress-wrapper">
    <ProgressBar completed={completedCount} total={steps.length} />
  </div>

  <div class="steps" role="list" aria-label="Walkthrough steps">
    {#each steps as step, i (step.id)}
      <WalkthroughStep
        {step}
        index={i}
        isLast={i === steps.length - 1}
        previousTitle={i > 0 ? steps[i - 1]?.title : undefined}
        reviewing={step.id === reviewingStepId}
        {onaction}
        {onreview}
        {onsignincontinue}
        {onprivacy}
      />
    {/each}
  </div>

  {#if allCompleted}
    <SuccessPanel title={successTitle} message={successMessage} />
  {/if}

  <div class="foot">
    {#if canReset}
      <button class="wt-link" onclick={() => onreset?.()} aria-label="Reset walkthrough">
        Reset walkthrough
      </button>
    {/if}
    {#if allCompleted}
      <span class="foot-note">Completed</span>
    {:else if nextStep}
      <span class="foot-note">Next: {nextStep.title}</span>
    {/if}
    <!-- Once the walkthrough is marked done there is nothing left to mark. -->
    {#if !allCompleted && !getStartedDone}
      <button
        class="wt-link mark-done"
        onclick={() => onmarkdone?.()}
        aria-label="Mark walkthrough as done"
      >
        <CheckCheck size={16} />
        Mark Done
      </button>
    {/if}
  </div>

  <div class="wt-sr" aria-live="polite">{announcement}</div>
</div>

<style>
  /*
   * Design tokens. Every colour maps to a --vscode-* token with the
   * proposal's Dark Modern value as the fallback (only used outside VS Code,
   * e.g. in `vite dev`). Child components read these custom properties.
   */
  .walkthrough {
    --wt-fg: var(--vscode-foreground, #cccccc);
    --wt-desc: var(--vscode-descriptionForeground, #9d9d9d);
    --wt-bg: var(--vscode-editor-background, #1f1f1f);
    --wt-tile: var(--vscode-welcomePage-tileBackground, #2a2a2a);
    --wt-tile-hover: var(--vscode-welcomePage-tileHoverBackground, #333333);
    --wt-btn: var(--vscode-button-background, #0078d4);
    --wt-btn-hover: var(--vscode-button-hoverBackground, #026ec1);
    --wt-btn-fg: var(--vscode-button-foreground, #ffffff);
    --wt-btn2: var(--vscode-button-secondaryBackground, #313131);
    --wt-btn2-hover: var(--vscode-button-secondaryHoverBackground, #3c3c3c);
    --wt-btn2-fg: var(--vscode-button-secondaryForeground, #cccccc);
    --wt-link: var(--vscode-textLink-foreground, #4daafc);
    --wt-focus: var(--vscode-focusBorder, #0078d4);
    --wt-warning: var(--vscode-editorWarning-foreground, #cca700);
    --wt-error: var(--vscode-editorError-foreground, #f14c4c);
    --wt-divider: var(--vscode-widget-border, rgba(255, 255, 255, 0.12));
    --wt-checkbox-bg: var(--vscode-checkbox-background, #313131);
    --wt-checkbox-border: var(--vscode-checkbox-border, #6b6b6b);
    --wt-avatar: var(--vscode-badge-background, #5a5a5a);
    --wt-avatar-fg: var(--vscode-badge-foreground, #ffffff);
    --wt-rail: var(--vscode-widget-border, rgba(255, 255, 255, 0.16));
    --wt-ind-border: var(--vscode-widget-border, rgba(255, 255, 255, 0.28));
    /* Qt brand green, completion card only. */
    --wt-success: #41cd52;
    --wt-success-bg: rgba(65, 205, 82, 0.12);

    box-sizing: border-box;
    max-width: 880px;
    margin: 0 auto;
    padding: 28px 22px 40px;
    font-family: var(
      --vscode-font-family,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      'Noto Sans',
      Roboto,
      Ubuntu,
      'Helvetica Neue',
      sans-serif
    );
    font-size: 13px;
    color: var(--wt-fg);
    background: var(--wt-bg);
  }

  :global(body.vscode-light) .walkthrough,
  :global(body.vscode-high-contrast-light) .walkthrough {
    --wt-success: #2e9e3f;
    --wt-success-bg: rgba(46, 158, 63, 0.1);
  }

  .walkthrough :global(*),
  .walkthrough :global(*::before),
  .walkthrough :global(*::after) {
    box-sizing: border-box;
  }

  .walkthrough :global(:focus-visible) {
    outline: 1px solid var(--wt-focus);
    outline-offset: 2px;
  }

  /* ── Header, progress, footer ── */
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .title {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
    letter-spacing: -0.01em;
    color: var(--wt-fg);
  }

  .intro {
    font-size: 13px;
    line-height: 1.5;
    color: var(--wt-desc);
    margin: 10px 0 0;
  }

  .progress-wrapper {
    margin-top: 26px;
  }

  .steps {
    margin-top: 32px;
  }

  .foot {
    margin-top: 28px;
    display: flex;
    align-items: center;
    gap: 32px;
    font-size: 13px;
  }

  .foot-note {
    color: var(--wt-desc);
  }

  .mark-done {
    margin-left: auto;
    gap: 6px;
  }

  /*
   * ── Shared building blocks ──
   * Buttons, links, cards and the action row are used by WalkthroughStep and
   * SignInCard alike. They are declared once here, scoped under the
   * walkthrough root, so the proposal's sizes have a single source of truth.
   */
  .walkthrough :global(.wt-btn) {
    font-family: inherit;
    font-size: 13px;
    font-weight: 400;
    line-height: 18px;
    border: 1px solid transparent;
    border-radius: 2px;
    padding: 8px 18px;
    cursor: pointer;
    transition: background-color 0.12s ease;
    background: var(--wt-btn);
    color: var(--wt-btn-fg);
  }

  .walkthrough :global(.wt-btn:hover) {
    background: var(--wt-btn-hover);
  }

  .walkthrough :global(.wt-btn:disabled) {
    opacity: 0.5;
    cursor: default;
  }

  .walkthrough :global(.wt-btn--secondary) {
    background: var(--wt-btn2);
    color: var(--wt-btn2-fg);
  }

  .walkthrough :global(.wt-btn--secondary:hover) {
    background: var(--wt-btn2-hover);
  }

  .walkthrough :global(.wt-link) {
    font-family: inherit;
    font-size: inherit;
    color: var(--wt-link);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-align: left;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .walkthrough :global(.wt-link:hover) {
    text-decoration: underline;
  }

  .walkthrough :global(.wt-card) {
    background: var(--wt-tile);
    border: 1px solid var(--wt-focus);
    border-radius: 4px;
    padding: 20px 26px;
  }

  .walkthrough :global(.wt-card--warning) {
    border-color: var(--wt-warning);
  }

  .walkthrough :global(.wt-card--error) {
    border-color: var(--wt-error);
  }

  .walkthrough :global(.wt-card-head) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .walkthrough :global(.wt-card-title) {
    font-size: 15px;
    font-weight: 600;
  }

  .walkthrough :global(.wt-card-body) {
    font-size: 13px;
    line-height: 1.5;
    color: var(--wt-desc);
    margin: 10px 0 16px;
  }

  .walkthrough :global(.wt-card-lead) {
    font-size: 13px;
    line-height: 1.5;
    margin: 14px 0 2px;
  }

  .walkthrough :global(.wt-card-sub) {
    font-size: 12px;
    line-height: 1.5;
    color: var(--wt-desc);
    margin: 0;
  }

  .walkthrough :global(.wt-card-meta) {
    font-size: 12px;
    color: var(--wt-desc);
    margin-top: 8px;
  }

  .walkthrough :global(.wt-actions + .wt-card-meta) {
    margin-top: 12px;
  }

  .walkthrough :global(.wt-divider) {
    border: none;
    border-top: 1px solid var(--wt-divider);
    margin: 16px 0 14px;
  }

  .walkthrough :global(.wt-actions) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .walkthrough :global(.wt-actions-or) {
    font-size: 12px;
    color: var(--wt-desc);
    padding: 0 4px;
  }

  .walkthrough :global(.wt-actions-end) {
    margin-left: auto;
  }

  .walkthrough :global(.wt-done-tag) {
    font-size: 12px;
    font-weight: 500;
    color: var(--wt-link);
    margin-left: 8px;
  }

  .walkthrough :global(.wt-reveal) {
    animation: wt-reveal 0.24s cubic-bezier(0.2, 0.7, 0.3, 1);
  }

  @keyframes -global-wt-reveal {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .walkthrough :global(.wt-sr) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .walkthrough :global(.wt-reveal) {
      animation: none;
    }

    .walkthrough :global(.wt-btn) {
      transition: none;
    }
  }
</style>
