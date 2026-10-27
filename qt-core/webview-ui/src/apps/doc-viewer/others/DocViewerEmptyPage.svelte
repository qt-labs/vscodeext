<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { BookText } from "@lucide/svelte";
  import { docBrowser as texts } from '@/apps/texts';
</script>

<div class='w-full h-full flex items-center justify-center'>
  <div
    data-role='wrapper'
    class='flex flex-col gap-5 items-center select-none'
  >
    <BookText class='large' />
    <span>{texts.empty.title}</span>
  </div>
</div>

<style>
  [data-role='wrapper'] {
    color: var(--qt-text-muted);
  }
</style>
