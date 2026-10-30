<!--
Copyright (C) 2026 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { fly } from 'svelte/transition';
  import { tooltip } from '@/utils/actions';
  import './DocViewerToolbar.css';

  import { ui } from '../states.svelte';
  import * as helpers from '../helpers';
  import * as viewlogic from '../viewlogic.svelte';
  import * as toolbar from './DocViewerToolbar';

  const value = $derived(
    ui.iframe.errorCode ? '' : ui.iframe.title
  );
  const bookmarked = $derived(viewlogic.bookmark.has(
    helpers.toFileUriIfServer(ui.iframe.uri)
  ));
</script>

<div data-area='toolbar' class='flex flex-row gap-2'>
  <div class='flex flex-row gap-0'>
    {@render actionButton('back')}
    {@render actionButton('forward')}
  </div>

  {@render titleSection()}
  {@render actionButton('openInNewViewer')}

  <div class='flex flex-row'>
    {@render actionButton('bookmarkView')}
    {@render actionButton('historyView')}
  </div>
</div>

<!-- snippets -->
{#snippet titleSection()}
  {@const hash = helpers.extractHash(ui.iframe.uri)}

  <div
    bind:this={ui.popovers.navigation.refEl}
    data-role='title-section'
    class='grow flex flex-row justify-around relative'
  >
    {#if ui.iframe.errorCode.length === 0}
      {@render actionButton('openInFileManager')}
      <button
        class='w-full flex flex-row items-center justify-center gap-2'
        onclick={() => {
          ui.popovers.navigation.toggle();
        }}
      >
        {@render titleSectionText(value)}
        {@render titleSectionHash(hash)}
      </button>
    {/if}

    <div class='qt-absolute-cy right-[4px] flex flex-row'>
      {@render actionButton('showFindInPage')}
      {@render actionButton('toggleBookmark')}
    </div>
  </div>
{/snippet}

{#snippet titleSectionText(text: string)}
  <span data-role='title'>{text}</span>
{/snippet}

{#snippet titleSectionHash(hash: string)}
  {#if hash.length !== 0}
    <button
      use:tooltip={{ text: 'Clear hash and go to top' }}
      in:fly={{ y: -20, duration: 150 }}
      data-role='hash'
      onclick={() => {
        viewlogic.openDoc(helpers.removeHash(ui.iframe.uri));
      }}
    >
      {hash}
    </button>
  {/if}
{/snippet}

{#snippet actionButton(action: toolbar.Action)}
  {@const Icon = toolbar.findIcon(action)}
  {@const enabled = toolbar.isEnabled(action)}
  {@const needToFill = bookmarked && (action === 'toggleBookmark')}

  <button
    bind:this={
      () => null,
      (el) => {
        if (action === 'showFindInPage') {
          ui.popovers.find.refEl = el;
        }
      }
    }
    use:tooltip={{
      text: toolbar.tooltip(action),
      placement: 'bottom',
      offset: 10
    }}
    data-role={action}
    aria-pressed={toolbar.isChecked(action)}
    class='qt-button flex items-center justify-center'
    disabled={!enabled}
    onclick={(e: MouseEvent) => {
      toolbar.onClicked(action);
      e.stopPropagation();
    }}
  >
    <Icon fill={needToFill ? 'currentColor' : 'transparent'} />
  </button>
{/snippet}
