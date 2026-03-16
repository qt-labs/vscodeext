<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import DOMPurify from 'dompurify';
  import { Check } from '@lucide/svelte';

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import { courses as texts } from '@/apps/texts';

  import { ui } from './states.svelte';

  let course = $derived(ui.selected.course);
  const desc = $derived(processHtml(course?.descriptionHtml ?? ''));
  const objectives = $derived(processHtml(course?.objectivesHtml ?? ''));

  function processHtml(s: string) {
    let r = s.replaceAll('&nbsp;', ' ');
    r = r.replace(/<br>/g, '');
    r = r.replace(/<p>\s*<\/p>/g, '');
    r = r.replace(/<p>\s*\*{3,}\s*<\/p>/g, '<hr>');

    return DOMPurify.sanitize(r, { FORBID_ATTR: ['style'] });
  }

</script>

{#if course}
  <Column class='
    w-full min-h-[250px] !gap-8
    prose dark:prose-invert max-w-none
  '>
      {@render Section(texts.details.descSectionTitle, desc)}
      {@render Section(texts.details.objSectionTitle, objectives)}
  </Column>
{/if}

{#snippet Section(text: string, content: string)}
  {#if content.length !== 0}
    <Column class='gap-4'>
      <Row class='items-center'>
        <Check />
        <div class='qt-label highlight !text-xl'>
          {text}
        </div>
      </Row>

      <div class='mx-4'>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html content}
      </div>
    </Column>
  {/if}
{/snippet}

<style>
  :global(.prose) {
    color: var(--vscode-foregroundColor);
  }

  :global(.prose strong) {
    color: var(--qt-surface-foreground);
  }

  :global(.prose ul) {
    margin-top: 1.1rem;
    margin-bottom: 1.1rem;
  }

  :global(.prose ul > li) {
    margin-top: 0;
    margin-bottom: 0;
  }

  :global(.prose li > p) {
    margin-top: 0;
    margin-bottom: 0;
    line-height: 1.8rem;
  }

  :global(.prose li::marker) {
    color: unset;
  }

  :global(.prose li > ul) {
    margin-top: 0;
    margin-bottom: 0;
  }

  :global(.prose hr) {
    margin-top: 1.0rem;
    margin-bottom: 1.0rem;
    border-color: var(--qt-outline);
  }

  :global(.prose p) {
    margin-top: 0;
    margin-bottom: 0;
  }

  :global(.prose a) {
    color: unset;
  }

</style>
