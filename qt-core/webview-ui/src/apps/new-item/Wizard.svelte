<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import * as texts from '@/apps/texts';
  import LoadingMask from '@/comps/LoadingMask.svelte';
  import { ui } from './states.svelte';
  import { onModalClosed } from './viewlogic.svelte';
  import WizardAllDialogs from './WizardAllDialogs.svelte';
  import WizardSectionInput from './WizardSectionInput.svelte';
  import WizardSectionPresets from './WizardSectionPresets.svelte';
</script>

<div
  class="qt-panel w-[80vw] h-[90vh] min-w-[500px] min-h-[500px] flex flex-col"
  on:close={onModalClosed}
>
  <div class="border-b p-4">
    <div class="qt-panel-header">
      {texts.wizard.title}
    </div>
  </div>

  <div class="w-full h-full flex flex-col gap-4 p-4">
    <WizardSectionPresets />
    <WizardSectionInput />
    <LoadingMask
      {...ui.loading}
      busyText={texts.loading.busy}
      closeText={texts.loading.close}
    />
    <WizardAllDialogs />
  </div>
</div>
