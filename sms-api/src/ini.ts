/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * INI codec compatible with `QSettings::IniFormat`.
 *
 * QSettings stores a key such as `auth/oidc_pkce/access_token` as the section
 * `[auth]` and the key `oidc_pkce\access_token`: the first path segment is the
 * section, the remaining slashes are written as backslashes. Keys without a
 * section live in `[General]`, and a real `General/...` key is written under
 * `[%General]`. Values are quoted when they contain `;`, `,` or `=` or have a
 * leading or trailing space, and special characters are backslash escaped.
 *
 * Entries read from a file keep their position when the file is written back
 * and new keys are appended in sorted order, like QSettings does. Values of
 * keys this code did not set are written back exactly as they were read.
 */

const LINE_END = process.platform === 'win32' ? '\r\n' : '\n';

function isAsciiAlnum(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a)
  );
}

function hexUpper(code: number, width: number): string {
  return code.toString(16).toUpperCase().padStart(width, '0');
}

/** `QSettingsPrivate::iniEscapedKey` */
export function encodeIniKey(key: string): string {
  let out = '';
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    const ch = key[i] ?? '';
    if (ch === '/') {
      out += '\\';
    } else if (
      isAsciiAlnum(code) ||
      ch === '_' ||
      ch === '-' ||
      ch === '.' ||
      ch === ',' ||
      ch === ';' ||
      ch === '(' ||
      ch === ')'
    ) {
      out += ch;
    } else if (code <= 0xff) {
      out += `%${hexUpper(code, 2)}`;
    } else {
      out += `%U${hexUpper(code, 4)}`;
    }
  }
  return out;
}

/** `QSettingsPrivate::iniUnescapedKey` */
export function decodeIniKey(raw: string): string {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i] ?? '';
    if (ch === '\\') {
      out += '/';
      i++;
      continue;
    }
    if (ch !== '%' || i === raw.length - 1) {
      out += ch;
      i++;
      continue;
    }
    let digits = 2;
    let first = i + 1;
    if (raw[first] === 'U') {
      first++;
      digits = 4;
    }
    const hex = raw.slice(first, first + digits);
    if (hex.length !== digits || !/^[0-9A-Fa-f]+$/.test(hex)) {
      out += '%';
      i++;
      continue;
    }
    out += String.fromCharCode(parseInt(hex, 16));
    i = first + digits;
  }
  return out;
}

/** `QSettingsPrivate::variantToString` + `iniEscapedString` for a QString. */
export function encodeIniValue(value: string): string {
  let str = value;
  if (str.includes('\0')) {
    str = `@String(${str})`;
  } else if (str.startsWith('@')) {
    str = `@${str}`;
  }

  let needsQuotes = false;
  let escapeNextIfDigit = false;
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i] ?? '';
    const code = str.charCodeAt(i);
    if (ch === ';' || ch === ',' || ch === '=') {
      needsQuotes = true;
    }
    if (escapeNextIfDigit && /[0-9A-Fa-f]/.test(ch)) {
      out += `\\x${code.toString(16)}`;
      continue;
    }
    escapeNextIfDigit = false;
    switch (ch) {
      case '\0':
        out += '\\0';
        escapeNextIfDigit = true;
        break;
      case '\x07':
        out += '\\a';
        break;
      case '\b':
        out += '\\b';
        break;
      case '\f':
        out += '\\f';
        break;
      case '\n':
        out += '\\n';
        break;
      case '\r':
        out += '\\r';
        break;
      case '\t':
        out += '\\t';
        break;
      case '\v':
        out += '\\v';
        break;
      case '"':
      case '\\':
        out += `\\${ch}`;
        break;
      default:
        if (code <= 0x1f) {
          out += `\\x${code.toString(16)}`;
          escapeNextIfDigit = true;
        } else {
          out += ch;
        }
    }
  }
  if (needsQuotes || out.startsWith(' ') || out.endsWith(' ')) {
    return `"${out}"`;
  }
  return out;
}

const NAMED_ESCAPES: Record<string, string> = {
  a: '\x07',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  '"': '"',
  '?': '?',
  "'": "'",
  '\\': '\\'
};

/**
 * `QSettingsPrivate::iniUnescapedStringList` for a single string, followed by
 * `stringToVariant`. A comma outside quotes is kept literally instead of
 * splitting into a list; this code never writes such values.
 */
export function decodeIniValue(raw: string): string {
  let i = 0;
  let out = '';
  let inQuotes = false;
  let quoted = false;

  // StSkipSpaces
  while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t')) {
    i++;
  }

  while (i < raw.length) {
    const ch = raw[i] ?? '';
    if (ch === '\\') {
      i++;
      if (i >= raw.length) {
        break;
      }
      const esc = raw[i] ?? '';
      i++;
      const named = NAMED_ESCAPES[esc];
      if (named !== undefined) {
        out += named;
        continue;
      }
      if (esc === 'x') {
        let hex = '';
        while (i < raw.length && /[0-9A-Fa-f]/.test(raw[i] ?? '')) {
          hex += raw[i] ?? '';
          i++;
        }
        if (hex.length > 0) {
          out += String.fromCharCode(parseInt(hex, 16));
        }
        continue;
      }
      if (esc >= '0' && esc <= '7') {
        let oct = esc;
        while (
          i < raw.length &&
          oct.length < 3 &&
          (raw[i] ?? '') >= '0' &&
          (raw[i] ?? '') <= '7'
        ) {
          oct += raw[i] ?? '';
          i++;
        }
        out += String.fromCharCode(parseInt(oct, 8));
        continue;
      }
      // Any other escaped character is dropped, like QSettings does.
      continue;
    }
    if (ch === '"') {
      i++;
      quoted = true;
      inQuotes = !inQuotes;
      if (!inQuotes) {
        while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t')) {
          i++;
        }
      }
      continue;
    }
    out += ch;
    i++;
  }

  if (!quoted) {
    out = out.replace(/[ \t]+$/, '');
  }

  // stringToVariant
  if (out.startsWith('@')) {
    if (out.endsWith(')')) {
      if (out.startsWith('@String(')) {
        return out.slice(8, -1);
      }
      if (out === '@Invalid()') {
        return '';
      }
    }
    if (out.startsWith('@@')) {
      return out.slice(1);
    }
  }
  return out;
}

interface Entry {
  raw: string;
  position: number; // -1: added after parsing, sorts last
}

function splitKey(key: string): { section: string; rest: string } {
  const slash = key.indexOf('/');
  if (slash === -1) {
    return { section: '', rest: key };
  }
  return { section: key.slice(0, slash), rest: key.slice(slash + 1) };
}

function sectionHeader(section: string): string {
  if (section === '') {
    return '[General]';
  }
  if (section.toLowerCase() === 'general') {
    return '[%General]';
  }
  return `[${encodeIniKey(section)}]`;
}

function sectionFromHeader(header: string): string {
  const decoded = decodeIniKey(header);
  if (decoded.toLowerCase() === 'general') {
    return '';
  }
  if (decoded.toLowerCase() === '%general') {
    return 'General';
  }
  return decoded;
}

function comparePositioned(a: [string, number], b: [string, number]): number {
  const pa = a[1] < 0 ? Number.POSITIVE_INFINITY : a[1];
  const pb = b[1] < 0 ? Number.POSITIVE_INFINITY : b[1];
  if (pa !== pb) {
    return pa < pb ? -1 : 1;
  }
  if (a[0] === b[0]) {
    return 0;
  }
  return a[0] < b[0] ? -1 : 1;
}

export class IniDocument {
  private readonly sections = new Map<string, Map<string, Entry>>();

  static parse(text: string): IniDocument {
    const doc = new IniDocument();
    let section = '';
    let position = 0;
    for (const rawLine of text.split('\n')) {
      const line = rawLine.replace(/\r$/, '').trim();
      position++;
      if (line === '' || line.startsWith(';') || line.startsWith('#')) {
        continue;
      }
      if (line.startsWith('[')) {
        const end = line.indexOf(']');
        section = sectionFromHeader(
          end === -1 ? line.slice(1) : line.slice(1, end)
        );
        continue;
      }
      const eq = line.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      const key = decodeIniKey(line.slice(0, eq).trimEnd());
      const raw = line.slice(eq + 1);
      doc.sectionMap(section).set(key, { raw, position });
    }
    return doc;
  }

  private sectionMap(section: string): Map<string, Entry> {
    let map = this.sections.get(section);
    if (!map) {
      map = new Map<string, Entry>();
      this.sections.set(section, map);
    }
    return map;
  }

  get(key: string): string | undefined {
    const { section, rest } = splitKey(key);
    const entry = this.sections.get(section)?.get(rest);
    return entry ? decodeIniValue(entry.raw) : undefined;
  }

  set(key: string, value: string): void {
    const { section, rest } = splitKey(key);
    const map = this.sectionMap(section);
    const existing = map.get(rest);
    map.set(rest, {
      raw: encodeIniValue(value),
      position: existing ? existing.position : -1
    });
  }

  remove(key: string): void {
    const { section, rest } = splitKey(key);
    const map = this.sections.get(section);
    if (!map) {
      return;
    }
    map.delete(rest);
    if (map.size === 0) {
      this.sections.delete(section);
    }
  }

  /** Removes every key under `prefix` (a QSettings group such as `auth/pat`). */
  removeGroup(prefix: string): void {
    for (const key of this.keys()) {
      if (key === prefix || key.startsWith(`${prefix}/`)) {
        this.remove(key);
      }
    }
  }

  keys(): string[] {
    const result: string[] = [];
    for (const [section, map] of this.sections) {
      for (const rest of map.keys()) {
        result.push(section === '' ? rest : `${section}/${rest}`);
      }
    }
    return result;
  }

  serialize(): string {
    const ordered: [string, number][] = [];
    for (const [section, map] of this.sections) {
      let min = Number.POSITIVE_INFINITY;
      for (const entry of map.values()) {
        if (entry.position >= 0 && entry.position < min) {
          min = entry.position;
        }
      }
      ordered.push([section, min === Number.POSITIVE_INFINITY ? -1 : min]);
    }
    ordered.sort(comparePositioned);

    const blocks: string[] = [];
    for (const [section] of ordered) {
      const map = this.sections.get(section);
      if (!map || map.size === 0) {
        continue;
      }
      const entries: [string, number][] = [];
      for (const [rest, entry] of map) {
        entries.push([rest, entry.position]);
      }
      entries.sort(comparePositioned);
      const lines = [sectionHeader(section)];
      for (const [rest] of entries) {
        const entry = map.get(rest);
        if (entry) {
          lines.push(`${encodeIniKey(rest)}=${entry.raw}`);
        }
      }
      blocks.push(lines.join(LINE_END) + LINE_END);
    }
    return blocks.join(LINE_END);
  }
}
