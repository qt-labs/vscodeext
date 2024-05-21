// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

interface SearchItem {
  link: string;
  snippet: string;
  title: string;
}

interface SearchResponse {
  items?: SearchItem[];
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

function getCurrentWord(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return '';
  }
  const range = editor.selection.isEmpty
    ? editor.document.getWordRangeAtPosition(editor.selection.active)
    : editor.selection;
  if (range) {
    const word = editor.document.getText(range);
    return word;
  }
  return '';
}

async function tryToOpenDocumentationFor(word: string) {
  if (!word) {
    return false;
  }
  const link = `https://doc.qt.io/qt-6/${word.toLowerCase()}.html`;

  const response = await fetch(link);
  if (response.ok) {
    openInBrowser(link);
    return true;
  }
  return false;
}

function openInBrowser(url: string) {
  const openInExternalBrowserCommand = vscode.workspace
    .getConfiguration('qt-official')
    .get<boolean>('openOnlineDocumentationInExternalBrowser');
  if (openInExternalBrowserCommand) {
    void vscode.env.openExternal(vscode.Uri.parse(url));
    return;
  }
  const simpleBrowserCommand = 'simpleBrowser.api.open';
  void vscode.commands.executeCommand(simpleBrowserCommand, url, {
    viewColumn: vscode.ViewColumn.Beside
  });
}

async function search() {
  const hintWord = getCurrentWord();
  const value = await vscode.window.showInputBox({
    value: hintWord,
    placeHolder: 'Search for...',
    prompt: 'Enter a term to search for in the Qt Documentation'
  });
  if (value === undefined || value === '') {
    return;
  }

  if (await tryToOpenDocumentationFor(value)) {
    return;
  }
  await searchAndAskforResult(value);
}
async function searchAndAskforResult(value: string) {
  try {
    const searchLink =
      'https://www.googleapis.com/customsearch/v1/siterestrict?fields=items(link,snippet,title)&cx=047283ffa7d25323e&key=AIzaSyCZJjNXt7smIy62zupDA-d60EgTFtxwih4&num=10&siteSearch=doc.qt.io%2F*&siteSearchFilter=i&q=';
    const searchResponse = await fetch(searchLink + value);
    if (!searchResponse.ok) {
      throw new Error('Network response: ' + searchResponse.status);
    }

    const searchResponseJson = (await searchResponse.json()) as SearchResponse;
    if (!searchResponseJson.items) {
      void vscode.window.showInformationMessage('No search results found.');
      return;
    }
    const quickPickItems = searchResponseJson.items.map((item) => ({
      label: item.title,
      link: item.link,
      detail: item.snippet
    }));
    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Select a search result'
    });
    if (selected) {
      openInBrowser(selected.link);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function openHomepage() {
  openInBrowser('https://doc.qt.io');
}

async function searchForCurrentWord() {
  const word = getCurrentWord();
  if (word === '') {
    void vscode.window.showInformationMessage('No word found at the cursor.');
    return;
  }
  if (await tryToOpenDocumentationFor(word)) {
    return;
  }
  await searchAndAskforResult(word);
}

export function registerDocumentationCommands() {
  const homepageCommand = vscode.commands.registerCommand(
    'qt-official.documentationHomepage',
    openHomepage
  );
  const searchManuallyCommand = vscode.commands.registerCommand(
    'qt-official.documentationSearchManually',
    search
  );
  const searchForCurrentWordCommand = vscode.commands.registerCommand(
    'qt-official.documentationSearchForCurrentWord',
    searchForCurrentWord
  );
  return [homepageCommand, searchManuallyCommand, searchForCurrentWordCommand];
}
