// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { createLogger, type QtBridgeQmlMetadata } from 'qt-lib';
import { canonicalPath } from '@/utils.mjs';

const logger = createLogger('qtbridge-metadata');
const METADATA_FILE_NAME = 'qtbridge-qml.ide.json';
const METADATA_SELECTIONS_KEY = 'qtBridgeMetadataSelections';

interface MetadataJson {
  version?: unknown;
  projectFile?: unknown;
  configuration?: unknown;
  targetFramework?: unknown;
  application?: Record<string, unknown>;
  qml?: Record<string, unknown>;
  qmlLanguageServer?: Record<string, unknown>;
}

export interface QtBridgeMetadataDiscoveryResult {
  readonly metadata: QtBridgeQmlMetadata | undefined;
  readonly isReady: boolean;
  readonly readyFiles: readonly string[];
  readonly candidates: readonly QtBridgeQmlMetadata[];
  readonly isAmbiguous: boolean;
}

export interface QtBridgeMetadataCandidateIdentity {
  readonly projectFile: string;
  readonly configuration: string;
  readonly targetFramework: string | undefined;
  readonly metadataFile: string;
}

export interface QtBridgeMetadataDiscoveryOptions {
  readonly explicitSelection?: QtBridgeMetadataCandidateIdentity;
  readonly requestedConfiguration?: string;
  readonly requestedTargetFramework?: string;
  readonly previousMetadataFile?: string;
  readonly previousReadyMetadata?: QtBridgeQmlMetadata;
}

export function getQtBridgeMetadataIdentity(
  metadata: QtBridgeQmlMetadata
): QtBridgeMetadataCandidateIdentity {
  return {
    projectFile: metadata.projectFile,
    configuration: metadata.configuration,
    targetFramework: metadata.targetFramework,
    metadataFile: metadata.metadataFile
  };
}

function matchesIdentity(
  candidate: QtBridgeQmlMetadata,
  identity: QtBridgeMetadataCandidateIdentity
) {
  return (
    typeof identity.projectFile === 'string' &&
    typeof identity.configuration === 'string' &&
    typeof identity.metadataFile === 'string' &&
    canonicalPath(candidate.projectFile) ===
      canonicalPath(identity.projectFile) &&
    candidate.configuration === identity.configuration &&
    candidate.targetFramework === identity.targetFramework &&
    canonicalPath(candidate.metadataFile) === canonicalPath(identity.metadataFile)
  );
}

export function getPersistedQtBridgeMetadataSelection(
  workspaceState: vscode.Memento | undefined,
  projectFile: string
): QtBridgeMetadataCandidateIdentity | undefined {
  const selections = workspaceState?.get<
    Record<string, QtBridgeMetadataCandidateIdentity>
  >(METADATA_SELECTIONS_KEY);
  return selections?.[canonicalPath(projectFile)];
}

export async function persistQtBridgeMetadataSelection(
  workspaceState: vscode.Memento,
  selection: QtBridgeMetadataCandidateIdentity
) {
  const selections = workspaceState.get<
    Record<string, QtBridgeMetadataCandidateIdentity>
  >(METADATA_SELECTIONS_KEY, {});
  await workspaceState.update(METADATA_SELECTIONS_KEY, {
    ...selections,
    [canonicalPath(selection.projectFile)]: selection
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) {
    return undefined;
  }
  return [...value];
}

const APPLICATION_FIELD_NAMES = [
  'assemblyName',
  'executableName',
  'managedOutputDir',
  'managedHostPath',
  'nativeHostPath'
] as const;

const QML_FILE_FIELD_NAMES = [
  'sourcePath',
  'uri',
  'typeName',
  'modulePath',
  'resourceUrl'
] as const;

function missingFields(
  value: Record<string, unknown>,
  fieldNames: readonly string[]
): string[] {
  return fieldNames.filter((name) => !isNonEmptyString(value[name]));
}

// Preview needs the application and the QML file list; qmlls does not. Both
// are therefore dropped instead of rejecting the whole metadata, which would
// take the language server down with them. Dropping them silently is what
// makes a stale or mismatched Qt Bridge package look exactly like a project
// that simply has no QML, so say what was wrong and what it costs.
function parseApplication(metadataFile: string, value: unknown) {
  if (!value || typeof value !== 'object') {
    if (value !== undefined) {
      logger.warn(
        `Ignoring the application section of ${metadataFile}: expected an ` +
          `object; QML Preview and profiling stay unavailable`
      );
    }
    return undefined;
  }
  const application = value as Record<string, unknown>;
  const assemblyName = application.assemblyName;
  const executableName = application.executableName;
  const managedOutputDir = application.managedOutputDir;
  const managedHostPath = application.managedHostPath;
  const nativeHostPath = application.nativeHostPath;
  if (
    !isNonEmptyString(assemblyName) ||
    !isNonEmptyString(executableName) ||
    !isNonEmptyString(managedOutputDir) ||
    !isNonEmptyString(managedHostPath) ||
    !isNonEmptyString(nativeHostPath)
  ) {
    logger.warn(
      `Ignoring the application section of ${metadataFile}: missing or empty ` +
        `${missingFields(application, APPLICATION_FIELD_NAMES).join(', ')}; ` +
        `QML Preview and profiling stay unavailable`
    );
    return undefined;
  }
  return {
    assemblyName,
    executableName,
    managedOutputDir,
    managedHostPath,
    nativeHostPath
  };
}

function parseQmlFiles(metadataFile: string, value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    logger.warn(
      `Ignoring the QML file list of ${metadataFile}: expected an array; ` +
        `QML Preview stays unavailable`
    );
    return undefined;
  }

  const files = [];
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') {
      logger.warn(
        `Ignoring the QML file list of ${metadataFile}: entry ` +
          `${String(index)} is not an object; QML Preview stays unavailable`
      );
      return undefined;
    }
    const file = entry as Record<string, unknown>;
    const { sourcePath, uri, typeName, modulePath, resourceUrl } = file;
    if (
      !isNonEmptyString(sourcePath) ||
      !isNonEmptyString(uri) ||
      !isNonEmptyString(typeName) ||
      !isNonEmptyString(modulePath) ||
      !isNonEmptyString(resourceUrl)
    ) {
      // The list is generated as a whole, so one incomplete entry means the
      // generator disagrees with this extension rather than that a single
      // file is special. Keeping the remaining entries would preview an
      // application whose QML is only partly reachable.
      logger.warn(
        `Ignoring the QML file list of ${metadataFile}: entry ` +
          `${String(index)}${
            isNonEmptyString(sourcePath) ? ` (${sourcePath})` : ''
          } is missing or has empty ` +
          `${missingFields(file, QML_FILE_FIELD_NAMES).join(', ')}; ` +
          `QML Preview stays unavailable because the generated metadata is ` +
          `incomplete. The metadata may be stale, corrupt, or incompatible ` +
          `with this extension. Rebuild the project and try again.`
      );
      return undefined;
    }
    files.push({
      sourcePath,
      uri,
      typeName,
      modulePath,
      resourceUrl
    });
  }
  return files;
}

function parseMetadata(
  metadataFile: string,
  expectedProjectFile: string,
  json: MetadataJson
): QtBridgeQmlMetadata | undefined {
  if (
    json.version !== 1 ||
    !isNonEmptyString(json.projectFile) ||
    canonicalPath(json.projectFile) !== canonicalPath(expectedProjectFile) ||
    !isNonEmptyString(json.configuration) ||
    !json.qml ||
    !isNonEmptyString(json.qml.sourceDir) ||
    !isNonEmptyString(json.qml.projectSourceDir)
  ) {
    return undefined;
  }

  const buildDirs = parseStringArray(json.qml.buildDirs);
  const importPaths = parseStringArray(json.qml.importPaths);
  if (!buildDirs?.length || !importPaths) {
    return undefined;
  }

  const languageServer = json.qmlLanguageServer;
  const qmlLanguageServer =
    languageServer &&
    typeof languageServer.disableCMakeCalls === 'boolean' &&
    isNonEmptyString(languageServer.readyFile) &&
    isNonEmptyString(languageServer.buildIni)
      ? {
          disableCMakeCalls: languageServer.disableCMakeCalls,
          readyFile: languageServer.readyFile,
          buildIni: languageServer.buildIni,
          projectSourcesQrc: isNonEmptyString(languageServer.projectSourcesQrc)
            ? languageServer.projectSourcesQrc
            : undefined
        }
      : undefined;

  return {
    metadataFile,
    version: json.version,
    projectFile: json.projectFile,
    configuration: json.configuration,
    targetFramework: isNonEmptyString(json.targetFramework)
      ? json.targetFramework
      : undefined,
    application: parseApplication(metadataFile, json.application),
    qml: {
      sourceDir: json.qml.sourceDir,
      projectSourceDir: json.qml.projectSourceDir,
      buildDirs,
      importPaths,
      files: parseQmlFiles(metadataFile, json.qml.files) ?? []
    },
    qmlLanguageServer
  };
}

async function readCandidate(
  metadataFile: vscode.Uri,
  projectFile: string
): Promise<QtBridgeQmlMetadata | undefined> {
  try {
    const content = await fs.promises.readFile(metadataFile.fsPath, 'utf8');
    const metadata = parseMetadata(
      metadataFile.fsPath,
      projectFile,
      JSON.parse(content) as MetadataJson
    );
    if (!metadata) {
      logger.info(
        `Ignoring invalid or mismatched metadata: ${metadataFile.fsPath}`
      );
    }
    return metadata;
  } catch (error) {
    logger.warn(
      `Failed to read metadata ${metadataFile.fsPath}: ${String(error)}`
    );
    return undefined;
  }
}

export async function discoverQtBridgeMetadata(
  projectFile: vscode.Uri,
  options: QtBridgeMetadataDiscoveryOptions = {}
): Promise<QtBridgeMetadataDiscoveryResult> {
  const projectDirectory = path.dirname(projectFile.fsPath);
  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(projectDirectory, `obj/**/${METADATA_FILE_NAME}`),
    null
  );
  const candidates = (
    await Promise.all(
      files.map(async (file) => readCandidate(file, projectFile.fsPath))
    )
  )
    .filter((value): value is QtBridgeQmlMetadata => value !== undefined)
    .sort((left, right) =>
      canonicalPath(left.metadataFile).localeCompare(
        canonicalPath(right.metadataFile)
      )
    );
  const readyFiles = candidates
    .map((candidate) => candidate.qmlLanguageServer?.readyFile)
    .filter((value): value is string => value !== undefined);
  const readyCandidates = candidates.filter((candidate) => {
    const readyFile = candidate.qmlLanguageServer?.readyFile;
    return readyFile !== undefined && fs.existsSync(readyFile);
  });
  const explicitSelection = options.explicitSelection;
  const explicit = explicitSelection
    ? candidates.find((candidate) =>
        matchesIdentity(candidate, explicitSelection)
      )
    : undefined;
  const buildMatches =
    options.requestedConfiguration !== undefined ||
    options.requestedTargetFramework !== undefined
      ? candidates.filter(
          (candidate) =>
            (!options.requestedConfiguration ||
              candidate.configuration === options.requestedConfiguration) &&
            (!options.requestedTargetFramework ||
              candidate.targetFramework === options.requestedTargetFramework)
        )
      : [];
  const requested = buildMatches.length === 1 ? buildMatches[0] : undefined;
  const previousMetadataFile = options.previousMetadataFile;
  const previous = previousMetadataFile
    ? candidates.find(
        (candidate) =>
          canonicalPath(candidate.metadataFile) ===
          canonicalPath(previousMetadataFile)
      )
    : undefined;

  const selectedMetadata =
    explicit ??
    requested ??
    previous ??
    (candidates.length === 1 ? candidates[0] : undefined);
  const selectedIsReady =
    selectedMetadata !== undefined &&
    readyCandidates.some(
      (candidate) =>
        canonicalPath(candidate.metadataFile) ===
        canonicalPath(selectedMetadata.metadataFile)
    );
  const previousReadyMetadata = options.previousReadyMetadata;
  const retainPrevious =
    !selectedIsReady &&
    selectedMetadata !== undefined &&
    previousReadyMetadata !== undefined &&
    canonicalPath(selectedMetadata.metadataFile) ===
      canonicalPath(previousReadyMetadata.metadataFile);
  const metadata = retainPrevious ? previousReadyMetadata : selectedMetadata;

  logger.info(
    `Metadata discovery for ${projectFile.fsPath}: ` +
      `valid=${String(candidates.length)}; ready=${String(readyCandidates.length)}; ` +
      `selected=${metadata?.metadataFile ?? '<none>'}`
  );
  return {
    metadata,
    isReady: selectedIsReady || retainPrevious,
    readyFiles,
    candidates,
    isAmbiguous: metadata === undefined && candidates.length > 1
  };
}
