<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { type Component } from 'svelte';
  import {
    Bug,
    Book,
    Blocks,
    PlusSquare
  } from '@lucide/svelte';

  import Row from '@/comps/Row.svelte';
  import Column from '@/comps/Column.svelte';
  import { welcome } from '@/apps/texts';

  import * as viewlogic from './viewlogic.svelte';

  interface Item {
    id?: string,
    title?: string,
    description?: string,
    icon?: Component,
    onclick?: () => void,
  }

  interface LinkItem {
    title?: string,
    onclick?: () => void,
  }

  const texts = welcome.getStarted;
  const items: Item[] = [
    {
      ...texts.newProject,
      icon: PlusSquare,
      onclick: () => {
        viewlogic.openWebview('new-project');
      },
    },
    {
      ...texts.examples,
      icon: Blocks,
      onclick: () => {
        viewlogic.openWebview('examples');
      },
    },
    {
      ...texts.documenation,
      icon: Book,
      onclick: () => {
        viewlogic.openWebsite('documentation');
      },
      id: 'doc',
    },
    {
      ...texts.bugreport,
      icon: Bug,
      onclick: () => {
        viewlogic.openWebsite('bug-report');
      },
    },
  ];

  const docShortcuts: LinkItem[] = [
    {
      title: texts.links.doc.getStarted,
      onclick: () => {
        viewlogic.openUrl(
          'https://doc.qt.io/vscodeext/vscodeext-getting-started.html'
        )
      }
    },
    {
      title: texts.links.doc.tutorial,
      onclick: () => {
        viewlogic.openUrl(
          'https://doc.qt.io/vscodeext/vscodeext-tutorials.html'
        )
      }
    },
    {
      title: texts.links.doc.howto,
      onclick: () => {
        viewlogic.openUrl(
          'https://doc.qt.io/vscodeext/vscodeext-how-tos.html'
        )
      }
    }
  ]

  const qtitems: LinkItem[] = [
    {
      title: texts.links.qt.download,
      onclick: () => {
        viewlogic.openWebsite('qt-download');
      },
    },
    {
      title: texts.links.qt.academy,
      onclick: () => {
        viewlogic.openWebview('courses');
      },
    },
    {
      title: texts.links.qt.documentation,
      onclick: () => {
        viewlogic.openWebsite('qt-docs');
      },
    },
    {
      title: texts.links.qt.python,
      onclick: () => {
        viewlogic.openWebsite('qtforpython-doc');
      },
    }
  ];

</script>

<Column class='w-full gap-3'>
  {#each items as item, i (i)}
    {@render ItemSection(item)}
  {/each}
  <div class='flex flex-row ml-auto mt-1'>
    {@render Links(qtitems)}
  </div>
</Column>

<!-- snippets -->
{#snippet ItemSection(item: Item)}
  {@const Icon = item.icon}

  <button
    class='
      hover:cursor-pointer hover:-translate-x-1 hover:drop-shadow-sm
      hover:shadow-[-10px_0_0_0_var(--qt-active-color)]
      duration-100 ease-out drop-shadow-black
    '
    onclick={item.onclick}
  >
    <Row class='qt-panel w-full px-6 py-2 text-left gap-4'>
      {#if Icon}
        <Icon class='medium qt-label bright self-center !shrink-0'/>
      {/if}
      <Column class='!gap-0 grow'>
        <p class='qt-label'>{item.title ?? ''}</p>
        <p class='qt-label dimmed'>{item.description ?? ''}</p>
      </Column>

      {#if item.id === 'doc'}
        {@render Links(docShortcuts)}
      {/if}
    </Row>
  </button>
{/snippet}

{#snippet Links(items: Item[])}
  <Row class='self-end items-center leading-none'>
    {#each items as item, i (i)}
      {#if i !== 0}
        <p class='qt-label dimmed'>|</p>
      {/if}

      <button
        class='qt-label link hover:cursor-pointer'
        onclick={(e: MouseEvent) => {
          item.onclick?.();
          e.stopPropagation();
        }}
      >
        {item.title}
      </button>
    {/each}
  </Row>
{/snippet}
