// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import * as d3 from 'd3';

import { qmltrace as texts } from '@/apps/texts';
import { vscode } from '@/apps/vscode';
import { CommandId, type CommandReply } from '@shared/message';
import { type FlameGraphKind } from '@shared/qml-trace';
import { data, ui } from './states.svelte';
import * as color from './helpers/color';
import type {
  FlameNode,
  FlameGraph,
  FlameD3Node,
  FlameD3RenderNode,
  ViewChange
 } from './types.svelte';

let onChangedCallback = (_: ViewChange) => {}

export function onChanged(fn: (_: ViewChange) => void) {
  onChangedCallback = fn;
}

export async function onAppMount() {
  const task = async () => {
    vscode.onDidReceiveNotification(onVscodeNotified);
    updateConfigs();
    updateColorPalette();
    setAllFeaturesEnabled(true);

    await vscode.post(CommandId.UiCheckIfQtcliReady);
    await vscode.post(CommandId.QmlTraceLoadFile);
  };

  await ui.task.run(task);
  await getFlameGraph('time');
}

export async function onResized() {
  onChangedCallback('resize');
}

export async function setConfigsAndReload(allDirs: string) {
  const additionalDirs: string[] = [];

  allDirs.split('\n').forEach(e => {
    const s = e.trim();
    if ((s.length !== 0) && (additionalDirs.indexOf(s) < 0)) {
      additionalDirs.push(s);
    }
  });

  await vscode.post(CommandId.QmlTraceSetConfigs, { additionalDirs });
  await updateConfigs();
}

export async function getFlameGraph(kind: FlameGraphKind) {
  const task = async () => {
    if (ui.kind !== kind) {
      ui.kind = kind;
      setFlameGraphData(undefined);
    }

    const r = await vscode.post(CommandId.QmlTraceGetFlameGraph, {
      kind: ui.kind,
      features: Array.from(ui.features.enabled).join(',')
    });

    const graph = r as FlameGraph;
    setFlameGraphData(graph);
  };

  await ui.task.run(task, { debounceTime_ms: 1_000 });
}

export async function openSourceLocation(sourceLocation: string) {
  // expected format: qrc:/content/NodeIndicator.qml#L39,38
  if (sourceLocation.length !== 0) {
    await vscode.post(
      CommandId.QmlTraceOpenSourceFile, { sourceLocation }
    );
  }
}

export async function openFileInTextEditor() {
  await vscode.post(CommandId.QmlTraceOpenFileInTextEditor);
}

export async function openDataAsJsonc() {
  await vscode.post(CommandId.QmlTraceOpenFlameGraphData, {
    json: JSON.stringify(data.flame, undefined, 2),
  });
}

export function onMouseEvent(ev: MouseEvent) {
  const target = ev.target as HTMLElement | SVGElement;
  const node = (target.tagName === 'rect')
    ? d3.select<SVGElement, FlameD3RenderNode>(target as SVGElement).datum()
    : undefined;

  switch (ev.type) {
    case 'click':
      if (node) {
        ui.render.context = 'interaction';
        openSourceLocation(node.data.sourceLocation);
      }

      setSelectedNode(node);
      break;

    case 'dblclick':
      if (node && node._merged) {
        return;
      }

      ui.render.context = 'interaction';
      setBaseNode(node ?? ui.root);
      break;

    case 'mousemove':
      setHoveredNode(node);
      break;

    case 'mouseleave':
      setHoveredNode(undefined);
      break;

    default:
      return;
  }

  ev.stopPropagation();
}

export function onKeyDownEvent(ev: KeyboardEvent) {
  switch (ev.key) {
    case "Escape":
      zoomTo('full');
      ev.preventDefault();
      break;

    case "Enter":
      zoomTo('selected');
      ev.preventDefault();
      break;

    case "Backspace":
      zoomTo('parent');
      ev.preventDefault();
      break;

    case " ":
      openSourceLocation(ui.selected?.data.sourceLocation ?? '');
      ev.preventDefault();
      break;
  }
}

export function setHighlightedFeature(cat: string | undefined) {
  if (ui.features.highlighted !== cat) {
    ui.features.highlighted = cat;
    onChangedCallback('highlighted');
  }
}

export function setFeatureEnabled(feature: string, enable: boolean) {
  const n = feature.toLowerCase().trim();

  if (n.length !== 0 && enable !== ui.features.enabled.has(n)) {
    const modified = new Set(ui.features.enabled);
    if (enable) {
      modified.add(n);
    } else {
      modified.delete(n);
    }

    setFeatures(modified);
  }
}

export function setAllFeaturesEnabled(enable: boolean) {
  const all = enable
    ? texts.featureNames.map(([feature, _]) => feature)
    : [];

  setFeatures(new Set<string>(all));
}

export function findFeatureLabel(feature: string): string {
  const c = feature.toLowerCase().trim();
  const found = texts.featureNames.find(([cat, _]) => cat === c);
  return found ? found[1] : feature;
}

export function zoomTo(target: "selected" | "parent" | "full") {
  switch (target) {
  case 'selected':
    ui.render.context = 'interaction';
    setBaseNode(ui.selected);
    break;

  case 'parent': {
    const parent = ui.base?.parent;
    if (parent) {
      ui.render.context = 'interaction';
      setBaseNode(parent);
    }
    break;
  }

  case 'full':
    if (ui.base && ui.base?.depth !== 0) {
      ui.render.context = 'interaction';
      setBaseNode(ui.root);
    }
  }
}

export async function getFoldersToAdd(source: 'dialog' | 'workspaces') {
  let reply: unknown;

  if (source === 'dialog') {
    const timeout = -1;
    reply = await vscode.post(
      CommandId.QmlTraceSelectFolder,
      undefined,
      timeout
    );
  } else {
    reply = await vscode.post(CommandId.QmlTraceGetWorkspaceFolders);
  }

  if (reply) {
    const f = _.get(reply, 'folders', []) as string[];
    const ok = Array.isArray(f) && f.every((e) => (typeof e === 'string'));
    return ok ? f : [];
  }

  return [];
}

export function invalidateSelection() {
  if (ui.selected) {
    setSelectedNode(ui.render.nodes.find((n) => {
      return (n.data.key === ui.selected?.data.key)
    }));
  }
}

// helpers
function setFlameGraphData(flame: FlameGraph | undefined) {
  data.flame = flame;

  ui.root =
    data.flame
    && d3.hierarchy(data.flame.root, (d: FlameNode) => d.children);

  ui.base = ui.root;
  ui.hovered = undefined;
  ui.selected = undefined;

  onChangedCallback('data');
}

function setBaseNode(node: FlameD3Node | undefined) {
  if (ui.base !== node) {
    ui.base = node;
    onChangedCallback('base');
  }
}

function setSelectedNode(node: FlameD3RenderNode | undefined) {
  if (ui.selected !== node) {
    ui.selected = node;
    onChangedCallback('selected');
  }
}

function setHoveredNode(node: FlameD3RenderNode | undefined) {
  if (ui.hovered !== node) {
    ui.hovered = node;
    onChangedCallback('hovered');
  }
}

function setFeatures(features: typeof ui.features.enabled) {
  if (!containsSameStrings(ui.features.enabled, features)) {
    ui.features.enabled = features;
    onChangedCallback('features');
  }
}

async function onVscodeNotified(reply: CommandReply) {
  if (reply.id === CommandId.CommonVscodeThemeChanged) {
    updateColorPalette();
    onChangedCallback('theme');
  }
}

function updateColorPalette() {
  const css = getComputedStyle(document.body);
  ui.palette = color.createPaletteFromCss(css);
}

async function updateConfigs() {
  const r = await vscode.post(CommandId.QmlTraceGetConfigs);

  data.configs = {
    filePath: _.get(r, 'filePath', data.configs.filePath),
    additionalDirs: _.get(r, 'additionalDirs', data.configs.additionalDirs)
  }
}

function containsSameStrings(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const val of a) {
    if (!b.has(val)) {
      return false;
    }
  }

  return true;
}
