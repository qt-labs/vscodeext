// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as d3 from 'd3';

export interface FlameNode {
  key: number;
  eventId: number;
  depth: number;
  offset: number;
  length: number;

  label: string;
  details: string;
  feature: string;
  sourceLocation: string;

  calls: number;
  duration: number;
  amount: number;
  allocations: number;

  children?: FlameNode[];
}

export interface FlameGraphMetadata {
	kind: string;
	height: number;
  stats: Record<string, number>;
}

export interface FlameGraph {
  root: FlameNode;
  metadata: FlameGraphMetadata;
}

export type FlameD3Node = d3.HierarchyNode<FlameNode>

export interface FlameD3RenderNode extends FlameD3Node {
  _x: number;
  _y: number;
  _width: number;
  _active: boolean;
  _merged: boolean;
}

export type RenderContext = 'general' | 'interaction';
export type ViewChange = 'data' | 'base' | 'selected' | 'hovered' | 'highlighted' | 'features' | 'resize' | 'theme';
export type CellState = 'normal' | 'selected' | 'hovered' | 'highlighted';

export type ScaleX = d3.ScaleLinear<number, number, never>
export type ScaleY = d3.ScaleLinear<number, number, never>;
export type ScaleColor = d3.ScaleLinear<string, string, never>;

export interface ColorSet {
  foreground: string;
  background: string;
}

export interface FlameCellPalette {
  normal: {
    foreground: string;
    backgrounds: string[];
  },

  hover: ColorSet;
  selected: ColorSet;
  highlighted: ColorSet;
}

export interface FlamePalette {
  active: FlameCellPalette;
  inactive: FlameCellPalette;
  scaleBar: {
    foreground: string;
  }
}
