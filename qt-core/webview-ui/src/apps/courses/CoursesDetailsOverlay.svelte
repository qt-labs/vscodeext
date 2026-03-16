<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { ArrowLeftToLine } from '@lucide/svelte';

  import Column from '@/comps/Column.svelte';
  import Overlay from '@/comps/Overlay.svelte';
  import Separator from '@/comps/Separator.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import { courses as texts } from '@/apps/texts';

  import CoursesDetailsBody from './CoursesDetailsBody.svelte';
  import CoursesDetailsHeader from './CoursesDetailsHeader.svelte';
  import { ui } from './states.svelte';

  const overlay = $derived(ui.overlays.details);
  let course = $derived(ui.selected.course);
  let bodyContainerEl = $state(undefined as HTMLDivElement | undefined);

  $effect(() => {
    void ui.selected.course;
    if (bodyContainerEl) {
      bodyContainerEl.scrollTop = 0;
    }
  })
</script>

{#if course}
  <Overlay
    bind:collapsed={overlay.collapsed}
    title={texts.details.title}
    class="w-[650px] max-h-full pointer-events-auto"
    useDropShadow={true}
    bodyClass='!p-4 !pt-2 flex flex-col min-h-0'
    titleClass="h-[32px] qt-label highlight pl-2"
    backgroundClass='!opacity-98'
    onCloseClicked={() => {
      overlay.visible = false;
    }}
  >
    {#snippet toolbar()}
      {@render TitleToolbar()}
    {/snippet}

    <Column class='w-full flex flex-col min-h-0'>
      <CoursesDetailsHeader />
      <Separator class='!my-1'/>
      <div
        bind:this={bodyContainerEl}
        class='grow min-h-0 overflow-y-auto'
      >
        <CoursesDetailsBody />
      </div>
    </Column>
  </Overlay>
{/if}

{#snippet TitleToolbar()}
  <button
    class="grow flex flex-row items-center cursor-pointer min-w-0"
    onclick={() => {
      overlay.collapsed = !overlay.collapsed;
    }}
  >
    {#if overlay.collapsed && course?.name}
      <div class="qt-label dimmed truncate min-w-0">
        {course.name}
      </div>
    {/if}

    <div class="grow"></div>
    <IconButton
      flat square
      icon={ArrowLeftToLine}
      class={`w-1 border-0! ${overlay.alignLeft ? 'rotate-180' : ''}`}
      onClicked={() => {
        overlay.alignLeft = !overlay.alignLeft;
      }}
    />
  </button>
{/snippet}
