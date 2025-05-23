<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import { Modal } from 'flowbite-svelte';

  import * as texts from './texts';
  import { ui } from './states.svelte';
  import { onModalClosed } from './viewlogic.svelte';
  import LoadingMask from '@/comps/LoadingMask.svelte';
  import WizardSectionInput from './WizardSectionInput.svelte';
  import WizardSectionPresets from './WizardSectionPresets.svelte';
</script>

<Modal
  open
  size="lg"
  color="none"
  class="qt-modal w-[80vw] h-[90vh] min-w-[500px] min-h-[500px]"
  backdropClass="hidden"
  on:close={onModalClosed}
>
  <svelte:fragment slot="header">
    <div class="qt-modal-title">
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
  </div>
</Modal>
