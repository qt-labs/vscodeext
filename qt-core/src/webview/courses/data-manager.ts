// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import _ from 'lodash';
import axios from 'axios';

import { createLogger } from 'qt-lib';
import { isCatalog, type CourseData } from '@/webview/shared/courses';
import * as consts from './constants';

const logger = createLogger('courses-data-manager');

export class CoursesDataManager {
  private _courses: CourseData[] = [];

  public get courses() {
    return this._courses;
  }

  public async load() {
    const r = await fetchCatalog();
    if (!isCatalog(r)) {
      return;
    }

    const raw = [
      ...r.courses.map((c) => ({ type: 'course', ...c }) as CourseData),
      ...r.learningPaths.map(
        (c) => ({ type: 'learningpath', ...c }) as CourseData
      )
    ];

    this._courses = raw.filter((c) => {
      return !!_.get(c, 'cataloged', false);
    });
  }

  public async ensureLoaded() {
    if (this._courses.length === 0) {
      await this.load();
    }
  }
}

// helpers
async function fetchCatalog() {
  try {
    const res = await axios.get(consts.CATALOG_JSON_URL, { timeout: 10_000 });
    return res.data as unknown;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      logger.error(
        [
          'HTTP error:',
          String(err.response?.status),
          String(err.response?.statusText)
        ].join(', ')
      );
    } else {
      logger.error(`Unexpected error: ${String(err)}`);
    }

    return undefined;
  }
}
