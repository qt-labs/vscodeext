// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import type {
  CellState,
  FlameNode,
  FlameD3Node,
  FlameD3RenderNode
} from '../types.svelte';
import { ui, data } from '../states.svelte';

export function updateRenderNodes() {
  ui.render.nodes = [];

  if (ui.base) {
    ui.base.ancestors().slice(1).forEach((n) => {
      ui.render.nodes.push(createRenderNode(n));
    });

    addNode(createRenderNode(ui.base));
  }
}

export function findTargetNodes(state: CellState) {
  switch (state) {
    case 'normal': return ui.render.nodes;
    case 'selected': return (ui.selected ? [ui.selected] : []);
    case 'hovered':
      return ui.render.nodes.filter((n) => {
        return (n.data.eventId === ui.hovered?.data.eventId) && !n._merged;
      })
    case 'highlighted':
      return ui.render.nodes.filter((n) => {
        return (n.data.depth !== 0)
          && (n.data.feature.toLowerCase() === ui.features.highlighted)
      })
  }
}

export function isEmpty(state: CellState) {
  switch (state) {
    case 'normal': return (!data.flame || data.flame.metadata.height < 1 || ui.base?.data === undefined);
    case 'selected': return (ui.selected === undefined);
    case 'hovered': return (ui.hovered === undefined);
    case 'highlighted': return (ui.features.highlighted === undefined);
  }
}

// helpers
function addNode(node: FlameD3RenderNode) {
  ui.render.nodes.push(node);

  let offset = node._x;
  const narrow: FlameD3Node[] = [];

  node.children?.forEach((n) => {
    if (isNarrow(n.data)) {
      narrow.push(n);
      return;
    }

    const r = Object.assign(createRenderNode(n), { _x : offset });
    offset += r._width;

    addNode(r);
  })

  addSkippedNodes(narrow, offset);
}

function addSkippedNodes(narrowNodes: FlameD3Node[], offset: number) {
  if (narrowNodes.length < 1) {
    return;
  }

  const first = createRenderNode(narrowNodes[0]);
  const length = narrowNodes.reduce((s, n) => s + n.data.length, 0);

  first._x = offset;
  first._width = ui.render.scales.x(length) - ui.render.scales.x0;
  first._merged = true;
  first._active = false;

  ui.render.nodes.push(first);
}

function isNarrow(n: FlameNode) {
  const width = ui.render.scales.x(n.length) - ui.render.scales.x0;
  if (width < 2) {
    return true;
  }

  const threshold = 0.002;
  const baseLength = ui.base?.data.length ?? 1;
  return ((n.length / baseLength) < threshold)
}

function createRenderNode(n: FlameD3Node): FlameD3RenderNode {
  const d = n.data;
  const baseDepth = ui.base?.data.depth ?? 0;

  const _x = ui.render.scales.x(d.offset);
  const _y = ui.render.scales.y(d.depth);
  const _width = Math.max(0, ui.render.scales.x(d.length) - ui.render.scales.x0);
  const _active = (d.depth !== 0) && ((baseDepth <= d.depth) || (baseDepth == 0));
  const _merged = false;

  return Object.assign(n, { _x, _y, _width, _active, _merged });
}

