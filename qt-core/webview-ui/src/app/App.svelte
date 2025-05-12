<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import './app.css';
  import { Button } from 'flowbite-svelte';
  import * as viewlogic from './viewlogic.svelte';
</script>

<div class="h-screen w-screen flex items-center justify-center">
  <Button
    size="lg"
    color="green"
    onclick={viewlogic.onCloseClicked}>
    Close
  </Button>
</div>