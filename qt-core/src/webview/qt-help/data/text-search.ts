// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import MiniSearch, { SearchResult } from 'minisearch';

import { FullTextMatch } from '@/webview/shared/qt-help';

const NumBatch = 25;
const NumConcurrency = 4;

const TitleTier = {
  Word: 0,
  WordPartial: 1,
  Prefix: 2,
  Others: 3
} as const;

// Characters that separate plain words: whitespace and punctuation.
// Example: "Object Model | Qt Core" -> ["Object", "Model", "Qt", "Core"]
const wordSeparators = /[\s\-.,:;|/()<>*&[\]{}"'=+!?]+/;

// Splits camelCase / PascalCase identifiers at word boundaries:
//   (?<=[a-z0-9])(?=[A-Z])      lower/digit -> upper   "objectName"  -> "object" | "Name"
//   (?<=[A-Z])(?=[A-Z][a-z])    acronym -> new word    "QJniObject" -> "Q" | "Jni" | "Object"
const camelCaseBoundary = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;

// Tokenizer for MiniSearch: splits text into words, and additionally into
// identifier parts so that a search for "object" can match "ObjectModel".
// The original word is kept so that exact searches (e.g. "ObjectModel") still work.
// One-letter parts are dropped, so "QObject" stays ["QObject"] (no "Q", no "Object").

// Examples:
//   "ObjectModel QML Type" -> ["ObjectModel", "Object", "Model", "QML", "Type"]
//   "QObject Class"        -> ["QObject", "Class"]
//   "Qt::AlignLeft"        -> ["Qt", "AlignLeft", "Align", "Left"]
const splitIdentifier = (s: string): string[] =>
  s
    .split(wordSeparators)
    .flatMap((word) => {
      const parts = word.split(camelCaseBoundary).filter((p) => p.length > 1);
      return parts.length > 1 ? [word, ...parts] : [word];
    })
    .filter(Boolean);

// Splits text into plain words only (no camelCase splitting).
// Used to tell a standalone word apart from an identifier part.

// Examples:
//   "Object Model | Qt Core" -> ["Object", "Model", "Qt", "Core"]
//   "ObjectModel QML Type"   -> ["ObjectModel", "QML", "Type"]
const splitWords = (s: string): string[] =>
  s.split(wordSeparators).filter(Boolean);

const htmlParsers = {
  // <title>QObject Class | Qt Core 6.8</title> -> "QObject Class | Qt Core 6.8"
  // <body class="x"><p>Hello</p></body> -> "<p>Hello</p>"
  // <script>var a;</script>, <style>p{}</style> -> removed with contents
  // <p>Hello <b>World</b></p> -> " Hello  World "
  // "Hello   \n  World" -> "Hello World"
  tags: /<[^>]+>/g,
  title: /<title>([\s\S]*?)<\/title>/i,
  body: /<body[\s\S]*?>([\s\S]*)<\/body>/i,
  scriptOrStyle: /<(script|style)[\s\S]*?<\/\1>/gi,
  whitespace: /\s+/g
};

interface HtmlDoc {
  id: string;
  title: string;
  text: string;
  rootDir: string;
  snippet: string;
}

export class HtmlFullTextIndex {
  private _buildGeneration = 0;
  private readonly _textById = new Map<string, string>();
  private readonly _miniSearch = new MiniSearch<HtmlDoc>({
    fields: ['title', 'text'],
    storeFields: ['title', 'id', 'rootDir', 'snippet'],
    tokenize: splitIdentifier,
    searchOptions: {
      prefix: (term) => term.length >= 2,
      fuzzy: false
    }
  });

  public async build(rootDir: string): Promise<void> {
    const gen = ++this._buildGeneration;

    this._miniSearch.removeAll();
    this._textById.clear();

    const files = await fg('**/*.html', { cwd: rootDir, absolute: true });
    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(NumConcurrency);

    for (let i = 0; i < files.length; i += NumBatch) {
      if (gen !== this._buildGeneration) {
        return;
      }

      const results: (HtmlDoc | undefined)[] = await Promise.all(
        files.slice(i, i + NumBatch).map(async (file) =>
          limit(async () => {
            const raw = await fs.readFile(file, 'utf-8');
            const title =
              htmlParsers.title.exec(raw)?.[1] ?? path.basename(file);
            if (shouldSkipByTitle(title)) {
              return undefined;
            }

            const body = htmlParsers.body.exec(raw)?.[1] ?? raw;
            const text = body
              .replace(htmlParsers.scriptOrStyle, ' ')
              .replace(htmlParsers.tags, ' ')
              .replace(htmlParsers.whitespace, ' ')
              .trim();

            return {
              id: file,
              title,
              text,
              rootDir,
              snippet: ''
            };
          })
        )
      );

      if (gen !== this._buildGeneration) {
        return;
      }

      const docs = results.filter((d) => d !== undefined);
      this._miniSearch.addAll(docs);

      for (const doc of docs) {
        this._textById.set(doc.id, doc.text);
      }

      await new Promise((r) => setImmediate(r));
    }
  }

  public search(query: string): FullTextMatch[] {
    const bodyHits = this._searchBodies(query);
    const titleHits = this._searchTitles(query);

    const result: FullTextMatch[] = [];
    const seenIds = new Set<string>();

    const addToResult = (candidates: SearchResult[]) => {
      for (const c of candidates) {
        const id = String(c.id);
        const title = String(c.title);

        if (!seenIds.has(id)) {
          const filePathRel = path.relative(String(c.rootDir), id);
          const snippet = buildSnippet(this._textById.get(id) ?? '', c.terms);

          seenIds.add(id);
          result.push({ title, filePathRel, snippet });
        }
      }
    };

    addToResult(titleHits);
    addToResult(bodyHits);

    return result;
  }

  private _searchTitles(query: string) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const all = this._miniSearch
      .search(query, { fields: ['title'] })
      .map((r) => ({ r, tier: assessTitleTier(String(r.title), terms) }))
      .sort((a, b) => a.tier - b.tier); // score order is kept within a tier

    return all.map((x) => x.r);
  }

  private _searchBodies(query: string) {
    return this._miniSearch.search(query, { fields: ['text'] });
  }
}

// helpers
function assessTitleTier(title: string, terms: string[]): number {
  const words = splitWords(title).map((w) => w.toLowerCase());
  const tokens = splitIdentifier(title).map((t) => t.toLowerCase());

  if (terms.every((t) => words.includes(t))) {
    return TitleTier.Word;
  } else if (terms.every((t) => tokens.includes(t))) {
    return TitleTier.WordPartial;
  } else if (terms.every((t) => tokens.some((tok) => tok.startsWith(t)))) {
    return TitleTier.Prefix;
  } else {
    return TitleTier.Others;
  }
}

function shouldSkipByTitle(title: string): boolean {
  const PrefixesToExclude = ['obsolete members', 'list of all members'];

  const t = title.toLowerCase();
  return PrefixesToExclude.some((prefix) => t.startsWith(prefix));
}

function buildSnippet(text: string, terms: string[], contextChars = 60) {
  let matchIndex = -1;
  const lower = text.toLowerCase();

  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase());
    if (i !== -1) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    return text.slice(0, contextChars * 2);
  }

  const s = Math.max(0, matchIndex - contextChars);
  const e = Math.min(text.length, matchIndex + contextChars);
  const ellipsis = '…';

  return [
    s > 0 ? ellipsis : '',
    text.slice(s, e),
    e < text.length ? ellipsis : ''
  ].join('');
}
