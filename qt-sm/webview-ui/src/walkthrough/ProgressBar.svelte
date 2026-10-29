<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  interface Props {
    completed: number;
    total: number;
  }

  let { completed, total }: Props = $props();

  const pct = $derived(total > 0 ? Math.round((completed / total) * 100) : 0);
</script>

<div class="progress">
  <div class="progress-head">
    <span>Progress</span>
    <span class="progress-count">{completed} of {total}</span>
  </div>
  <div
    class="progress-track"
    role="progressbar"
    aria-label="Walkthrough progress"
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={completed}
  >
    <div class="progress-fill" style:width="{pct}%"></div>
  </div>
</div>

<style>
  .progress-head {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--wt-desc);
  }

  .progress-count {
    color: var(--wt-fg);
    font-weight: 600;
  }

  .progress-track {
    margin-top: 10px;
    height: 4px;
    border-radius: 2px;
    background: var(--wt-rail);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--wt-btn);
    transition: width 0.3s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }
  }
</style>
