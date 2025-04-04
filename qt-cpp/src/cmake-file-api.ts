// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export interface Target {
  artifacts: Artifact[];
  backtrace: number;
  backtraceGraph: BacktraceGraph;
  compileGroups: CompileGroup[];
  dependencies: Dependency[];
  id: string;
  link: Link;
  name: string;
  nameOnDisk: string;
  paths: Paths;
  sourceGroups: SourceGroup[];
  sources: Source[];
  type: string;
}

interface Artifact {
  path: string;
}

interface BacktraceGraph {
  commands: string[];
  files: string[];
  nodes: Node[];
}

interface Node {
  file?: number;
  command?: number;
  line?: number;
  parent?: number;
}

interface CompileGroup {
  compileCommandFragments: CompileCommandFragment[];
  defines: Define[];
  frameworks: Framework[];
  includes: Include[];
  language: string;
  languageStandard: LanguageStandard;
  sourceIndexes: number[];
}

interface CompileCommandFragment {
  fragment: string;
}

interface Define {
  backtrace: number;
  define: string;
}

interface Framework {
  backtrace: number;
  isSystem: boolean;
  path: string;
}

interface Include {
  backtrace: number;
  path: string;
  isSystem?: boolean;
}

interface LanguageStandard {
  backtraces: number[];
  standard: string;
}

interface Dependency {
  backtrace?: number;
  id: string;
}

interface Link {
  commandFragments: CommandFragment[];
  language: string;
}

interface CommandFragment {
  fragment: string;
  role: string;
  backtrace?: number;
}

interface Paths {
  build: string;
  source: string;
}

interface SourceGroup {
  name: string;
  sourceIndexes: number[];
}

interface Source {
  backtrace: number;
  compileGroupIndex?: number;
  isGenerated?: boolean;
  path: string;
  sourceGroupIndex: number;
}
