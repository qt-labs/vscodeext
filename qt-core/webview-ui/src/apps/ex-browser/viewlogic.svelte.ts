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
} from '@shared/ex-browser';
import * as NewItemForm from '@/comps/NewItemForm.logic.svelte';
import { CommandId, isErrorResponse } from '@shared/message';
import { data, ui } from './states.svelte';

export async function onAppMount() {
  try {
    ui.sidebar.newProject.input.onEvent(onNewProjectFormEvent);
    ui.sidebar.newProject.input.onValidate(validateNewProjectForm);
    ui.theme.monitor.start();

    await loadConfigs();
    await loadPackages();

    if (data.packages[0]) {
      await selectPackage(data.packages[0]);
    }

    setEventListenerEnabled(true);
    ui.filter.searchInputEl?.focus();
    ui.state = 'running';
  } catch (e) {
    ui.state = 'error';
    throw e;
  }
}

export async function onAppDestroy() {
  ui.theme.monitor.stop();
  setEventListenerEnabled(false);
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

  selectExample(undefined);
  data.examples = [];
  data.categories = isExCategoryArray(categories) ? categories : [];
  data.resolvedPaths = isExResolvedPathsRecord(resolvedPaths)
    ? resolvedPaths
    : {};

  ui.filter.tags = [];
  ui.filter.searchInput = '';
  ui.filter.category = findCategoryByName('all');
  ui.selected.package = p;

  ui.imageUrlCache.clear();
  resetMainViewScroll();

  await loadExamples('selectPackage');
}

export async function selectCategory(category?: ExCategory | string) {
  const c =
    typeof category === 'string' ? findCategoryByName(category) : category;

  if (!_.isEqual(ui.filter.category, c)) {
    ui.filter.category = c;
    await loadExamples();
  }
}

export async function selectExample(example: ExEntry | undefined) {
  ui.selected.example = example;
  ui.sidebar.visible = example !== undefined;
  ui.sidebar.newProject.expanded = false;
}

export async function setSearchInput(s: string) {
  if (ui.filter.searchInput !== s) {
    ui.filter.searchInput = s;
    await loadExamples();
  }
}

export async function toggleTag(rawTag: string) {
  const trimmed = rawTag.trim();
  if (trimmed.length === 0) {
    return;
  }

  if (isTagSelected(trimmed)) {
    ui.filter.tags = ui.filter.tags.filter((t) => t !== trimmed);
  } else {
    ui.filter.tags.push(trimmed);
  }

  await loadExamples();
}

export function isTagSelected(rawTag: string) {
  const t = rawTag.trim();
  return t.length === 0 ? false : ui.filter.tags.includes(rawTag);
}

export function setNewProjectFormVisible(visible: boolean) {
  ui.sidebar.newProject.expanded = visible;

  if (visible) {
    ui.sidebar.newProject.input.validate();
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

export async function revealFolder(folder: string) {
  await vscode.post(CommandId.CommonRevealFolder, { folder });
}

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

export async function onNewProjectFormEvent(
  type: NewItemForm.EventType,
  args?: unknown
) {
  const controller = ui.sidebar.newProject.input;

  switch (type) {
    case 'inputChanged':
      validateNewProjectForm();
      break;

    case 'openInChanged':
      await vscode.post(CommandId.ExBrowserSaveOpenInPreference, String(args));
      break;

    case 'browseClicked':
      void vscode
        .post(CommandId.ExBrowserSelectWorkingDir, controller.states.workingDir, -1)
        .then((data) => {
          if (typeof data === 'string') {
            controller.states.workingDir = data;
            validateNewProjectForm();
          }
        });
      break;

    case 'createClicked':
      if (ui.selected.example) {
        await runExAction('project-create', {
          name: controller.states.name,
          workingDir: controller.states.workingDir,
          saveProjectDir: controller.states.saveProjectDir,
          openIn: String(controller.states.openIn)
        } as ExNewProjectArgs);
      }
      break;
  }
}

export async function validateNewProjectForm() {
  const input = ui.sidebar.newProject.input;
  const payload = {
    type: 'project',
    name: input.states.name,
    workingDir: input.states.workingDir
  };

  try {
    await vscode.post(CommandId.ExBrowserValidateInputs, payload);
    input.clearIssues();
  } catch (e) {
    input.applyValidationResult(isErrorResponse(e) ? e : undefined);
  }
}

// helpers
async function loadConfigs() {
  const r = await vscode.post(CommandId.ExBrowserGetConfigs);
  if (isExBrowserViewConfig(r)) {
    const all = r.newProject;
    const input = ui.sidebar.newProject.input;

    input.states.name = all.name;
    input.states.workingDir = all.workingDir;
    input.states.saveProjectDir = all.saveProjectDir;
    input.states.openIn = all.openIn;
  }
}

async function loadPackages() {
  const r = await vscode.post(CommandId.ExBrowserGetPackages);
  if (Array.isArray(r) && r.every(isExPackage)) {
    data.packages = r;
  }
}

async function loadExamples(reason: 'selectPackage' | '' = '') {
  const task = async () => {
    const r = await vscode.post(CommandId.ExBrowserGetExamples, {
      query: createFilterQuery(ui.filter.searchInput, ui.filter.tags),
      category: $state.snapshot(ui.filter.category)
    });

    if (Array.isArray(r) && r.every(isExEntry)) {
      data.examples = r;
    }

    if (reason === 'selectPackage') {
      selectExample(undefined);
      return;
    }

    if (ui.selected.example) {
      const hit = data.examples.find((e) => {
        return _.isEqual(ui.selected.example, e);
      });

      if (!hit) {
        selectExample(undefined);
      }
    }
  }

  await ui.task.run(task, { debounceTime_ms: 0 });
}

function findCategoryByName(name: string) {
  return data.categories.find((c) => {
    return c.name.toLocaleLowerCase() === name.toLowerCase();
  });
}

function createFilterQuery(keywords: string, tags: string[]) {
  const tagsJoined = tags
    .map((e) => {
      const t = e.trim();
      return t.length === 0 ? '' : TagPrefix + t;
    })
    .filter((e) => e.length !== 0)
    .join(' ');

  return `${keywords} ${tagsJoined}`;
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    e.stopPropagation();
    ui.filter.searchInputEl?.focus();
    ui.filter.searchInputEl?.select();
  }
}

function setEventListenerEnabled(enable: boolean) {
  const callback = enable
    ? document.addEventListener.bind(document)
    : document.removeEventListener.bind(document);

  callback('keydown', onKeyDown, { capture: true });
}

function resetMainViewScroll() {
  if (ui.grid) {
    ui.grid.scrollTop = 0;
  }

  if (ui.list) {
    ui.list.scrollTop = 0;
  }
}
