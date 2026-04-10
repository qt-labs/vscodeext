// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';

import { vscode } from '@/apps/vscode';
import { CommandId } from '@shared/message';
import {
  type ActionId,
  isExtInfoArray,
  isVideoEntryArray,
  isBlogArticleArray,
  type DataType,
  type WebsiteId,
  type WebviewId,
} from '@shared/welcome';
import { data, ui } from './states.svelte'

export async function onAppMount() {
  await loadData();
  await loadConfig();
}

export async function refreshAndReloadData(type: DataType) {
  await runAction('refresh-data', { type });
  await loadData();
}

export async function openUrl(url: string) {
  await runAction('openUrl', { url });
}

export async function openWebsite(id: WebsiteId) {
  await runAction('openWebsite', { id });
}

export async function openWebview(id: WebviewId) {
  await runAction('openWebview', { id });
}

export async function openMarketplace(extensionId: string) {
  await runAction('openMarketplace', { id: extensionId });
}

async function loadData() {
  const MaxItems = 4;

  const r = await vscode.post(CommandId.WelcomeGetData);
  const ext = _.get(r, 'extInfo', []);
  const blogs = _.get(r, 'blogArticles', []);
  const videos = _.get(r, 'videoEntries', []);

  if (isExtInfoArray(ext)) {
    data.ext = ext;
  }

  if (isBlogArticleArray(blogs)) {
    data.blogs = blogs.slice(0, MaxItems);
  }

  if (isVideoEntryArray(videos)) {
    data.videos = videos.slice(0, MaxItems);
  }

  data.timestamps.blog = _.get(r, 'timestamps.blog', data.timestamps.blog);
  data.timestamps.video = _.get(r, 'timestamps.video', data.timestamps.video);
}

 async function loadConfig() {
  const r = await vscode.post(CommandId.WelcomeHandleConfig, { access: 'get' });
  const v = _.get(r, 'showOnActivation', ui.config.showOnActivation);

  ui.config.showOnActivation = v;
}

export async function saveConfig() {
  await vscode.post(CommandId.WelcomeHandleConfig, {
    access: 'set',
    showOnActivation: ui.config.showOnActivation
  })
}

async function runAction(action: ActionId, args: object = {}) {
  await vscode.post(CommandId.WelcomeRunAction, { action, args })
}
