// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import {
  workspace,
  ConfigurationScope,
  ConfigurationTarget,
  WorkspaceConfiguration,
  ConfigurationChangeEvent
} from 'vscode';

export class SettingSection {
  constructor(
    private readonly _name: string,
    private readonly _scope?: ConfigurationScope
  ) {}

  public get name() {
    return this._name;
  }

  public affectedBy(e: ConfigurationChangeEvent) {
    return e.affectsConfiguration(this._name, this._scope);
  }

  public item<T>(key: string) {
    return new SettingItem<T>(this._name, key, this._scope);
  }

  public itemBool = (key: string) => this.item<boolean>(key);
  public itemString = (key: string) => this.item<string>(key);
  public itemStringArray = (key: string) => this.item<string[]>(key);
}

export class SettingItem<T = unknown> {
  constructor(
    private readonly _section: string,
    private readonly _key: string,
    private readonly _scope?: ConfigurationScope
  ) {}

  public get name() {
    return `${this._section}.${this._key}`;
  }

  public get config(): WorkspaceConfiguration {
    return workspace.getConfiguration(this._section, this._scope);
  }

  public get(): T | undefined;
  public get(defaultValue: T): T;
  public get(defaultValue?: T) {
    return this.config.get<T>(this._key, defaultValue as T);
  }

  public inspect() {
    return this.config.inspect<T>(this._key);
  }

  public update(
    value: T | undefined,
    target?: ConfigurationTarget | boolean | null,
    overrideInLanguage?: boolean
  ): Thenable<void> {
    return this.config.update(this._key, value, target, overrideInLanguage);
  }

  public updateGlobal(value: T | undefined, overrideInLanguage?: boolean) {
    return this.update(value, ConfigurationTarget.Global, overrideInLanguage);
  }

  public affectedBy(e: ConfigurationChangeEvent) {
    return e.affectsConfiguration(`${this._section}.${this._key}`, this._scope);
  }
}
