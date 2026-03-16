<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Component } from 'svelte';
  import {
    X,
    Star,
    Globe,
    Users,
    ArrowDownAZ,
    ClockArrowDown,
    MessageCircleMore,
    CalendarArrowDown,
  } from '@lucide/svelte';

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import Picker from '@/comps/Picker.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import SearchInput from '@/comps/SearchInput.svelte';
  import { type PickerItem } from '@/comps/types.svelte';
  import { courses as texts } from '@/apps/texts';

  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';
  import { type SortBy } from './types.svelte';
  import type { CourseLevel, CourseType } from '@shared/courses';

  let value = $derived(ui.filter.query);
  const emptyRawData = $derived(data.raw.length === 0);
  const emptyRefinedData = $derived(data.refined.length === 0);
  const hasFilter = $derived(
    ui.filter.type !== undefined || ui.filter.level !== undefined
  );

  interface TypeFilterItem extends PickerItem { type: CourseType | 'any' };
  interface LevelFilterItem extends PickerItem { level: CourseLevel | 'any' };

  let typeFilterIndex = $state(-1);
  const typeFilterItems: TypeFilterItem[] = [
    { text: '-', type: 'any' },
    { text: texts.typeText('course'), type: 'course' },
    { text: texts.typeText('learningpath'), type: 'learningpath' }
  ]

  let levelFilterIndex = $state(-1);
  const levelFilterItems: LevelFilterItem[] = [
    { text: '-', level: 'any' },
    { text: texts.levelText('basic'), level: 'basic' },
    { text: texts.levelText('intermediate'), level: 'intermediate' },
    { text: texts.levelText('advanced'), level: 'advanced' }
  ]

  interface SortItem extends PickerItem { sortBy: SortBy };
  let sortIndex = $state(-1);
  const sortItems: SortItem[] = ([
    ['name', ArrowDownAZ],
    ['newest', CalendarArrowDown],
    ['shortest', ClockArrowDown],
    ['enrolled', Users],
    ['reviews', MessageCircleMore],
    ['ratings', Star]
  ] as [SortBy, Component][]).map(
    ([sortBy, icon]) => ({ text: texts.sortPickerText(sortBy), sortBy, icon })
  );

  $effect(() => {
    void ui.selected.sortBy;
    void ui.filter.type;
    void ui.filter.level;

    typeFilterIndex = typeFilterItems.findIndex((i) => i.type === ui.filter.type);
    levelFilterIndex = levelFilterItems.findIndex((i) => i.level === ui.filter.level);
    sortIndex = sortItems.findIndex((i) => i.sortBy === ui.selected.sortBy);
  })
</script>

<Row class="w-full">
  {@render CourseCount()}

  <Row class='grow qt-surface p-3 gap-3'>
    {@render SearchSection()}
    {@render FilterSection()}
    {@render SortSection()}
  </Row>

  {@render ExplorerMore()}
</Row>

<!-- snippets -->
{#snippet CourseCount()}
  <Column class='h-full min-w-[120px] qt-surface items-center justify-center'>
    <p class='font-bold !text-3xl'>
      {data.refined.length}
    </p>
    {@render SectionTitle(texts.header.numCourses(data.refined.length))}
  </Column>
{/snippet}

{#snippet SearchSection()}
  <Column class='grow'>
    {@render SectionTitle(texts.header.sectionSearch)}
    <SearchInput
      bind:value
      disabled={emptyRawData}
      acceptDelay={50}
      placeholder={texts.header.searchPlaceHolder}
      onAcceptTriggered={() => {
        viewlogic.setQuery(value);
      }}
    />
  </Column>
{/snippet}

{#snippet FilterSection()}
  <Column>
    <Row>
      {@render SectionTitle(texts.header.sectionFilter)}
      {#if hasFilter}
        <button
          class='
            h-full aspect-square flex items-center justify-center
            qt-border-radius bg-gray-500/10
          '
          onclick={() => {
            viewlogic.setFilter(undefined, undefined);
          }}
        >
          <X />
        </button>
      {/if}
    </Row>
    <Row class='min-w-[270px]'>
      <Picker
        bind:currentIndex={typeFilterIndex}
        disabled={emptyRawData}
        items={typeFilterItems}
        showIcon={false}
        defaultText={texts.filter.typePickerDefaultText}
        onSelected={(index: number) => {
          const selectedType = typeFilterItems[index].type;
          viewlogic.setFilter(
            selectedType === 'any' ? undefined : selectedType,
            ui.filter.level
          );
        }}
      />
      <Picker
        bind:currentIndex={levelFilterIndex}
        disabled={emptyRawData}
        items={levelFilterItems}
        showIcon={false}
        defaultText={texts.filter.levelPickerDefaultText}
        onSelected={(index: number) => {
          const selectedLevel = levelFilterItems[index].level;
          viewlogic.setFilter(
            ui.filter.type,
            selectedLevel === 'any' ? undefined : selectedLevel
          );
        }}
      />
    </Row>
  </Column>
{/snippet}

{#snippet SortSection()}
  <Column>
    {@render SectionTitle(texts.header.sectionSort)}
    <div class='w-[200px] h-full flex flex-row gap-0'>
      <Picker
        bind:currentIndex={sortIndex}
        disabled={emptyRefinedData}
        items={sortItems}
        onSelected={(index: number) => {
          viewlogic.setSort(sortItems[index].sortBy);
        }}
      />
    </div>
  </Column>
{/snippet}

{#snippet ExplorerMore()}
  <div class='qt-surface'>
    <IconButton
      flat
      icon={Globe}
      align='col'
      text={texts.header.openQtAcademy}
      class='h-full !border-none'
      textClass='qt-label'
      tooltip={texts.header.openQtAcademyTooltip}
      tooltipPlacement='bottom-end'
      onClicked={() => {
        viewlogic.runAction('open-academy-home');
      }}
    />
  </div>
{/snippet}

{#snippet SectionTitle(text: string)}
  <p class='qt-label highlight'>{text}</p>
{/snippet}
