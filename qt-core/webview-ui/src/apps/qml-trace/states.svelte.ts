// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as d3 from 'd3';

import { type FlameGraphKind } from '@shared/qml-trace';
import { TaskBusyRunner } from '@/comps/TaskBusyRunner.svelte';
import type {
  RenderContext,
  FlameD3Node,
  FlameD3RenderNode,
  ScaleX,
  ScaleY,
  ScaleColor,
  FlamePalette,
  FlameGraph
} from "./types.svelte"

export const data = $state({
  flame: undefined as (FlameGraph | undefined),
  configs: {
    filePath: "",
    additionalDirs: [] as string[]
  }
})

export const ui = $state({
  kind: 'time' as FlameGraphKind,
  root: undefined as FlameD3Node | undefined,
  base: undefined as FlameD3Node | undefined,
  hovered: undefined as FlameD3RenderNode | undefined,
  selected: undefined as FlameD3RenderNode | undefined,

  features: {
    enabled: new Set<string>(),
    highlighted: undefined as string | undefined,
  },

  render: {
    context: 'general' as RenderContext,
    nodes: [] as FlameD3RenderNode[],
    area: {
      width: 100,
      height: 100
    },
    cellHeight: 20 as number,
    scales: {
      x: d3.scaleLinear() as ScaleX,
      y: d3.scaleLinear() as ScaleY,
      activeColor: d3.scaleLinear() as ScaleColor,
      inactiveColor: d3.scaleLinear() as ScaleColor,
      x0: 0,
    },
  },

  prevStates: {
    xscale: d3.scaleLinear() as (ScaleX | undefined),
  },

  palette: {} as FlamePalette,

  overlays: {
    features: {
      visible: false,
      collapsed: false,
    },
    details: {
      collapsed: false,
      alignLeft: false,
    },
    config: {
      visible: false
    }
  },

  task: new TaskBusyRunner(),
})
