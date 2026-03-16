<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Timer } from '@lucide/svelte';

  import Column from '@/comps/Column.svelte';
  import QtShapeButton from '@/comps/QtShapeButton.svelte';
  import * as theme from '@/apps/theme.svelte';

  import CoursesGridItemFooter from './CoursesGridItemFooter.svelte';
  import { type Course } from './types.svelte';
  import * as viewlogic from './viewlogic.svelte';

  let {
    course = undefined as Course | undefined,
    class: className = ''
  } = $props();
</script>

{#if course}
  <Column class={`group !gap-1 pb-4 ${className}`}>
    <div class='
      relative
      group-hover:-translate-y-4 transition-all duration-150 ease-out'
    >
      {#if course.type === 'learningpath'}
        {@const stacks = ['left-2 top-2', 'left-1 top-1']}
        {#each stacks as stack, i (i)}
          <div class={`absolute w-full h-full ${stack}`}>
            {@render Card(course, 'shadow')}
          </div>
        {/each}
      {/if}

      {@render Card(course, 'cover')}
    </div>
    <CoursesGridItemFooter {course} />
  </Column>
{/if}

<!-- snippets -->
{#snippet Card(course: Course, type: 'cover' | 'shadow')}
  <QtShapeButton
    hoverEffect='none'
    borderColor={true}
    borderThickness={0.4}
    class='w-full h-full'
    onClicked={() => {
      if (type === 'cover') {
        viewlogic.selectCourse(course);
      }
    }}
  >
    {#if type === 'cover'}
      {@render CardBadge(course)}
    {/if}

    <img
      src={course.thumbnailUrl}
      alt={course.thumbnailUrl}
      title={course.name + '\n\n' + course.keywords.trim()}
      class={`
        w-full h-full object-cover object-top
        ${type === 'shadow' ? 'brightness-80' : ''}
      `}
    />

  </QtShapeButton>
{/snippet}

{#snippet CardBadge(course: Course)}
  <div class='
    absolute opacity-85 py-2 px-4 rounded-br-2xl
    flex flex-row items-center gap-1'
    style:color={theme.qtColors.foreground}
    style:background-color={theme.qtColors.background}
  >
    <Timer />
    {course.durationDisplay}
  </div>
{/snippet}
