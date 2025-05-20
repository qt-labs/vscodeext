// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export interface ErrorResponse {
  error: string;
  details?: Issue[];
}

export interface Issue {
  level: string;
  field: string;
  message: string;
}

// type guard functions
export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const maybe = obj as Partial<ErrorResponse>;
  const errorOk = typeof maybe.error === 'string';
  const detailsOk =
    maybe.details === undefined ||
    (Array.isArray(maybe.details) && maybe.details.every(isIssue));

  return errorOk && detailsOk;
}

export function isIssue(obj: unknown): obj is Issue {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const maybe = obj as Partial<Issue>;

  return (
    typeof maybe.level === 'string' &&
    typeof maybe.field === 'string' &&
    typeof maybe.message === 'string'
  );
}
