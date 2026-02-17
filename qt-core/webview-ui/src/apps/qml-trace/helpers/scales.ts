// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as d3 from 'd3';

import type { FlameNode } from '../types.svelte';
import { ui } from '../states.svelte';

export function updateScales(treeHeight: number) {
  const x = createXScale(ui.base?.data);

  ui.render.scales = {
    x,
    x0: x(0),
    y: createYScale(ui.render.cellHeight, treeHeight),
    activeColor: createColorScale(treeHeight, ui.palette.active.normal.backgrounds),
    inactiveColor: createColorScale(treeHeight, ui.palette.inactive.normal.backgrounds)
  };
}

function createXScale(base: FlameNode | undefined) {
  const start = base?.offset ?? 0;
  const length = base?.length ?? 1;

  return d3
    .scaleLinear()
    .domain([start, start + length])
    .range([0, ui.render.area.width])
}

function createYScale(barHeight: number, treeHeight: number) {
  return d3
    .scaleLinear()
    .domain([0, treeHeight])
    .range([treeHeight * barHeight, 0])
}

function createColorScale(treeHeight: number, colors: string[]) {
  return d3
    .scaleLinear<string>()
    .domain([0, treeHeight])
    .range(colors)
    .interpolate(d3.interpolateRgb);
}
