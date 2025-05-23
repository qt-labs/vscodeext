<!--
Copyright (C) 2025 The Qt Company Ltd.
SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only 
-->

<script lang="ts">
  import {
    P,
    Table,
    TableBody,
    TableBodyRow,
    TableBodyCell
  } from 'flowbite-svelte';

  import { data } from './states.svelte';

  const steps = $derived(data.selected.preset?.prompt?.steps);
  const toDisplayValue = (value: unknown) => {
    if (typeof value === 'string' && value.length === 0) {
      return '-';
    } else if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return value;
  };
</script>

{#if steps}
  <Table color="custom" class="qt-simple-table">
    <TableBody>
      {#each steps as step (step.id)}
        <TableBodyRow class="last:border-0">
          <TableBodyCell class="p-0.5">
            <P class="qt-label">{step.question}</P>
          </TableBodyCell>
          <TableBodyCell class="p-0.5">
            <P class="qt-label">{toDisplayValue(step.default)}</P>
          </TableBodyCell>
        </TableBodyRow>
      {/each}
    </TableBody>
  </Table>
{/if}
