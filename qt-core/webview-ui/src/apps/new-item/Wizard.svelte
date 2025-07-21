<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only
-->

<script lang="ts">
  import { Modal } from 'flowbite-svelte';

  import * as texts from '@/apps/texts';
  import LoadingMask from '@/comps/LoadingMask.svelte';
  import { ui } from './states.svelte';
  import { onModalClosed } from './viewlogic.svelte';
  import WizardAllDialogs from './WizardAllDialogs.svelte';
  import WizardSectionInput from './WizardSectionInput.svelte';
  import WizardSectionPresets from './WizardSectionPresets.svelte';
</script>

<Modal
  open
  dismissable={false}
  size="lg"
  color="none"
  class="qt-panel w-[80vw] h-[90vh] min-w-[500px] min-h-[500px]"
  backdropClass="hidden"
  on:close={onModalClosed}
>
  <svelte:fragment slot="header">
    <div class="qt-panel-header">
      {texts.wizard.title}
    </div>
  </svelte:fragment>

  <div class="w-full h-full flex flex-col gap-4">
    <WizardSectionPresets />
    <WizardSectionInput />
    <LoadingMask
      {...ui.loading}
      busyText={texts.loading.busy}
      closeText={texts.loading.close}
    />
    <WizardAllDialogs />
  </div>
</Modal>
