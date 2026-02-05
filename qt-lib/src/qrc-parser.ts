// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

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

  parseQRCFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot find file: ${filePath}`);
    }
    const cachedContent = this._cache.get(filePath);
    if (cachedContent) {
      return cachedContent;
    }
    const xmlContent = fs.readFileSync(filePath, 'utf8');
    const fileMapping = this.parseQRC(xmlContent, path.dirname(filePath));
    if (!fileMapping) {
      return undefined;
    }
    this._cache.set(filePath, fileMapping);
    return fileMapping;
  }

  parseQRC(xmlContent: string, qrcDir: string) {
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

      // Loop through each <qresource> and add its files to the map
      resourcesArray.forEach((resource) => {
        const prefix = resource['@_prefix'] || '';
        const files = Array.isArray(resource.file)
          ? resource.file
          : [resource.file];

        files.forEach((file) => {
          // Only keep .qml and .js files
          const text = file['#text'];
          if (!text || (!text.endsWith('.qml') && !text.endsWith('.js'))) {
            return;
          }

          resourceMap.set(
            path.join(prefix, file['@_alias'] ?? text).replace(/\\/g, '/'),
            path.isAbsolute(text) ? text : path.join(qrcDir, text)
          );
        });
      });

      return resourceMap;
    } catch (error) {
      throw new Error(`Cannot parse QRC file: ${error as string}`);
    }
  }
}
