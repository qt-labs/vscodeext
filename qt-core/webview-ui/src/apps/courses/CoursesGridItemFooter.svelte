<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Component } from 'svelte';
  import { MessageCircleMore, Users, Star } from '@lucide/svelte';

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import IconSection from '@/comps/IconSection.svelte';
  import * as format from '@/utils/format';

  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { type SortBy, type Course } from './types.svelte';
  import CoursesLevelIcons from './CoursesLevelIcons.svelte';

  let {
    course = undefined as Course | undefined,
  } = $props();
</script>

{#if course}
  <Column class='!-space-y-2 px-1 pt-1'>
    <Row class='!gap-0'>
      {#if (course.type === 'course')}
        <CoursesLevelIcons level={course.level} />
        <div class='grow'></div>
        {@render Item(Users, course?.stats.enrolled, 'enrolled')}
        {@render Item(MessageCircleMore, course?.stats.reviews, 'reviews')}
        {@render Item(Star, course?.stats.fiveStarRatingString, 'ratings')}
      {:else}
        <div class='h-[0.5em]'></div>
      {/if}
    </Row>
    <Row>
      {#if (course.type !== 'course')}
        <CoursesLevelIcons level={course.level} />
      {/if}
      <div class='grow'></div>
      {@render Item(null, course.publishedDateDisplayShort, 'newest')}
    </Row>
  </Column>
{/if}

<!-- snippet -->
{#snippet Item(icon: Component | null, value: unknown, sortBy: SortBy)}
  {@const highlight = (ui.selected.sortBy === sortBy)}

  <button
    class={`
      hover:cursor-pointer rounded-sm
      ${highlight ? 'bg-gray-500/50' : ''}
    `}
    onclick={() => {
      viewlogic.setSort(
        ui.selected.sortBy === sortBy ? 'name' : sortBy
      );
    }}
  >
    <IconSection
      {icon}
      class={`
        !gap-1 px-1.5 py-0.5
        ${highlight ? 'text-gray-200' : 'text-gray-500'}
      `}
    >
      {#if typeof value === 'number'}
        {format.countCompact(value)}
      {:else}
        {String(value) || '-'}
      {/if}
    </IconSection>
  </button>
{/snippet}
