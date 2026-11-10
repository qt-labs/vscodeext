// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { ConfigurationScope } from 'vscode';

import { QtInsRootConfigName, AdditionalQtPathsName } from '../constants';
import { SettingSection } from './setting-section';

const sm = new SettingSection('qt-sm');
const core = new SettingSection('qt-core');
const qml = new SettingSection('qt-qml');
const cpp = new SettingSection('qt-cpp');
const csharp = new SettingSection('qt-csharp');
const python = new SettingSection('qt-python');

export const smSettings = {
  getStartedDone: sm.itemBool('getStartedDone')
};

export const coreSettings = {
  insRoot: core.itemString(QtInsRootConfigName),
  additionalQtPaths: core.item<(string | object)[]>(AdditionalQtPathsName),
  skipVcpkgPrompt: core.itemBool('doNotAskForVCPKG'),
  skipDefaultInsRootPrompt: core.itemBool(
    'doNotAskForDefaultQtInstallationRoot'
  ),
  enableQrcEditor: core.itemBool('enableQrcEditor'),
  showWelcomePage: core.itemBool('showWelcomePageOnActivation'),
  defaultProjectDir: core.itemString('defaultProjectDirectory'),
  openDocExt: core.itemBool('openOnlineDocumentationInExternalBrowser'),

  forScope: (scope?: ConfigurationScope) => {
    const scoped = new SettingSection(core.name, scope);
    return {
      insRoot: scoped.itemString(QtInsRootConfigName),
      customUiDesigner: scoped.itemString('customWidgetsDesignerExePath'),
      additionalQtPaths: scoped.item<(string | object)[]>(AdditionalQtPathsName)
    };
  }
};

export const cppSettings = {
  skipCMakePathPrompt: cpp.itemBool('doNotAskForCMakePath'),
  skipOldCMakeWarning: cpp.itemBool('doNotWarnOutdatedCMakeTools'),
  skipMissingSrcDirWarning: cpp.itemBool('doNotWarnMissingSourceDir'),

  forScope: (scope?: ConfigurationScope) => {
    const scoped = new SettingSection(cpp.name, scope);
    return {
      skipAutoKitGen: scoped.itemBool('disableAutoKitGenerationOnOpen')
    };
  }
};

export const qmlSettings = {
  skipQmllsDownload: qml.itemBool('doNotAskForQmllsDownload'),
  customTraceViewer: qml.itemString('customTraceViewerExePath'),

  qmllsFor: (scope?: ConfigurationScope) => {
    const scoped = new SettingSection(`${qml.name}.qmlls`, scope);
    return {
      section: scoped,
      enabled: scoped.itemBool('enabled'),
      customArgs: scoped.itemStringArray('customArgs'),
      customExePath: scoped.itemString('customExePath'),
      customDocsPath: scoped.itemString('customDocsPath'),
      traceLsp: scoped.itemString('traceLsp'),
      verboseOutput: scoped.itemString('verboseOutput'),
      additionalImportPaths: scoped.itemStringArray('additionalImportPaths'),
      useQmlImportPathEnvVar: scoped.itemBool('useQmlImportPathEnvVar'),
      useNoCMakeCalls: scoped.itemBool('useNoCMakeCalls')
    };
  },

  preview: (() => {
    const section = new SettingSection(`${qml.name}.preview`);
    return {
      args: section.itemStringArray('args'),
      additionalBuildDirs: section.itemStringArray('additionalBuildDirs')
    };
  })(),

  profiler: (() => {
    const section = new SettingSection(`${qml.name}.profiler`);
    return {
      args: section.itemStringArray('args')
    };
  })()
};

export const csharpSettings = {
  qtDir: csharp.itemString('qtDir'),

  forScope: (scope?: ConfigurationScope) => {
    const scoped = new SettingSection(csharp.name, scope);
    return {
      qtDir: scoped.itemString('qtDir')
    };
  }
};

export const pythonSettings = {
  preferUv: python.itemBool('preferUv'),
  skipOldStyleWarning: python.itemBool('doNotWarnAboutOldStyleProjects')
};

export const vscodeSettings = (() => {
  const files = new SettingSection('files');
  const workbench = new SettingSection('workbench');

  return {
    dialogDefaultPath: files.itemString('dialog.defaultPath'),
    editorAssociations:
      workbench.item<Record<string, string>>('editorAssociations')
  };
})();
