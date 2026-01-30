// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export class DebuggerCommand {
  private _func: string;
  private _args: object | null = null;
  constructor(func: string) {
    this._func = func;
  }
  set function(func: string) {
    this._func = func;
  }
  get function() {
    return this._func;
  }
  arg(name: string, value: unknown) {
    this._args ??= {};
    this._args = addtoJson(this._args, name, value);
    return this;
  }
  get args() {
    return this._args;
  }
}

// addToJsonObject equivalent
function addtoJson(args: object, key: string, value: unknown) {
  const newJson = { ...args, [key]: value };
  return newJson;
}
