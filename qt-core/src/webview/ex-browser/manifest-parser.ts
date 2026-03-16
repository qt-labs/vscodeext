// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import { XMLParser } from 'fast-xml-parser';

import { fsFile } from '@/fs-utils';
import { ExEntry } from '@/webview/shared/ex-browser';
import * as consts from './constants';

const textNode = '_text';
const attrsGroupName = '_attributes';

const xmlOptions = {
  // attributes
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: attrsGroupName,

  // text
  textNodeName: textNode,
  alwaysCreateTextNode: true,

  // tag
  isArray: (
    tagName: string,
    _jPath: string,
    _isLeafNode: boolean,
    _isAttribute: boolean
  ): boolean => {
    void _jPath;
    void _isLeafNode;
    void _isAttribute;

    return (
      tagName === 'demo' ||
      tagName === 'example' ||
      tagName === 'fileToOpen' ||
      tagName === 'entry'
    );
  }
};

export type ManifestType = 'demo' | 'example';

export function parseManifestFile(
  absPath: string,
  type: ManifestType
): ExEntry[] {
  const parser = new XMLParser(xmlOptions);
  const ajson: unknown = parser.parse(fsFile(absPath).readAll());

  // <?xml version="1.0" encoding="UTF-8"?>
  // <instructionals module="Qt...">
  // <examples (or demos)>
  //   <example (or demo)
  //      docUrl="qthelp://org.qt-project.qtcharts.6110/qtcharts/....html"
  //      imageUrl="qthelp://org.qt-project.qtcharts.6110/qtcharts/...png"
  //      name="Charts with QML Gallery"
  //      projectPath="charts/qmlchartsgallery/CMakeLists.txt"
  //      isHighlighted="true"
  //   >
  //     <description><![CDATA[Demonstrates how to...]]></description>
  //     <tags>tag1,tag2,my tag3,...</tags>
  //     <fileToOpen>...main.cpp</fileToOpen>
  //     <fileToOpen mainFile="true">...Main.qml</fileToOpen>
  //     <meta>
  //         <entry name="category">Mobile</entry>
  //         <entry name="category">Data Visualization</entry>
  //     </meta>
  //   </example (or demo)>
  // ...

  const tagPath =
    type === 'demo'
      ? 'instructionals.demos.demo'
      : 'instructionals.examples.example';
  const items = _.get(ajson, tagPath, []);
  if (!Array.isArray(items)) {
    return [];
  }

  const module = String(
    _.get(ajson, `instructionals.${attrsGroupName}.module`, '')
  ).trim();

  return items.map((example) => {
    const attrs = _.get(example, attrsGroupName, {});
    const raw: ExEntry = {
      name: String(_.get(attrs, 'name', '')).trim(),
      module: module,
      description: String(_.get(example, `description.${textNode}`, '')).trim(),
      docUrl: String(_.get(attrs, 'docUrl', '')).trim(),
      imageUrl: String(_.get(attrs, 'imageUrl', '')).trim(),
      highlighted: Boolean(_.get(attrs, 'isHighlighted', '')),
      projectPath: String(_.get(attrs, 'projectPath', '')).trim(),
      filesToOpen: parseFilesToOpen(_.get(example, 'fileToOpen', [])),
      tags: parseTags(String(_.get(example, `tags.${textNode}`, ''))),
      categories: parseCategories(_.get(example, 'meta.entry', []))
    };

    if (type === 'demo') {
      includeDemoTagsAndCategories(raw);
    }

    return raw;
  });
}

function parseFilesToOpen(fileToOpenArray: unknown): string[] {
  // <?xml version="1.0" encoding="UTF-8"?>
  // <instructionals module="Qt...">
  // <examples>
  //   <example>
  //     <description><![CDATA[Demonstrates how to...]]></description>
  //     <tags>tag1,tag2,tag3,...</tags>
  //     <fileToOpen>...main.cpp</fileToOpen>
  //     <fileToOpen mainFile="true">...Main.qml</fileToOpen>
  //.    ...
  //   </example>
  // ...

  if (!Array.isArray(fileToOpenArray)) {
    return [];
  }

  const files: string[] = [];

  fileToOpenArray.forEach((f) => {
    const n = _.get(f, textNode, '') as string;
    const main = Boolean(_.get(f, `${attrsGroupName}.mainFile`, ''));

    if (main) {
      files.unshift(n);
    } else {
      files.push(n.trim());
    }
  });

  return files;
}

function parseTags(tagsText: string): string[] {
  // <?xml version="1.0" encoding="UTF-8"?>
  // <instructionals module="Qt...">
  // <examples>
  //   <example>
  //     <description><![CDATA[Demonstrates how to...]]></description>
  //     <tags>tag1,tag2,my tag3,...</tags>
  //     ...
  //   </example>
  // ...

  return tagsText
    .split(',')
    .map((t) => t.trim().replace(/\s/g, '-'))
    .filter((t) => t.length !== 0);
}

function parseCategories(allMetaEntries: unknown): string[] {
  // <instructionals module="Qt...">
  // <examples>
  //   <example>
  //     <meta>
  //         <entry name="category">Mobile</entry>
  //         <entry name="category">Data Visualization</entry>
  //         <entry name="category">Cat1, Cat2</entry>
  //         ...
  //     </meta>
  // ...

  if (!Array.isArray(allMetaEntries)) {
    return [];
  }

  const categories: string[] = [];

  allMetaEntries.forEach((e) => {
    const name = _.get(e, `${attrsGroupName}.name`, '') as string;
    const value = _.get(e, textNode, '') as string;
    if (name !== 'category') {
      return;
    }

    // sometimes a single cateogry contains multiple entries in it.
    const split = value.split(',');
    split.forEach((s) => {
      const candidate = s.trim();
      if (candidate) {
        categories.push(candidate);
      }
    });
  });

  return categories;
}

function includeDemoTagsAndCategories(entry: ExEntry) {
  if (!entry.categories.includes(consts.DEMO_INJECTED_CATEGORY_NAME)) {
    entry.categories.push(consts.DEMO_INJECTED_CATEGORY_NAME);
  }

  if (!entry.tags.includes(consts.DEMO_INJECTED_TAG_NAME)) {
    entry.tags.push(consts.DEMO_INJECTED_TAG_NAME);
  }
}
