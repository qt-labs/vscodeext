<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import Rating from 'flowbite-svelte/Rating.svelte';
  import { ExternalLink, Timer, Users } from '@lucide/svelte';

  import * as format from '@/utils/format';
  import { courses as texts } from '@/apps/texts';
  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import IconButton from '@/comps/IconButton.svelte';

  import CourseLevelIcons from './CoursesLevelIcons.svelte';
  import { ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  let course = $derived(ui.selected.course);
  const stats = $derived(ui.selected.course?.stats);
</script>

{#if course}
  <Column>
    {@render MetadataSection()}

    <Row class='w-full !gap-5 mt-2'>
      <Column class='grow'>
        <div class='text-3xl leading-[150%]'>
          {course.name}
        </div>
        <div class='grow'></div>
        <Row class='items-end'>
          {@render OpenButton()}
          <div class='grow'></div>

          {#if course?.type === 'course'}
            {@render RatingAndReviews()}
          {/if}

        </Row>
      </Column>

      <img
        class="w-[200px] object-contain object-top"
        alt={course.thumbnailUrl}
        src={course.thumbnailUrl}
      />
    </Row>
  </Column>
{/if}

<!-- snippets -->
{#snippet MetadataSection()}
  <Row class='gap-3 items-center'>
    <Row class='bg-gray-500/20 py-2 px-4 rounded-sm'>
      <Timer />
      {course?.durationDisplay ?? '-'}
    </Row>

    <Row class='bg-gray-500/20 py-2 px-4 rounded-sm'>
      {course?.level ? texts.levelText(course.level) : '-'}
      <CourseLevelIcons level={course?.level} strokeOpacity={0.5} />
    </Row>

    {#if course?.type === 'course'}
      <Row class='bg-gray-500/20 py-2 px-4 rounded-sm'>
        <Users />
        {stats?.enrolled ? format.countAsLocaleString(stats.enrolled) : '-'}
      </Row>
    {/if}

    <div class='grow'></div>

    <div class='qt-label dimmed'>
      {texts.details.releaseDatePrefix} {course?.publishedDateDisplay ?? '-'}
    </div>
  </Row>
{/snippet}

{#snippet RatingAndReviews()}
  {@const value = stats?.fiveStarRating ?? 0}
  {@const text = stats?.fiveStarRatingString ?? ''}

  <Row class='items-center leading-0'>
    {@render RatingDisplay(value, text)}
    {stats?.reviews ? format.countAsLocaleString(stats.reviews) +' reviews' : ''}
  </Row>
{/snippet}

<!-- snippets -->
{#snippet OpenButton()}
  <IconButton
    icon={ExternalLink}
    text={texts.details.openButton(course?.type ?? 'course')}
    onClicked={() => {
      if (ui.selected.course) {
        viewlogic.runAction('open-course');
      }
    }}
  />
{/snippet}

{#snippet RatingDisplay(value: number, text: string)}
  {@const numHalfStars = Math.floor(value / 0.5)}
  {#if value === 0}
    -
  {:else}
    <Row class='items-center !gap-1 leading'>
      <div class='flex h-full items-end'>{text}</div>
      <Rating
        total={5}
        size={20}
        color='#ff0000'
        rating={numHalfStars / 2}
        divClass="flex flex-row items-center -space-x-2"
      />
    </Row>
  {/if}
{/snippet}
