// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { EXTENSION_ID } from '@/constants';
import { telemetry, createLogger, isError, fetchWithAbort } from 'qt-lib';

const QtDocHostUrl = 'https://doc.qt.io';
const SearchHostUrl = 'https://d24zn9cw9ofw9u.cloudfront.net';

const logger = createLogger('online-docs');

interface SearchResponse {
  items?: {
    link: string;
    snippet: string;
    title: string;
  }[];
  searchInformation: {
    formattedTotalResults: string;
    totalResults: string;
  };
  queries: {
    nextPage: {
      startIndex: number;
    };
  };
}

interface PickItem {
  url: string;
  label: string;
  detail: string;
}

interface CurrentEdit {
  word: string;
  filePath: string;
}

function getCurrentEdit(): CurrentEdit | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const doc = editor.document;
  const range = editor.selection.isEmpty
    ? doc.getWordRangeAtPosition(editor.selection.active)
    : editor.selection;

  return (
    range && {
      word: doc.getText(range).trim(),
      filePath: doc.uri.fsPath
    }
  );
}

async function fetchUrl(url: string, token?: vscode.CancellationToken) {
  if (token?.isCancellationRequested) {
    return undefined;
  }

  const controller = new AbortController();
  const listener = token?.onCancellationRequested(() => {
    controller.abort();
  });

  try {
    const options = { controller, timeout: 5000 };
    const res = await fetchWithAbort(url, options);
    return res?.ok ? res : undefined;
  } finally {
    listener?.dispose();
  }
}

function browseUrl(url: string) {
  const useExternal = vscode.workspace
    .getConfiguration(EXTENSION_ID)
    .get<boolean>('openOnlineDocumentationInExternalBrowser');

  if (useExternal) {
    void vscode.env.openExternal(vscode.Uri.parse(url));
  } else {
    const cmd = 'simpleBrowser.api.open';
    const options = { viewColumn: vscode.ViewColumn.Beside };
    void vscode.commands.executeCommand(cmd, url, options);
  }
}

async function openQt6Doc(word: string, token?: vscode.CancellationToken) {
  if (word.length === 0 || token?.isCancellationRequested) {
    return false;
  }

  const url = `${QtDocHostUrl}/qt-6/${word.toLowerCase()}.html`;
  const res = await fetchUrl(url, token);
  if (!token?.isCancellationRequested && res?.ok) {
    browseUrl(url);
    return true;
  }

  return false;
}

function openQtforPythonDoc(word: string, possibleUrl: string) {
  const parts = possibleUrl.split('/');
  const lastPart = parts[parts.length - 1];
  const starting = `${QtDocHostUrl}/qtforpython-6/PySide6/`;
  if (possibleUrl.startsWith(starting) && lastPart === `${word}.html`) {
    browseUrl(possibleUrl);
    return true;
  }

  return false;
}

async function pickAndOpen(items: PickItem[]) {
  if (items.length === 0) {
    return;
  }

  const placeHolder = 'Select a search result';
  const selected = await vscode.window.showQuickPick(items, { placeHolder });
  if (selected) {
    browseUrl(selected.url);
  }
}

async function search(keywords: string[], token?: vscode.CancellationToken) {
  const queries = keywords
    .filter((k) => k.trim().length !== 0)
    .map((k) => `q=${k.trim()}`)
    .join('&');

  if (!queries || token?.isCancellationRequested) {
    return [];
  }

  const raw = await fetchUrl(`${SearchHostUrl}?${queries}`, token);
  if (!raw?.ok) {
    throw new Error(`Network response: status = ${raw?.status ?? 'unknown'}`);
  }

  if (token?.isCancellationRequested) {
    return [];
  }

  const res = (await raw.json()) as SearchResponse;
  const rawItems = res.items ?? [];
  const pickItems = rawItems.map((item) => ({
    url: item.link,
    label: item.title,
    detail: item.snippet
  }));

  if (pickItems.length === 0) {
    void vscode.window.showInformationMessage('No search results found.');
  }

  return pickItems;
}

function openOrSearchAndPick(edit: CurrentEdit) {
  type Progress = vscode.Progress<{ message?: string; increment?: number }>;
  type Token = vscode.CancellationToken;

  let itemsToPick: PickItem[] = [];

  const task = async (_: Progress, token: Token) => {
    try {
      const isPython = edit.filePath.endsWith('.py');
      if (!isPython && (await openQt6Doc(edit.word, token))) {
        return;
      }

      const keywords = [edit.word, isPython ? 'pyside6' : ''];
      const found = await search(keywords, token);
      const firstUrl = found[0]?.url;
      if (firstUrl) {
        if (isPython && openQtforPythonDoc(edit.word, firstUrl)) {
          return;
        }
      }

      itemsToPick = found;
    } catch (e) {
      const text = isError(e) ? e.message : String(e);
      logger.error(text);
      void vscode.window.showErrorMessage(`Error: "${text}"`);
    }
  };

  const options = {
    title: 'Searching...',
    location: vscode.ProgressLocation.Notification,
    cancellable: true
  };

  void vscode.window.withProgress(options, task).then(async () => {
    await pickAndOpen(itemsToPick);
  });
}

function onOpenHomePage() {
  browseUrl(QtDocHostUrl);
}

async function onSearchManually() {
  const edit = getCurrentEdit();
  const input = await vscode.window.showInputBox({
    value: edit?.word ?? '',
    placeHolder: 'Search for...',
    prompt: 'Enter a term to search for in the Qt Documentation'
  });

  const word = input?.trim();
  if (word && word.length !== 0) {
    openOrSearchAndPick({ word, filePath: edit?.filePath ?? '' });
  }
}

function onSearchForCurrentWord() {
  const edit = getCurrentEdit();
  if (!edit || edit.word.length === 0) {
    void vscode.window.showInformationMessage('No word found at the cursor.');
    return;
  }

  openOrSearchAndPick(edit);
}

export function registerDocumentationCommands() {
  function register(cmd: string, callback: (...args: unknown[]) => unknown) {
    return vscode.commands.registerCommand(
      `${EXTENSION_ID}.${cmd}`,
      async () => {
        telemetry.sendAction(cmd);
        await callback();
      }
    );
  }

  return [
    register('documentationHomepage', onOpenHomePage),
    register('documentationSearchManually', onSearchManually),
    register('documentationSearchForCurrentWord', onSearchForCurrentWord)
  ];
}
