<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { FolderOpenOutline, FileOutline } from 'flowbite-svelte-icons';

  import VerticalTabs from '@/comps/VerticalTabs.svelte';
  import { wizard } from '@/apps/texts';
  import { setPresetType } from './viewlogic.svelte';

  const items = [
    { label: wizard.types.project, icon: FolderOpenOutline, data: 'project' },
    { label: wizard.types.file, icon: FileOutline, data: 'file' }
  ];

  function onCurrentIndexChanged(i: number) {
    if (i >= 0 && i < items.length) {
      setPresetType(items[i].data);
    }
  }
</script>

<VerticalTabs {items} {onCurrentIndexChanged} buttonClass="p-3" />
