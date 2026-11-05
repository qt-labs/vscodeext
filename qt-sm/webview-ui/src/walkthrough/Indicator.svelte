<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Check, CircleX, LoaderCircle, TriangleAlert } from '@lucide/svelte';

  import type { SignInPhase, StepStatus } from './types';

  interface Props {
    status: StepStatus;
    index: number;
    /** Only set for the sign-in step; drives the icon of the active circle. */
    phase?: SignInPhase;
  }

  let { status, index, phase }: Props = $props();
</script>

<span
  class="ind"
  class:ind-done={status === 'completed'}
  class:ind-locked={status === 'locked'}
  class:ind-active={status === 'active'}
>
  {#if status === 'completed'}
    <Check size={20} />
  {:else if status === 'locked'}
    {index + 1}
  {:else if phase === 'signing'}
    <span class="spin" aria-hidden="true"><LoaderCircle size={20} /></span>
  {:else if phase === 'stalled'}
    <TriangleAlert size={20} />
  {:else if phase === 'failed'}
    <CircleX size={20} />
  {:else if phase === 'signedIn'}
    <Check size={20} />
  {:else}
    {index + 1}
  {/if}
</span>

<style>
  .ind {
    box-sizing: border-box;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
  }

  .ind-active {
    background: var(--wt-btn);
    color: var(--wt-btn-fg);
  }

  .ind-done {
    border: 1.5px solid var(--wt-btn);
    color: var(--wt-link);
  }

  .ind-locked {
    border: 1.5px solid var(--wt-ind-border);
    color: var(--wt-desc);
  }

  .spin {
    display: inline-flex;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }
</style>
