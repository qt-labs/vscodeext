// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import XMLBuilder from 'fast-xml-builder';
import { XMLParser } from 'fast-xml-parser';
import type { JPathOrMatcher } from 'fast-xml-parser';

import {
  type RccTag,
  QResourceTag,
  FileTag,
  isRccTag,
  isAttributes
} from '@/webview/shared/qrc-types';
import { cleanTagDeep } from './utils';

const xmlOptions = {
  // attributes
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: 'attributes',

  // text
  textNodeName: 'text',
  alwaysCreateTextNode: true,

  // tag
  isArray: (
    tagName: string,
    _jPath: JPathOrMatcher,
    _isLeafNode: boolean,
    _isAttribute: boolean
  ): boolean => {
    void _jPath;
    void _isLeafNode;
    void _isAttribute;

    return tagName === 'file' || tagName === 'qresource';
  }
};

export function parseXml(data: string): RccTag | undefined {
  const parser = new XMLParser(xmlOptions);
  const asJson: unknown = parser.parse(data);
  if (typeof asJson !== 'object' || asJson === null || !('RCC' in asJson)) {
    return undefined;
  }

  const rcc: unknown = asJson.RCC;
  normalizeRccTag(rcc);
  if (!isRccTag(rcc)) {
    return undefined;
  }

  return rcc;
}

export function generateXml(qrc: RccTag): string {
  const builder = new XMLBuilder({
    format: true,
    indentBy: '    ', // to be compatible with Qt Creator
    suppressEmptyNode: true, // to be compatible with Qt Creator
    suppressBooleanAttributes: false,
    ...xmlOptions
  });

  const clone = cloneAndClean(qrc);
  const xmlString = builder.build({ RCC: clone });

  return xmlString;
}

export function defaultQrcLines() {
  return ['<RCC>', '    <qresource prefix="/"/>', '</RCC>', ''];
}

// helpers
function cloneAndClean(qrc: RccTag): RccTag {
  const clone = _.cloneDeep(qrc);
  cleanTagDeep(clone);

  return clone;
}

function normalizeRccTag(x: unknown) {
  if (!isRccTagLike(x)) {
    return;
  }

  x.attributes ??= {};
  x.qresource ??= [];
  x.qresource.forEach((qres: Partial<QResourceTag>) => {
    if (isQResourceTagLike(qres)) {
      qres.attributes ??= {};
      qres.file ??= [];
      qres.file.forEach((f: Partial<FileTag>) => {
        if (isFileTagLike(f)) {
          const file = f;
          file.attributes ??= {};
        }
      });
    }
  });
}

function isRccTagLike(x: unknown): x is Partial<RccTag> {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  if ('qresource' in o) {
    if (!Array.isArray(o.qresource)) {
      return false;
    }
    if (!o.qresource.every(isQResourceTagLike)) {
      return false;
    }
  }

  return !('attributes' in o) || isAttributes(o.attributes);
}

function isQResourceTagLike(x: unknown): x is Partial<QResourceTag> {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  if ('file' in o) {
    if (!Array.isArray(o.file)) {
      return false;
    }
    if (!o.file.every(isFileTagLike)) {
      return false;
    }
  }

  return !('attributes' in o) || isAttributes(o.attributes);
}

function isFileTagLike(x: unknown): x is Partial<FileTag> {
  if (typeof x !== 'object' || x === null) {
    return false;
  }

  const o = x as Record<string, unknown>;
  if (!('text' in o) || typeof o.text !== 'string') {
    return false;
  }

  return !('attributes' in o) || isAttributes(o.attributes);
}
