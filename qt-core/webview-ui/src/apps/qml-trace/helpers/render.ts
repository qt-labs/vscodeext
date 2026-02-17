// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as d3 from 'd3';

import { qmltrace as texts } from '@/apps/texts';
import type {
  ScaleX,
  CellState,
  FlameNode,
  FlameD3RenderNode
} from '../types.svelte';
import * as format from './format';
import * as viewlogic from '../viewlogic.svelte';
import { ui, data } from '../states.svelte';
import { updateScales } from './scales';
import { updateRenderNodes, findTargetNodes, isEmpty } from './nodes';

type Cells = d3.Transition<SVGGElement, FlameD3RenderNode, d3.BaseType, unknown>;

export function prepare(treeHeight: number) {
  updateCellHeight(treeHeight);
  updateScales(treeHeight);
  updateRenderNodes();

  viewlogic.invalidateSelection();
}

export function drawCells(state: CellState, groupSelector: string) {
  if (isEmpty(state)) {
    d3.select(groupSelector).selectAll("*").remove();
    return;
  }

  const data = findTargetNodes(state);
  const transition = d3.transition().duration(getAniDuration(state));

  const cells = d3
    .select(groupSelector)
    .selectAll<SVGGElement, FlameD3RenderNode>('g.d3-cell')
    .data(data, (n) => n.data.key)
    .join(
      (enter) => {
        const xs = ui.prevStates.xscale || ui.render.scales.x;
        return enter
          .append('g')
          .attr('class', 'd3-cell')
          .attr('transform', (n) => `translate(${xs(n.data.offset)}, ${n._y})`)
          .each(function(n) {
            const g = d3.select(this);
            const w = calcWidth(n.data, xs);
            const h = ui.render.cellHeight;

            g.append('rect')
              .attr('class', 'd3-rect')
              .attr('width', w)
              .attr('height', h)

            g.append('foreignObject')
              .attr('class', 'd3-label')
              .attr('width', w)
              .attr('height', h)
          });
      },
      (update) => update,
      (exit) => {
        const xs = ui.render.scales.x;
        exit.each(function(n) {
          const g = d3.select(this);
          const w = calcWidth(n.data, ui.render.scales.x);

          g.select('.d3-rect').transition(transition).attr('width', w);
          g.select('.d3-label').transition(transition).attr('width', w);
        });

        return exit
          .transition(transition)
          .attr('transform', (n) => `translate(${xs(n.data.offset)}, ${n._y})`)
          .remove();
      }
    )
    .transition(transition)
    .attr('transform', (n) => `translate(${n._x}, ${n._y})`);

  updateCellRects(cells, state);
  updateCellLabels(cells, state);
}

export function drawScaleBar() {
  const svg = d3.select('.svg-flame-graph');
  if (!svg) {
    return;
  }

  let g = svg.select<SVGGElement>('g.d3-scale-bar');
  if (g.empty()) {
    g = svg
      .append('g')
      .attr('class', 'd3-scale-bar');
  }

  g.selectAll('*').remove();
  if (!data.flame || (data.flame?.metadata.height <= 0)) {
    return;
  }

  // calculate nice number for the scale bar
  const pixels = 100;
  const start = ui.render.scales.x.invert(0);
  const end = ui.render.scales.x.invert(pixels);
  const scaler = ui.kind === 'memory' ? 1_024 : 1;
  const ticks = d3.ticks(start/scaler, end/scaler, 5);

  const niceStart = ticks[0];
  const niceEnd = ticks[ticks.length - 1];
  const niceValue = (niceEnd - niceStart) * scaler;
  const niceValueAsPixels =
    ui.render.scales.x(niceEnd * scaler) - ui.render.scales.x(niceStart * scaler);

  // adjust the position of the scale bar
  const svgRect = (svg.node() as SVGSVGElement).getBoundingClientRect();
  const svgMinHeight = ((data.flame?.metadata.height ?? 0) + 1) * ui.render.cellHeight;

  const margin = { right: 15, bottom: 15 };
  const x = svgRect.width - niceValueAsPixels - margin.right;
  const y = svgMinHeight - margin.bottom;

  g.attr('transform', `translate(${x}, ${y})`);

  g.append("rect")
      .attr("width", niceValueAsPixels)
      .attr("height", 8)
      .attr("fill", ui.palette.scaleBar.foreground);

  g.append("text")
      .attr("x", niceValueAsPixels / 2)
      .attr("y", -5)
      .attr("fill", ui.palette.scaleBar.foreground)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text(format.formatByType(niceValue, ui.kind));
}

// helers
function updateCellRects(cells: Cells, state: CellState) {
  cells.select('.d3-rect')
    .attr('width', n => n._width)
    .attr('height', ui.render.cellHeight)
    .attr('stroke', '#aaaaaa')
    .attr('fill', (n) => {
      const t = n._active ? ui.palette.active : ui.palette.inactive;

      if (state === 'selected') {
        return t.selected.background;
      } else if (state === 'hovered') {
        return t.hover.background;
      } else if (state === 'highlighted') {
        return t.highlighted.background;
      } else {
        return n._active
          ? ui.render.scales.activeColor(n.data.depth)
          : ui.render.scales.inactiveColor(n.data.depth);
      }
    })
    .attr('opacity', (n) => n._active ? 1.0 : 0.8)
}

function updateCellLabels(cells: Cells, state: CellState) {
  cells.select('.d3-label')
    .attr('width', n => n._width)
    .attr('height', ui.render.cellHeight)
    .style('line-height', `${ui.render.cellHeight}px`)
    .style('display', n => n._width < 20 ? 'none' : 'block')
    .style('color', (n) => {
      const t = n._active ? ui.palette.active : ui.palette.inactive;

      if (state === 'selected') {
        return t.selected.foreground;
      } else if (state === 'hovered') {
        return t.hover.foreground;
      } else if (state === 'highlighted') {
        return t.highlighted.foreground;
      } else {
        return t.normal.foreground;
      }
    })
    .style('padding-left', n => {
      const offset = n._x < 0 ? Math.max(0, -n._x) : 0;
      return `${offset + 3}px`;
    })
    .text((n) => {
      return formatLabel(n, ui.base?.data)
    });
}

function updateCellHeight(treeHeight: number) {
  const exact = ui.render.area.height / Math.max(1, treeHeight + 1);
  const candidate = Math.max(30, Math.min(exact, 45));

  ui.render.cellHeight = candidate;
}

function getAniDuration(state: CellState) {
  return (state === 'normal' && (ui.render.context === 'interaction'))
    ? 250 : 0;
}

function calcWidth(node: FlameNode, scale: ScaleX) {
  return Math.max(0, scale(node.length) - scale(0));
}

function formatLabel(n: FlameD3RenderNode, base: FlameNode | undefined) {
  if (n._merged) {
    return '';
  }

  const full = base?.length ?? 1;
  const current = n.data.length;

  const prefix = (base && (n.depth < base.depth)) ? "\u2026 " : '';
  const text = (n.depth === 0)
    ? texts.rootLabel
    : (n.data.details || n.data.label || '-');
  const info = [
    (n.depth === 0) ? '' : (n.data.feature || '-'),
    format.formatByType(current, ui.kind),
    (n._active) ? format.percent(current, full) : ''
  ]

  return `${prefix}${text} (${info.filter(v => (v.length > 0)).join(', ')})`;
}
