<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Check } from '@lucide/svelte';

  interface Props {
    title?: string;
    message?: string;
  }

  let {
    title = "You're all set",
    message = 'Qt is installed and your first project is ready. Open the Qt extension to keep building.'
  }: Props = $props();
</script>

<!-- The only place the Qt green appears, so it never reads as "tappable". -->
<div class="complete wt-reveal" role="status" aria-label="All steps completed">
  <span class="badge" aria-hidden="true"><Check size={16} /></span>
  <div>
    <div class="title">{title}</div>
    <div class="sub">{message}</div>
  </div>
</div>

<style>
  .complete {
    margin-top: 20px;
    border-radius: 4px;
    border: 1px solid var(--wt-success);
    background: var(--wt-success-bg);
    padding: 16px 18px;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .badge {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--wt-success);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #ffffff;
  }

  .title {
    font-size: 14px;
    font-weight: 600;
  }

  .sub {
    font-size: 13px;
    color: var(--wt-desc);
    margin-top: 2px;
  }
</style>
