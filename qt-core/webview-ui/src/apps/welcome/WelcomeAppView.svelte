<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Check, TriangleAlert } from '@lucide/svelte';

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import IconButton from '@/comps/IconButton.svelte';
  import { welcome as texts } from '@/apps/texts';

  import WelcomeGetStarted from './WelcomeGetStarted.svelte';
  import WelcomeBlogOrVideo from './WelcomeBlogOrVideo.svelte';
  import { data, ui } from './states.svelte';

  const qtcoreExt = $derived(data.ext.find((e) => e.id === 'theqtcompany.qt-core'));
  const versionsOk = $derived.by(() => {
    const qtcore = data.ext.find((e) => e.id === 'theqtcompany.qt-core');
    if (!qtcore || qtcore.version.length === 0) {
      return false;
    }

    for (const ext of data.ext) {
      if (ext.version.length !== 0) {
        if (ext.version !== qtcore.version) {
          return false;
        }
      }
    }

    return true;
  });
</script>

<Column class='!gap-10 p-4'>
  {@render Header()}
  {@render GetStarted()}
  <div class='grid grid-cols-2 gap-10 mt-5 w-full'>
    <WelcomeBlogOrVideo source='blog' items={data.blogs} />
    <WelcomeBlogOrVideo source='video' items={data.videos} />
  </div>
</Column>

<!-- snippets -->
{#snippet Header()}
  <Row class='w-full items-center'>
    <p class='qt-label bright !text-4xl grow'>
      {texts.title}
    </p>
    <IconButton
      flat={ui.overlays.versions.visible ? false : true}
      class='!border-none self-end'
      icon={versionsOk ? Check : TriangleAlert}
      text={qtcoreExt?.version ?? ''}
      onClicked={() => {
        ui.overlays.versions.visible = !ui.overlays.versions.visible;
      }}
    />
  </Row>
{/snippet}

{#snippet GetStarted()}
  <Column class='w-full'>
    {@render SectionTitle(texts.getStarted.title)}
    <WelcomeGetStarted />
  </Column>
{/snippet}

{#snippet SectionTitle(text: string)}
  <p class='qt-label highlight !text-xl grow'>
    {text}
  </p>
{/snippet}
