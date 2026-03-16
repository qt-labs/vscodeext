<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import SectionLabel from '@/comps/SectionLabel.svelte';
  import NewItemForm from '@/comps/NewItemForm.svelte';
  import * as texts from '@/apps/texts';
  import { data, input } from './states.svelte';
</script>

<div class="w-full flex flex-col items-center gap-2">
  <SectionLabel text={texts.wizard.nameAndLocation} />
  <NewItemForm
    controller={input}
    selectedType={data.selected.type}
    fieldNameClass='pl-3'
  />
</div>
