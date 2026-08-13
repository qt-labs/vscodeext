<!-- Copyright (C) 2026 The Qt Company Ltd. -->
<!-- SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only -->

<script lang="ts">
  import type {
    LicenseAgreement,
    MessageToWebview,
    MessageToExtension
  } from './shared';

  let agreements: LicenseAgreement[] = $state([]);
  let selectedIndex: number = $state(0);
  let selectedAgreement: LicenseAgreement | undefined = $derived(
    agreements[selectedIndex]
  );
  // The user must explicitly tick the accept checkbox before the primary
  // button unlocks.
  let accepted: boolean = $state(false);

  let cancelBtn: HTMLButtonElement | undefined = $state();
  let acceptBtn: HTMLButtonElement | undefined = $state();
  let acceptCheckbox: HTMLInputElement | undefined = $state();

  // @ts-ignore — acquireVsCodeApi is injected by the host
  const vscodeApi = typeof acquireVsCodeApi === 'function'
    ? acquireVsCodeApi()
    : undefined;

  function postMessage(msg: MessageToExtension) {
    vscodeApi?.postMessage(msg);
  }

  function handleMessage(event: MessageEvent) {
    const msg = event.data as MessageToWebview;
    if (msg.type === 'init') {
      agreements = msg.payload.agreements;
      selectedIndex = 0;
      accepted = false;
    }
  }

  function onAccept() {
    if (!accepted) {
      return;
    }
    postMessage({ type: 'accept' });
  }

  function onCancel() {
    postMessage({ type: 'cancel' });
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    // Focus cycle in visual order: checkbox, Cancel, Continue. Skip
    // disabled buttons (Continue while unchecked) so arrow-key navigation
    // never lands on a control that cannot be activated.
    type Control = HTMLInputElement | HTMLButtonElement;
    const controls = [acceptCheckbox, cancelBtn, acceptBtn].filter(
      (c) => c && !c.disabled
    ) as Control[];
    if (controls.length === 0) {
      return;
    }
    const active = document.activeElement as Control | null;
    const focused = active ? controls.indexOf(active) : -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      controls[(focused + 1) % controls.length]?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      controls[(focused - 1 + controls.length) % controls.length]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Enter activates the focused control; for the checkbox, click()
      // toggles it (Space already toggles natively, Enter does not).
      if (active && controls.includes(active)) {
        event.preventDefault();
        active.click();
      }
    }
  }

  $effect(() => {
    window.addEventListener('message', handleMessage);
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', handleGlobalKeydown);
    };
  });

  // Auto-focus the accept checkbox once it is rendered — the primary button
  // starts disabled, so the checkbox is the first actionable control.
  $effect(() => {
    if (agreements.length > 0 && acceptCheckbox) {
      acceptCheckbox.focus();
    }
  });
</script>

<div class="container">
  {#if agreements.length === 0}
    <div class="empty">No license agreements to display.</div>
  {:else}
    <div class="content">
      <div class="header">
        <h1>License Agreement</h1>
        <p>To use Qt framework you have to accept the license agreements</p>
      </div>

      <div class="main-area">
        <!-- Left panel: license list -->
        <div class="sidebar">
          {#each agreements as agreement, i}
            <button
              class="license-item"
              class:selected={i === selectedIndex}
              onclick={() => (selectedIndex = i)}
            >
              {agreement.title}
            </button>
          {/each}
        </div>

        <!-- Right panel: license text -->
        <div class="license-text-container">
          {#if selectedAgreement}
            <pre class="license-text">{selectedAgreement.text}</pre>
          {/if}
        </div>
      </div>

      <!-- Accept checkbox: gates the Continue button -->
      <div class="accept-row">
        <label class="accept-label">
          <input
            type="checkbox"
            bind:this={acceptCheckbox}
            bind:checked={accepted}
          />
          I have read these and accept the license agreements
        </label>
      </div>

      <!-- Footer with action buttons -->
      <div class="footer" role="group">
        <button bind:this={cancelBtn} class="btn btn-secondary" onclick={onCancel}>Cancel</button>
        <button
          bind:this={acceptBtn}
          class="btn btn-primary"
          disabled={!accepted}
          onclick={onAccept}
        >
          Continue
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
  }

  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--vscode-descriptionForeground);
  }

  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 20px;
    gap: 15px;
    min-height: 0;
  }

  /* ── Header ───────────────────────────────────────────────────── */
  .header h1 {
    font-size: 20px;
    font-weight: normal;
    color: var(--vscode-foreground);
    margin-bottom: 10px;
  }

  .header p {
    font-size: 13px;
    color: var(--vscode-descriptionForeground);
  }

  /* ── Two-column layout ────────────────────────────────────────── */
  .main-area {
    display: flex;
    gap: 15px;
    flex: 1;
    min-height: 0;
  }

  /* ── Left panel: license list ─────────────────────────────────── */
  .sidebar {
    flex: 0 0 250px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }

  .license-item {
    display: block;
    width: 100%;
    padding: 10px;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    font-family: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    outline: none;
    line-height: 1.4;
  }

  .license-item:hover {
    background-color: var(--vscode-list-hoverBackground);
  }

  .license-item:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .license-item.selected {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }

  /* ── Right panel: license text ────────────────────────────────── */
  .license-text-container {
    flex: 1;
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding: 20px;
    overflow-y: auto;
    min-width: 0;
  }

  .license-text {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    line-height: 1.5;
    color: var(--vscode-editor-foreground);
  }

  /* ── Accept checkbox ──────────────────────────────────────────── */
  .accept-row {
    display: flex;
    justify-content: center;
    flex-shrink: 0;
  }

  .accept-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
  }

  .accept-label input[type='checkbox'] {
    width: 16px;
    height: 16px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--vscode-button-background);
  }

  .accept-label input[type='checkbox']:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 2px;
  }

  /* ── Footer ───────────────────────────────────────────────────── */
  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-shrink: 0;
    border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding-top: 15px;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    outline: none;
  }

  .btn:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }

  .btn-primary {
    color: var(--vscode-button-foreground);
    background-color: var(--vscode-button-background);
  }

  .btn-primary:hover {
    background-color: var(--vscode-button-hoverBackground);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn-primary:disabled:hover {
    background-color: var(--vscode-button-background);
  }

  .btn-secondary {
    color: var(--vscode-button-secondaryForeground);
    background-color: var(--vscode-button-secondaryBackground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
  }

  .btn-secondary:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }
</style>
