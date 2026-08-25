// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

export interface QRCContainmentOptions {
  // Roots besides the .qrc file's own directory that entries may resolve
  // into, typically the workspace folders and the build directories.
  extraRoots?: string[];
  // Called for each entry dropped because it resolves outside every root.
  onViolation?: (entry: string, resolvedPath: string) => void;
}

// Define the structure for the QRC XML
interface QRCFile {
  '@_alias': string | undefined; // The alias for the file
  '#text': string | undefined; // The file path
}

interface QRCResource {
  '@_prefix': string;
  file: QRCFile | QRCFile[]; // A file or an array of files
}

interface QRCParsed {
  RCC: {
    qresource: QRCResource | QRCResource[] | undefined; // One or more qresource elements
  };
}

export class QRCParser {
  private readonly parser: XMLParser;
  private readonly _cache = new Map<string, Map<string, string>>();

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      alwaysCreateTextNode: true
    });
  }

  parseQRCFile(
    filePath: string,
    includeAllFiles = false,
    options?: QRCContainmentOptions
  ) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot find file: ${filePath}`);
    }
    const roots = (options?.extraRoots ?? []).join('|');
    const cacheKey = `${filePath}:${includeAllFiles ? 'all' : 'qml-js'}:${roots}`;
    const cachedContent = this._cache.get(cacheKey);
    if (cachedContent) {
      return cachedContent;
    }
    const xmlContent = fs.readFileSync(filePath, 'utf8');
    const fileMapping = this.parseQRC(
      xmlContent,
      path.dirname(filePath),
      includeAllFiles,
      options
    );
    if (!fileMapping) {
      return undefined;
    }
    this._cache.set(cacheKey, fileMapping);
    return fileMapping;
  }

  parseQRC(
    xmlContent: string,
    qrcDir: string,
    includeAllFiles = false,
    options?: QRCContainmentOptions
  ) {
    try {
      // Parse the XML content into the defined structure
      const jsonObj = this.parser.parse(xmlContent) as QRCParsed; // Type assertion to QRCParsed

      // Extract the resources (qresource)
      const resources = jsonObj.RCC.qresource;

      if (!resources) {
        return undefined;
      }

      // Ensure resources is always an array
      const resourcesArray = Array.isArray(resources) ? resources : [resources];

      // Initialize a Map to store file paths and corresponding aliases
      const resourceMap = new Map<string, string>();

      // A crafted .qrc must not map resources onto files outside the
      // project: entries may only resolve into the .qrc's own directory or
      // one of the extra roots (workspace folders, build directories).
      const isContained = createContainmentChecker([
        qrcDir,
        ...(options?.extraRoots ?? [])
      ]);

      // Loop through each <qresource> and add its files to the map
      resourcesArray.forEach((resource) => {
        const prefix = resource['@_prefix'] || '';
        const files = Array.isArray(resource.file)
          ? resource.file
          : [resource.file];

        files.forEach((file) => {
          const text = file['#text'];
          if (!text) {
            return;
          }

          // Filter files based on includeAllFiles flag
          if (
            !includeAllFiles &&
            !text.endsWith('.qml') &&
            !text.endsWith('.js')
          ) {
            return;
          }

          const resolved = path.isAbsolute(text)
            ? text
            : path.join(qrcDir, text);
          if (!isContained(resolved)) {
            options?.onViolation?.(text, resolved);
            return;
          }

          resourceMap.set(
            path.join(prefix, file['@_alias'] ?? text).replace(/\\/g, '/'),
            resolved
          );
        });
      });

      return resourceMap;
    } catch (error) {
      throw new Error(`Cannot parse QRC file: ${error as string}`);
    }
  }
}

// Returns a containment check over the union of `roots`, resolving symlinks
// like assertInside but amortized for many candidates: each root is
// realpathed once and directory realpaths are memoized, since entries
// cluster in few directories. A candidate that does not exist is resolved
// through its deepest existing ancestor, so not-yet-built files inside a
// root still pass. Roots that do not exist cannot contain anything.
function createContainmentChecker(roots: string[]) {
  const realRoots: string[] = [];
  for (const root of roots) {
    try {
      realRoots.push(fs.realpathSync.native(root));
    } catch {
      // skip missing roots
    }
  }

  const dirCache = new Map<string, string | undefined>();
  const resolveDir = (dir: string): string | undefined => {
    if (dirCache.has(dir)) {
      return dirCache.get(dir);
    }
    let real: string | undefined;
    try {
      real = fs.realpathSync.native(dir);
    } catch {
      const parent = path.dirname(dir);
      if (parent !== dir) {
        const realParent = resolveDir(parent);
        real =
          realParent === undefined
            ? undefined
            : path.join(realParent, path.basename(dir));
      }
    }
    dirCache.set(dir, real);
    return real;
  };

  const inside = (rootReal: string, candidateReal: string) => {
    const rel = path.relative(rootReal, candidateReal);
    return !(
      rel === '..' ||
      rel.startsWith(`..${path.sep}`) ||
      path.isAbsolute(rel)
    );
  };

  return (candidate: string): boolean => {
    let real: string | undefined;
    try {
      real = fs.realpathSync.native(candidate);
    } catch {
      const realParent = resolveDir(path.dirname(candidate));
      real =
        realParent === undefined
          ? undefined
          : path.join(realParent, path.basename(candidate));
    }
    if (real === undefined) {
      return false;
    }
    const resolved = real;
    return realRoots.some((root) => inside(root, resolved));
  };
}
