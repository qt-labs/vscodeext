<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ExternalLink } from '@lucide/svelte';

  import { SIGN_IN_COMMANDS } from './commands';
  import type { PrivacyKey, SignInStepState, WalkthroughStepData } from './types';

  interface Props {
    step: WalkthroughStepData;
    signIn: SignInStepState;
    onaction?: (stepId: string, command: string, commandArgs?: unknown) => void;
    oncontinue?: () => void;
    onprivacy?: (key: PrivacyKey, enabled: boolean) => void;
    onhide?: () => void;
  }

  let { step, signIn, onaction, oncontinue, onprivacy, onhide }: Props = $props();

  const FALLBACK_ERROR =
    "That didn't go through, your code or link may have expired. Try again.";

  // A completed step always reviews the signed-in card, whatever the phase.
  const done = $derived(step.status === 'completed');
  const email = $derived(signIn.email ?? '');
  const initial = $derived(email ? email.charAt(0).toUpperCase() : 'Q');

  function run(command: string) {
    onaction?.(step.id, command);
  }
</script>

{#snippet troubleshoot()}
  <div class="wt-card-meta">
    Still stuck?
    <button
      class="wt-link"
      title="Opens troubleshooting help in the browser"
      onclick={() => run(SIGN_IN_COMMANDS.troubleshoot)}
    >
      Troubleshoot <ExternalLink size={12} />
    </button>
  </div>
{/snippet}

{#if done || signIn.phase === 'signedIn'}
  <!-- 1d: signed in. Also the review view of the completed step. -->
  <div class="wt-card wt-reveal">
    {#if done}
      <div class="wt-card-head">
        <div class="wt-card-title">
          You're signed in<span class="wt-done-tag">Completed</span>
        </div>
        <button
          class="wt-link"
          aria-label="Collapse step"
          aria-expanded="true"
          onclick={() => onhide?.()}
        >
          Hide
        </button>
      </div>
    {:else}
      <div class="wt-card-title">You're signed in</div>
    {/if}

    <div class="account">
      <span class="avatar" aria-hidden="true">{initial}</span>
      <div class="account-text">
        <div class="account-label">Signed in as</div>
        <div class="account-email">{email}</div>
      </div>
      {#if !done}
        <button class="wt-link account-link" onclick={() => run(SIGN_IN_COMMANDS.signOut)}>
          Sign out
        </button>
      {/if}
    </div>

    <hr class="wt-divider" />

    <div class="section-label">Privacy &amp; data</div>
    <div class="opt">
      <input
        type="checkbox"
        class="check"
        id="wt-pref-usage"
        checked={signIn.privacy.usage}
        onchange={(e) => onprivacy?.('usage', e.currentTarget.checked)}
      />
      <span>
        <label for="wt-pref-usage">
          Help us improve Qt by allowing tracking of pseudonymous usage data.
        </label>
        <button
          class="wt-link"
          title="Opens the privacy policy in the browser"
          onclick={() => run(SIGN_IN_COMMANDS.learnMore)}
        >
          Learn more
        </button>
      </span>
    </div>
    <div class="opt">
      <input
        type="checkbox"
        class="check"
        id="wt-pref-crash"
        checked={signIn.privacy.crash}
        onchange={(e) => onprivacy?.('crash', e.currentTarget.checked)}
      />
      <span>
        <label for="wt-pref-crash">Allow collection of crash dump statistics</label>
      </span>
    </div>
    <p class="note">Optional. You can change this later in settings.</p>

    {#if !done}
      <div class="wt-actions">
        <button class="wt-btn" onclick={() => oncontinue?.()}>Continue</button>
      </div>
    {/if}
  </div>
{:else if signIn.phase === 'signing'}
  <!-- 1a: waiting for the browser. -->
  <div class="wt-card wt-reveal" aria-busy="true">
    <div class="wt-card-title">Signing in to Qt Account…</div>
    <p class="wt-card-lead">Waiting for you in the browser…</p>
    <p class="wt-card-sub">
      We will bring you back here automatically once you are signed in.
    </p>
    <hr class="wt-divider" />
    <div class="wt-card-meta">
      Didn't open?
      <button class="wt-link" onclick={() => run(SIGN_IN_COMMANDS.reopen)}>
        Open the sign-in page again
      </button>
    </div>
    <div class="wt-card-meta">
      <button class="wt-link" onclick={() => run(SIGN_IN_COMMANDS.cancel)}>Cancel</button>
    </div>
  </div>
{:else if signIn.phase === 'stalled'}
  <!-- 1b: no answer from the browser yet. -->
  <div class="wt-card wt-card--warning wt-reveal">
    <div class="wt-card-title">
      Still there? We haven't heard back from the browser yet.
    </div>
    <p class="wt-card-body">
      Look for a Qt Account tab, it may have opened behind this window, or in a
      different browser.
    </p>
    <div class="wt-actions">
      <button class="wt-btn" onclick={() => run(SIGN_IN_COMMANDS.reopen)}>
        Open the sign-in page again
      </button>
    </div>
    {@render troubleshoot()}
    <div class="wt-card-meta">
      <button class="wt-link" onclick={() => run(SIGN_IN_COMMANDS.cancel)}>Cancel</button>
    </div>
  </div>
{:else if signIn.phase === 'failed'}
  <!-- 1c: the sign-in failed. -->
  <div class="wt-card wt-card--error wt-reveal">
    <div class="wt-card-title">Sign-in failed</div>
    <p class="wt-card-body">{signIn.errorMessage || FALLBACK_ERROR}</p>
    <div class="wt-actions">
      <button class="wt-btn" onclick={() => run(SIGN_IN_COMMANDS.signIn)}>
        Restart sign-in
      </button>
    </div>
    {@render troubleshoot()}
  </div>
{:else}
  <!-- idle: every button hands off to the browser. -->
  <div class="wt-card wt-reveal">
    <div class="wt-card-head">
      <div class="wt-card-title">{step.title}</div>
      <span class="wt-sr">Current step</span>
    </div>
    <p class="wt-card-body">{step.description}</p>
    <div class="wt-actions">
      <button class="wt-btn" onclick={() => run(SIGN_IN_COMMANDS.signIn)}>Sign In</button>
      <span class="wt-actions-or">or</span>
      <button class="wt-btn" onclick={() => run(SIGN_IN_COMMANDS.createAccount)}>
        Create Account
      </button>
      <button
        class="wt-btn wt-btn--secondary wt-actions-end"
        title="Opens password reset in the browser"
        onclick={() => run(SIGN_IN_COMMANDS.forgotPassword)}
      >
        Forgot Password
      </button>
    </div>
  </div>
{/if}

<style>
  .account {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--wt-avatar);
    color: var(--wt-avatar-fg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .account-text {
    flex: 1;
    min-width: 0;
  }

  .account-label {
    font-size: 12px;
    color: var(--wt-desc);
  }

  .account-email {
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-link {
    font-size: 13px;
  }

  .section-label {
    font-size: 12px;
    color: var(--wt-desc);
    margin-bottom: 10px;
  }

  .opt {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    margin-bottom: 10px;
  }

  .opt label {
    cursor: pointer;
  }

  .check {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    margin: 0;
    flex-shrink: 0;
    border: 1px solid var(--wt-checkbox-border);
    border-radius: 3px;
    background: var(--wt-checkbox-bg);
    display: inline-grid;
    place-content: center;
    cursor: pointer;
  }

  .check:checked {
    background: var(--wt-btn);
    border-color: var(--wt-btn);
  }

  .check:checked::before {
    content: '';
    width: 9px;
    height: 5px;
    border-left: 2px solid #ffffff;
    border-bottom: 2px solid #ffffff;
    transform: translateY(-1px) rotate(-45deg);
  }

  .note {
    font-size: 12px;
    color: var(--wt-desc);
    margin: 2px 0 16px;
  }
</style>
