<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';

  import type { PrivacyKey, WalkthroughStepData } from './types';
  import Indicator from './Indicator.svelte';
  import SignInCard from './SignInCard.svelte';

  interface Props {
    step: WalkthroughStepData;
    index: number;
    /** The last item has no rail below its indicator and no bottom padding. */
    isLast?: boolean;
    /** Title of the step before this one, for the locked hint. */
    previousTitle?: string;
    reviewing?: boolean;
    onaction?: (stepId: string, command: string, commandArgs?: unknown) => void;
    onreview?: (stepId: string) => void;
    onsignincontinue?: () => void;
    onprivacy?: (key: PrivacyKey, enabled: boolean) => void;
  }

  let {
    step,
    index,
    isLast = false,
    previousTitle,
    reviewing = false,
    onaction,
    onreview,
    onsignincontinue,
    onprivacy
  }: Props = $props();

  const done = $derived(step.status === 'completed');
  const open = $derived(step.status === 'active' || (done && reviewing));
  const phase = $derived(step.signIn?.phase);
  const signInInProgress = $derived(
    phase === 'signing' || phase === 'stalled' || phase === 'failed'
  );
  // The rail turns blue once the step is done, or while the sign-in step is
  // mid-flight so the whole column reads as "in progress".
  const railActive = $derived(done || signInInProgress);
</script>

<div class="item" role="listitem" aria-current={step.status === 'active' ? 'step' : undefined}>
  <div class="gutter">
    <Indicator status={step.status} {index} {phase} />
    {#if !isLast}
      <div class="rail" class:rail-active={railActive} aria-hidden="true"></div>
    {/if}
  </div>

  <div class="content" class:content-last={isLast}>
    {#if open}
      {#if step.signIn}
        <SignInCard
          {step}
          signIn={step.signIn}
          {onaction}
          oncontinue={onsignincontinue}
          {onprivacy}
          onhide={() => onreview?.(step.id)}
        />
      {:else}
        <div class="wt-card wt-reveal">
          <div class="wt-card-head">
            <div class="wt-card-title">
              {step.title}{#if done}<span class="wt-done-tag">Completed</span>{/if}
            </div>
            {#if done}
              <button
                class="wt-link"
                aria-label="Collapse step"
                aria-expanded="true"
                onclick={() => onreview?.(step.id)}
              >
                Hide
              </button>
            {:else}
              <span class="wt-sr">Current step</span>
            {/if}
          </div>
          <p class="wt-card-body">{step.description}</p>
          {#if step.actions?.length}
            <div class="wt-actions">
              {#each step.actions as action}
                {#if action.text}
                  <span class="wt-actions-or">{action.label}</span>
                {:else}
                  <button
                    class="wt-btn"
                    class:wt-btn--secondary={!action.primary}
                    class:wt-actions-end={action.trailing}
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
    {:else if done}
      <button class="row row-done" aria-expanded="false" onclick={() => onreview?.(step.id)}>
        <div class="row-head">
          <span class="row-title">{step.title}</span>
          <span class="row-aside">Review <ChevronRight size={14} /></span>
        </div>
        {#if step.signIn?.email}
          <div class="row-hint">Signed in as {step.signIn.email}</div>
        {/if}
      </button>
    {:else}
      <div class="row row-locked">
        <div class="row-head">
          <span class="row-title">{step.title}</span>
        </div>
        {#if previousTitle}
          <div class="row-hint">Complete “{previousTitle}” to unlock</div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .item {
    display: flex;
    gap: 24px;
  }

  .gutter {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 44px;
    flex-shrink: 0;
  }

  .rail {
    width: 2px;
    flex: 1;
    min-height: 12px;
    background: var(--wt-rail);
  }

  .rail-active {
    background: var(--wt-btn);
  }

  .content {
    flex: 1;
    min-width: 0;
    padding-bottom: 28px;
  }

  .content-last {
    padding-bottom: 0;
  }

  /* Collapsed rows (done and locked) */
  .row {
    width: 100%;
    min-height: 44px;
    text-align: left;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    border-radius: 4px;
    padding: 4px 10px 4px 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: background-color 0.15s ease;
  }

  .row-done {
    cursor: pointer;
    padding-left: 10px;
    margin-left: -10px;
    width: calc(100% + 10px);
  }

  .row-done:hover {
    background: var(--wt-tile-hover);
  }

  .row-locked .row-title {
    color: var(--wt-desc);
  }

  .row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .row-title {
    font-size: 17px;
    font-weight: 600;
  }

  .row-aside {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--wt-desc);
    font-size: 12px;
  }

  .row-hint {
    font-size: 12px;
    color: var(--wt-desc);
    margin-top: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .row {
      transition: none;
    }
  }
</style>
