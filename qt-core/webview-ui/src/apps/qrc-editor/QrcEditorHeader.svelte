<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import {
    Trash2,
    FilePlus,
    FolderPlus,
    ArrowDownAZ,
    ExternalLink,
    ChevronsDown,
    BrushCleaning
  } from '@lucide/svelte';

  import * as texts from '@/apps/texts';
  import IconButton from '@/comps/IconButton.svelte';
  import { data, ui } from './states.svelte';
  import * as viewlogic from './viewlogic.svelte';

  let empty = $derived(data.groups.length === 0);
  let hasOpenedGroup = $derived.by(() => {
    for (const g of data.groups) {
      if (g.opened) {
        return true;
      }
    }

    return false;
  })
</script>

<div class="w-full mt-2 flex flex-row items-center gap-2">
   <IconButton
    icon={FolderPlus}
    text={texts.qrc.buttons.addGroup}
    tooltip={texts.qrc.tooltips.addGroup}
    tooltipPlacement='bottom-start'
    onClicked={viewlogic.addNewGroup}
  />

  <IconButton
    icon={FilePlus}
    text={texts.qrc.buttons.addFiles}
    tooltip={texts.qrc.tooltips.addFiles}
    tooltipPlacement='bottom'
    disabled={empty}
    onClicked={viewlogic.addFilesFromDialog}
  />

  <IconButton
    icon={Trash2}
    text={texts.qrc.buttons.delete}
    tooltip={texts.qrc.tooltips.delete}
    tooltipPlacement='bottom'
    disabled={empty}
    onClicked={viewlogic.removeCurrent}
  />

  <div class="grow"></div>

  <IconButton flat square class="w-1"
    icon={ChevronsDown}
    iconClass={`
      transition-transform duration-200
      ${hasOpenedGroup ? 'rotate-180' : ''}
    `}
    tooltip={texts.qrc.tooltips.expandCollaps}
    tooltipPlacement='bottom-end'
    disabled={empty}
    onClicked={() => viewlogic.setAllGroupsOpened(!hasOpenedGroup)}
  />

  <IconButton flat square class="w-1"
    icon={ArrowDownAZ}
    tooltip={texts.qrc.tooltips.sort}
    tooltipPlacement='bottom-end'
    disabled={empty}
    onClicked={viewlogic.sortAll}
  />

  <IconButton flat square class="w-1"
    icon={BrushCleaning}
    tooltip={texts.qrc.tooltips.clean}
    tooltipPlacement="bottom-end"
    disabled={empty}
    onClicked={viewlogic.clean}
  />

  <IconButton flat square class="w-1"
    icon={ExternalLink}
    tooltip={texts.qrc.tooltips.openInTextEditor}
    tooltipPlacement='bottom-end'
    onClicked={() => viewlogic.runVscodeUiAction('openQrcInTextEditor')}
  />
</div>
