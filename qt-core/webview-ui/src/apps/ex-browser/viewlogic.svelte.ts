// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import { vscode } from '@/apps/vscode';
import {
  TagPrefix,
  type ExEntry,
  type ExPackage,
  type ExCategory,
  type ExActionTypes,
  type ExNewProjectArgs,
  isExEntry,
  isExPackage,
  isExCategoryArray,
  isExBrowserViewConfig,
  isExResolvedPathsRecord
} from "@shared/ex-browser";
import * as NewItemForm from '@/comps/NewItemForm.logic.svelte';
import { CommandId, isErrorResponse } from "@shared/message";
import { data, ui, type OverlayName } from './states.svelte';

export async function onAppMount() {
  ui.input.onEvent(onNewProjectFormEvent);
  ui.input.onValidate(validateNewProjectForm);
  ui.theme.monitor.start();

  await loadConfigs();
  await loadPackages();

  if (data.packages[0]) {
    await selectPackage(data.packages[0]);
  }
}

export async function onAppDestroy() {
  ui.theme.monitor.stop();
}

export async function selectPackage(p: ExPackage) {
  if (_.isEqual(ui.selected.package, p)) {
    return;
  }

  const r = await vscode.post(CommandId.ExBrowserSelectPackage, {
    package: $state.snapshot(p)
  });

  const categories = _.get(r, 'categories', []);
  const resolvedPaths = _.get(r, 'resolvedPaths', {});
  data.categories = isExCategoryArray(categories) ? categories : [];
  data.resolvedPaths =
    isExResolvedPathsRecord(resolvedPaths) ? resolvedPaths : {};

  ui.filter.query = '';
  ui.filter.category = findCategoryByName('all');
  ui.selected.package = p;
  ui.selected.example = undefined;
  ui.imageUrlCache.clear();

  if (ui.grid) {
    ui.grid.scrollTop = 0;
  }

  await loadExamples('selectPackage');
}

export async function selectCategory(category?: ExCategory | string) {
  const c = (typeof category === 'string')
    ? findCategoryByName(category)
    : category;

  if (!_.isEqual(ui.filter.category, c)) {
    ui.filter.category = c;
    await loadExamples();
  }
}

export async function selectExample(example: ExEntry | undefined) {
  ui.selected.example = example;
  ui.overlays.details.visible = (example !== undefined);
  ui.overlays.details.collapsed = false;
  ui.overlays.details.expanded = false;
}

export async function setQuery(q: string) {
  const v = validateQuery(q);

  if (ui.filter.query !== v) {
    ui.filter.query = v;
    await loadExamples();
  }
}

export async function toggleTagInQuery(tag: string) {
  const token = TagPrefix + tag;
  const q = !hasTagInQuery(tag)
    ? `${ui.filter.query} ${token}`
    : ui.filter.query.replace(token, '').trim();

  await setQuery(q);
}

export function hasTagInQuery(tag: string) {
  const token = TagPrefix + tag;
  return ui.filter.query
    .split(' ')
    .some(t => t.trim() === token);
}

export function setNewProjectFormVisible(visible: boolean) {
  if (ui.overlays.details.expanded === visible) {
    return;
  }

  ui.overlays.details.expanded = visible;
  if (visible) {
    ui.input.validate();
  }
}

export async function runExAction(action: ExActionTypes, args: object = {}) {
  if (!ui.selected.example) {
    return;
  }

  await vscode.post(CommandId.ExBrowserRunActionOnExample, {
    action,
    example: $state.snapshot(ui.selected.example),
    args
  });
}

export async function openFolder(folder: string) {
  await vscode.post(CommandId.CommonOpenFolder, { folder });
};

export async function resolveImageUrl(example: ExEntry) {
  const src = example.imageUrl;
  if (ui.imageUrlCache.has(src)) {
    return ui.imageUrlCache.get(src) ?? '';
  }

  const r = await vscode.post(CommandId.ExBrowserResolveImageUrl, {
    example: $state.snapshot(example)
  });

  const webviewUrl = String(_.get(r, 'webviewUrl', ''));
  if (webviewUrl.length === 0) {
    throw new Error(`Cannot get web view URL for: ${src}`);
  }

  ui.imageUrlCache.set(src, webviewUrl);
  return webviewUrl;
}

export function setOverlayVisible(name: OverlayName, visible: boolean) {
  const overlay = ui.overlays[name];
  if (!overlay || overlay.visible === visible) {
    return;
  }

  switch (name) {
    case 'catalog': {
      ui.overlays.tagCloud.visible = false;
      break;
    }

    case 'tagCloud': {
      const o = ui.overlays.tagCloud;
      if (visible && o.refRect) {
        const gap = 6;
        const r = o.refRect;
        o.position = `
          position: fixed;
          top: ${r.bottom + gap}px;
          left: ${r.left}px;
          width: 700px;
        `
        ui.overlays.catalog.visible = false;
      }
      break;
    }

    default:
      break;
  }

  overlay.visible = visible;
}

export async function onNewProjectFormEvent(type: NewItemForm.EventType, args?: unknown) {
  switch (type) {
    case 'inputChanged':
      validateNewProjectForm();
      break;

    case 'openInChanged':
      await vscode.post(CommandId.UiSaveOpenInPreference, String(args));
      break;

    case 'browseClicked':
      void vscode
        .post(CommandId.UiSelectWorkingDir, ui.input.states.workingDir, -1)
        .then((data) => {
          if (typeof data === 'string') {
            ui.input.states.workingDir = data;
            validateNewProjectForm();
          }
        })
      break;

    case 'createClicked':
      if (ui.selected.example) {
        await runExAction('project-create', {
          name: ui.input.states.name,
          workingDir: ui.input.states.workingDir,
          saveProjectDir: ui.input.states.saveProjectDir,
          openIn: String(ui.input.states.openIn)
        } as ExNewProjectArgs);

        ui.overlays.details.expanded = false;
      }
      break;
  }
}

export async function validateNewProjectForm() {
  const payload = {
    type: 'project',
    name: ui.input.states.name,
    workingDir: ui.input.states.workingDir,
  };

  try {
    await vscode.post(CommandId.UiValidateInputs, payload);
    ui.input.clearIssues();
  } catch (e) {
    ui.input.applyValidationResult(isErrorResponse(e) ? e : undefined);
  }
}

// helpers
async function loadConfigs() {
  const r = await vscode.post(CommandId.UiGetConfigs);
  if (isExBrowserViewConfig(r)) {
    const all = r.newProject;

    ui.input.states.name = all.name;
    ui.input.states.workingDir = all.workingDir;
    ui.input.states.saveProjectDir = all.saveProjectDir;
    ui.input.states.openIn = all.openIn;
  }
}

async function loadPackages() {
  const r = await vscode.post(CommandId.ExBrowserGetPackages);
  if (Array.isArray(r) && r.every(isExPackage)) {
    data.packages = r;
  }
}

async function loadExamples(reason: 'selectPackage' | '' = '') {
  const r = await vscode.post(CommandId.ExBrowserGetExamples, {
    query: ui.filter.query,
    category: $state.snapshot(ui.filter.category),
  });

  if (Array.isArray(r) && r.every(isExEntry)) {
    data.examples = r;
  }

  if (reason === 'selectPackage') {
    clearSelectedExample();
    return;
  }

  if (ui.selected.example) {
    const hit = data.examples.find(e => {
      return _.isEqual(ui.selected.example, e);
    });

    if (!hit) {
      clearSelectedExample();
    }
  }
}

function findCategoryByName(name: string) {
  return data.categories.find(c => {
    return c.name.toLocaleLowerCase() === name.toLowerCase();
  });
}

function validateQuery(query: string): string {
  const tokens: string[] = [];

  query.split(' ').forEach((s) => {
    s = s.trim();
    if (s.length !== 0 && s !== TagPrefix) {
      tokens.push(s);
    }
  });

  return tokens.join(' ');
}

function clearSelectedExample() {
  ui.selected.example = undefined;
  ui.overlays.details.visible = false;
}

