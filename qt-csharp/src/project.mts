// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';
import {
  createLogger,
  type QtBridgePreviewLaunch,
  type QtBridgeProject,
  type QtBridgeQmlMetadata
} from 'qt-lib';

const logger = createLogger('qtbridge-project');

const PREVIEW_STAGING_DIR_NAME = 'qt-qml-preview';
const PREVIEW_STAGING_PREFIX = 'launch-';
const PREVIEW_STAGING_OWNER_FILE_NAME = '.qt-qml-preview-owner.json';
const DEFAULT_PREVIEW_STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const KNOWN_QT_BRIDGE_PACKAGE_PREFIX = 'QtGroup.Qt.Bridge.CSharp';
const TEMPLATED_QT_BRIDGE_PACKAGE_ID = '$(QtBridgePackageId)';

const KNOWN_IMPORTED_FILES = [
  'QtGroup.Qt.Bridge.CSharp.props',
  'QtGroup.Qt.Bridge.CSharp.targets',
  'Qt.Bridge.props',
  'Qt.Bridge.targets'
] as const;

const KNOWN_QT_BRIDGE_PROPERTY_NAMES = [
  'QtDotNetPropsImported',
  'QtQmlRootModule',
  'QtDotNetGen'
] as const;

export interface QtBridgeProjectInfo {
  readonly projectFile: string;
  readonly packageId: string | undefined;
  readonly packageVersion: string | undefined;
  readonly qtDir: string | undefined;
  readonly qtInstallRoot: string | undefined;
}

export interface QtBridgeQtDirFallbacks {
  readonly configuredQtDir?: string;
  readonly selectedQtDir?: string;
}

function normalizeQtDir(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalizeQtArchitecture(arch: string | undefined): string {
  switch ((arch ?? '').toLowerCase()) {
    case 'x86':
    case 'ia32':
      return 'x86';
    case 'arm64':
      return 'arm64';
    case 'x64':
    default:
      return 'x64';
  }
}

export function defaultQtRid(
  platform = process.platform,
  architecture = process.arch
): string | undefined {
  const arch = normalizeQtArchitecture(architecture);
  switch (platform) {
    case 'win32':
      return `win-${arch}`;
    case 'linux':
      return `linux-${arch}`;
    case 'darwin':
      return `osx-${arch}`;
    default:
      return undefined;
  }
}

function getEnvironmentVariable(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) {
      return value.trim();
    }
  }

  if (process.platform !== 'win32') {
    return undefined;
  }

  const lowerCaseLookup = new Map<string, string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      lowerCaseLookup.set(key.toLowerCase(), value);
    }
  }

  for (const name of names) {
    const value = lowerCaseLookup.get(name.toLowerCase());
    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

interface PackageReference {
  readonly include: string;
  readonly version: string | undefined;
}

interface ParsedProject {
  readonly properties: Map<string, string>;
  readonly packageReferences: readonly PackageReference[];
  readonly importedFiles: readonly string[];
}

function getXmlAttribute(node: unknown, attributeName: string) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return undefined;
  }

  const expectedName = `@_${attributeName}`.toLowerCase();
  for (const [name, value] of Object.entries(node as Record<string, unknown>)) {
    if (
      name.toLowerCase() === expectedName &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      return String(value).trim();
    }
  }
  return undefined;
}

function getXmlText(node: unknown): string | undefined {
  if (typeof node === 'string' || typeof node === 'number') {
    const value = String(node).trim();
    return value || undefined;
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return undefined;
  }

  const text = Object.entries(node as Record<string, unknown>).find(
    ([name]) => name.toLowerCase() === '#text'
  )?.[1];
  if (typeof text !== 'string' && typeof text !== 'number') {
    return undefined;
  }
  const value = String(text).trim();
  return value || undefined;
}

function getXmlChildText(node: unknown, childName: string) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return undefined;
  }

  const child = Object.entries(node as Record<string, unknown>).find(
    ([name]) => name.toLowerCase() === childName.toLowerCase()
  )?.[1];
  const firstChild = Array.isArray(child) ? (child as unknown[])[0] : child;
  return getXmlText(firstChild);
}

function parseProject(projectXml: string): ParsedProject {
  const parser = new XMLParser({
    ignoreAttributes: false,
    alwaysCreateTextNode: true,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true
  });
  const document = parser.parse(projectXml) as unknown;
  const properties = new Map<string, string>();
  const packageReferences: PackageReference[] = [];
  const importedFiles: string[] = [];

  const visit = (node: unknown, conditional = false) => {
    if (Array.isArray(node)) {
      node.forEach((value) => {
        visit(value, conditional);
      });
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }

    for (const [elementName, elementValue] of Object.entries(
      node as Record<string, unknown>
    )) {
      if (
        elementName.startsWith('@_') ||
        elementName === '#text' ||
        elementName.startsWith('?')
      ) {
        continue;
      }

      const values = Array.isArray(elementValue)
        ? elementValue
        : [elementValue];
      for (const value of values) {
        const isConditional =
          conditional || getXmlAttribute(value, 'Condition') !== undefined;
        const propertyValue = getXmlText(value);
        if (propertyValue && !isConditional) {
          properties.set(elementName.toLowerCase(), propertyValue);
        }

        if (elementName.toLowerCase() === 'packagereference') {
          const include = getXmlAttribute(value, 'Include');
          if (include) {
            packageReferences.push({
              include,
              version:
                getXmlAttribute(value, 'Version') ??
                getXmlChildText(value, 'Version')
            });
          }
        } else if (elementName.toLowerCase() === 'import') {
          const project = getXmlAttribute(value, 'Project');
          if (project) {
            importedFiles.push(project);
          }
        }
        visit(value, isConditional);
      }
    }
  };
  visit(document);
  return { properties, packageReferences, importedFiles };
}

function getMsBuildProperty(
  properties: Map<string, string>,
  propertyName: string
) {
  return properties.get(propertyName.toLowerCase());
}

function resolvePropertyExpression(
  value: string | undefined,
  properties: Map<string, string>
): string | undefined {
  if (!value) {
    return undefined;
  }

  let current = value.trim();
  for (let i = 0; i < 8; ++i) {
    const next = current.replace(
      /\$\(([A-Za-z_][\w.-]*)\)/g,
      (_match, propertyName: string) =>
        getMsBuildProperty(properties, propertyName) ?? _match
    );
    if (next === current) {
      break;
    }
    current = next;
  }

  return current.trim();
}

function getPackageReferenceVersion(
  packageReferences: readonly PackageReference[],
  packageInclude: string,
  properties: Map<string, string>
): string | undefined {
  const reference = packageReferences.find(
    ({ include }) => include.toLowerCase() === packageInclude.toLowerCase()
  );
  return resolvePropertyExpression(reference?.version, properties);
}

function isKnownQtBridgePackageId(packageId: string): boolean {
  return packageId
    .toLowerCase()
    .startsWith(`${KNOWN_QT_BRIDGE_PACKAGE_PREFIX.toLowerCase()}.`);
}

function isKnownImportedFile(importProject: string): boolean {
  return KNOWN_IMPORTED_FILES.some((knownFile) =>
    importProject.includes(knownFile)
  );
}

function hasKnownQtBridgeProperty(properties: Map<string, string>): boolean {
  return KNOWN_QT_BRIDGE_PROPERTY_NAMES.some(
    (propertyName) => getMsBuildProperty(properties, propertyName) !== undefined
  );
}

function inferQtBridgePackageId(
  packageReferences: readonly PackageReference[],
  properties: Map<string, string>
): string | undefined {
  const literalPackageId = packageReferences
    .map(({ include }) => include)
    .find(isKnownQtBridgePackageId);
  if (literalPackageId) {
    return literalPackageId;
  }

  if (
    !packageReferences.some(
      ({ include }) =>
        include.toLowerCase() === TEMPLATED_QT_BRIDGE_PACKAGE_ID.toLowerCase()
    )
  ) {
    return undefined;
  }

  const configuredPrefix =
    resolvePropertyExpression(
      getMsBuildProperty(properties, 'QtBridgePackagePrefix'),
      properties
    ) ?? KNOWN_QT_BRIDGE_PACKAGE_PREFIX;
  const packagePrefix = configuredPrefix.endsWith('.')
    ? configuredPrefix.slice(0, -1)
    : configuredPrefix;
  if (
    !KNOWN_QT_BRIDGE_PACKAGE_PREFIX.toLowerCase().startsWith(
      packagePrefix.toLowerCase()
    )
  ) {
    return undefined;
  }

  const configuredRid =
    resolvePropertyExpression(
      getMsBuildProperty(properties, 'QtBridgeTemplateRid'),
      properties
    ) ??
    resolvePropertyExpression(
      getMsBuildProperty(properties, 'QtRid'),
      properties
    ) ??
    resolvePropertyExpression(
      getMsBuildProperty(properties, 'RuntimeIdentifier'),
      properties
    ) ??
    defaultQtRid();
  if (!configuredRid) {
    return undefined;
  }

  return `${packagePrefix}.${configuredRid}`;
}

function inferProjectQtDir(
  properties: Map<string, string>
): string | undefined {
  const configuredQtDir = resolvePropertyExpression(
    getMsBuildProperty(properties, 'QtDir'),
    properties
  );
  if (configuredQtDir) {
    return configuredQtDir;
  }

  const configuredQtInstallRoot = resolvePropertyExpression(
    getMsBuildProperty(properties, 'QtInstallRoot'),
    properties
  );
  if (configuredQtInstallRoot) {
    return configuredQtInstallRoot;
  }

  return undefined;
}

export function resolveQtBridgeQtDir(
  projectQtDir: string | undefined,
  fallbacks: QtBridgeQtDirFallbacks = {},
  environmentQtDir = getEnvironmentVariable(['QTDIR', 'QtDir', 'QtInstallRoot'])
): string | undefined {
  return (
    normalizeQtDir(projectQtDir) ??
    normalizeQtDir(fallbacks.configuredQtDir) ??
    normalizeQtDir(environmentQtDir) ??
    normalizeQtDir(fallbacks.selectedQtDir)
  );
}

function findNuGetPackageVersionDirectory(
  packageRoot: string,
  packageVersion: string | undefined
): string | undefined {
  if (!fs.existsSync(packageRoot)) {
    return undefined;
  }

  if (packageVersion) {
    const exactPath = path.join(packageRoot, packageVersion);
    if (fs.existsSync(exactPath)) {
      return exactPath;
    }

    const lowerCasePath = path.join(packageRoot, packageVersion.toLowerCase());
    if (fs.existsSync(lowerCasePath)) {
      return lowerCasePath;
    }
  }

  const versions = fs
    .readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true })
    );
  return versions[0] ? path.join(packageRoot, versions[0]) : undefined;
}

function findBundledWindowsQtDir(
  packageId: string | undefined,
  packageVersion: string | undefined
): string | undefined {
  if (process.platform !== 'win32' || !packageId?.includes('.win-')) {
    return undefined;
  }

  const nugetPackagesRoot =
    process.env.NUGET_PACKAGES ?? path.join(os.homedir(), '.nuget', 'packages');
  const packageRoot = path.join(nugetPackagesRoot, packageId.toLowerCase());
  const packageVersionDirectory = findNuGetPackageVersionDirectory(
    packageRoot,
    packageVersion
  );
  if (!packageVersionDirectory) {
    return undefined;
  }

  const bundledQtDir = path.join(packageVersionDirectory, 'tools', 'qt');
  return fs.existsSync(path.join(bundledQtDir, 'qml'))
    ? bundledQtDir
    : undefined;
}

export function inspectQtBridgeProject(
  projectFile: vscode.Uri,
  qtDirFallbacks: QtBridgeQtDirFallbacks = {}
): QtBridgeProjectInfo | undefined {
  try {
    const projectXml = fs.readFileSync(projectFile.fsPath, 'utf8');
    const { properties, packageReferences, importedFiles } =
      parseProject(projectXml);
    const packageId = inferQtBridgePackageId(packageReferences, properties);

    const isQtBridgeProject =
      packageId !== undefined ||
      importedFiles.some(isKnownImportedFile) ||
      hasKnownQtBridgeProperty(properties);
    if (!isQtBridgeProject) {
      logger.info(
        `Project is not detected as Qt Bridge: ${projectFile.fsPath}`
      );
      return undefined;
    }

    const projectQtDir = inferProjectQtDir(properties);
    const projectInfo = {
      projectFile: projectFile.fsPath,
      packageId,
      packageVersion: packageId
        ? (getPackageReferenceVersion(
            packageReferences,
            TEMPLATED_QT_BRIDGE_PACKAGE_ID,
            properties
          ) ??
          getPackageReferenceVersion(packageReferences, packageId, properties))
        : undefined,
      qtDir: resolveQtBridgeQtDir(projectQtDir, qtDirFallbacks),
      qtInstallRoot: resolvePropertyExpression(
        getMsBuildProperty(properties, 'QtInstallRoot'),
        properties
      )
    };
    logger.info(
      `Detected Qt Bridge project: ${projectInfo.projectFile}; ` +
        `package=${projectInfo.packageId ?? '<none>'}; qtDir=${projectInfo.qtDir ?? '<none>'}`
    );
    return projectInfo;
  } catch (error) {
    logger.warn(
      `Failed to inspect project file for Qt Bridge detection ${projectFile.fsPath}: ${String(error)}`
    );
    return undefined;
  }
}

export function resolveQtBridgeQmlImportPath(
  project: QtBridgeProjectInfo | undefined
): string | undefined {
  if (!project) {
    logger.info(
      'Qt Bridge import-root resolution skipped because no Bridge project was detected'
    );
    return undefined;
  }

  const explicitQtDir = project.qtDir ?? project.qtInstallRoot;
  if (explicitQtDir) {
    const qmlDir = path.join(explicitQtDir, 'qml');
    if (fs.existsSync(qmlDir)) {
      logger.info(`Using explicit Qt Bridge Qt import root: ${qmlDir}`);
      return qmlDir;
    }
    logger.info(
      `Configured Qt path does not contain a qml directory: ${qmlDir}`
    );
  }

  // Only the Windows runtime package currently bundles a Qt installation.
  // Linux and macOS rely on an explicit QtDir/QTDIR-selected installation.
  const bundledQtDir = findBundledWindowsQtDir(
    project.packageId,
    project.packageVersion
  );
  if (bundledQtDir) {
    const qmlDir = path.join(bundledQtDir, 'qml');
    logger.info(`Using bundled Qt Bridge Qt import root: ${qmlDir}`);
    return qmlDir;
  }

  logger.info(
    `Could not resolve a Qt Bridge Qt import root for project: ${project.projectFile}`
  );
  return undefined;
}

function pathExists(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  platform: NodeJS.Platform
) {
  if (platform !== 'win32') {
    return environment[name];
  }
  const entry = Object.entries(environment).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return entry?.[1];
}

export function findDotNetPathEntry(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  architecture = process.arch
) {
  const executableName = platform === 'win32' ? 'dotnet.exe' : 'dotnet';
  const delimiter = platform === 'win32' ? ';' : ':';
  const inheritedPath = getEnvironmentValue(environment, 'PATH', platform);
  const inheritedEntries = (inheritedPath ?? '')
    .split(delimiter)
    .filter((entry) => entry.length > 0);
  if (
    inheritedEntries.some((entry) =>
      pathExists(path.join(entry, executableName))
    )
  ) {
    return undefined;
  }

  const dotNetHostPath = getEnvironmentValue(
    environment,
    'DOTNET_HOST_PATH',
    platform
  );
  if (dotNetHostPath && pathExists(dotNetHostPath)) {
    return path.dirname(path.resolve(dotNetHostPath));
  }

  let architectureRootName = 'DOTNET_ROOT_X64';
  if (architecture === 'arm64') {
    architectureRootName = 'DOTNET_ROOT_ARM64';
  } else if (architecture === 'ia32') {
    architectureRootName = 'DOTNET_ROOT_X86';
  }
  const candidates = [
    getEnvironmentValue(environment, architectureRootName, platform)
  ];
  if (platform === 'win32' && architecture === 'ia32') {
    candidates.push(
      getEnvironmentValue(environment, 'DOTNET_ROOT(x86)', platform)
    );
  }
  candidates.push(getEnvironmentValue(environment, 'DOTNET_ROOT', platform));
  if (platform === 'win32') {
    const programFiles =
      getEnvironmentValue(environment, 'ProgramFiles', platform) ??
      'C:\\Program Files';
    const programFilesX86 =
      getEnvironmentValue(environment, 'ProgramFiles(x86)', platform) ??
      'C:\\Program Files (x86)';
    const dotNetProgramFiles =
      architecture === 'ia32' ? programFilesX86 : programFiles;
    if (architecture === 'x64') {
      candidates.push(path.join(dotNetProgramFiles, 'dotnet', 'x64'));
    }
    candidates.push(path.join(dotNetProgramFiles, 'dotnet'));
  } else if (platform === 'darwin') {
    if (architecture === 'x64') {
      candidates.push('/usr/local/share/dotnet/x64');
    }
    candidates.push('/usr/local/share/dotnet', '/opt/homebrew/share/dotnet');
  } else {
    candidates.push(
      '/usr/share/dotnet',
      '/usr/lib/dotnet',
      '/usr/local/share/dotnet'
    );
  }

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const normalized = path.resolve(candidate);
    if (pathExists(path.join(normalized, executableName))) {
      return normalized;
    }
  }
  return undefined;
}

function createPreviewStagingKey(
  managedOutputDir: string,
  nativeHostPath: string,
  executableName: string
) {
  return createHash('sha256')
    .update(managedOutputDir)
    .update('\0')
    .update(nativeHostPath)
    .update('\0')
    .update(executableName)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Root of the per-launch preview staging directories. Kept outside the
 * workspace so Preview's source watcher does not mistake staging operations
 * for user file changes.
 */
export function getPreviewStagingRoot(): string {
  return path.join(os.tmpdir(), PREVIEW_STAGING_DIR_NAME);
}

export interface PreviewStagingGcResult {
  removed: string[];
  skipped: string[];
}

interface PreviewStagingOwner {
  pid: number;
  createdAt: number;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means that the process exists but belongs to another user. Any
    // other error is also retained conservatively.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

async function readPreviewStagingOwner(
  directory: string
): Promise<PreviewStagingOwner | undefined> {
  try {
    const owner = JSON.parse(
      await fs.promises.readFile(
        path.join(directory, PREVIEW_STAGING_OWNER_FILE_NAME),
        'utf8'
      )
    ) as Partial<PreviewStagingOwner>;
    const pid = owner.pid;
    const createdAt = owner.createdAt;
    if (
      typeof pid !== 'number' ||
      !Number.isInteger(pid) ||
      pid <= 0 ||
      typeof createdAt !== 'number' ||
      !Number.isFinite(createdAt)
    ) {
      return undefined;
    }
    return { pid, createdAt };
  } catch {
    return undefined;
  }
}

async function writePreviewStagingOwner(directory: string) {
  const owner: PreviewStagingOwner = {
    pid: process.pid,
    createdAt: Date.now()
  };
  await fs.promises.writeFile(
    path.join(directory, PREVIEW_STAGING_OWNER_FILE_NAME),
    JSON.stringify(owner),
    'utf8'
  );
}

async function listDirectories(directory: string): Promise<fs.Dirent[]> {
  try {
    const entries = await fs.promises.readdir(directory, {
      withFileTypes: true
    });
    return entries.filter((entry) => entry.isDirectory());
  } catch {
    return [];
  }
}

async function removeIfEmpty(directory: string) {
  // Fails with ENOTEMPTY while another session still stages here, which is
  // exactly the wanted behaviour.
  await fs.promises.rmdir(directory).catch(() => undefined);
}

/**
 * Best-effort removal of staging directories left behind by extension hosts
 * that never got to clean up. QtBridgePreviewLaunch.dispose() removes a
 * directory as soon as its session ends. A crash or force-kill can leave a
 * directory behind, so the owner marker identifies the extension host that
 * created it. Only directories whose owner has exited and whose grace period
 * has elapsed are removed. Unmarked or malformed legacy directories are kept
 * because their liveness cannot be established safely.
 */
export async function collectPreviewStagingGarbage(options?: {
  stagingRoot?: string;
  maxAgeMs?: number;
  isProcessAlive?: (pid: number) => boolean;
}): Promise<PreviewStagingGcResult> {
  const stagingRoot = options?.stagingRoot ?? getPreviewStagingRoot();
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_PREVIEW_STAGING_MAX_AGE_MS;
  const checkProcessAlive = options?.isProcessAlive ?? isProcessAlive;
  const result: PreviewStagingGcResult = { removed: [], skipped: [] };

  const isStale = async (fullPath: string) => {
    const owner = await readPreviewStagingOwner(fullPath);
    if (!owner || checkProcessAlive(owner.pid)) {
      return false;
    }
    return Date.now() - owner.createdAt > maxAgeMs;
  };

  for (const assembly of await listDirectories(stagingRoot)) {
    const assemblyDirectory = path.join(stagingRoot, assembly.name);
    for (const key of await listDirectories(assemblyDirectory)) {
      const keyDirectory = path.join(assemblyDirectory, key.name);
      for (const launch of await listDirectories(keyDirectory)) {
        if (!launch.name.startsWith(PREVIEW_STAGING_PREFIX)) {
          continue;
        }
        const launchDirectory = path.join(keyDirectory, launch.name);
        if (!(await isStale(launchDirectory))) {
          continue;
        }
        try {
          await fs.promises.rm(launchDirectory, { recursive: true });
          result.removed.push(launchDirectory);
        } catch {
          result.skipped.push(launchDirectory);
        }
      }
      await removeIfEmpty(keyDirectory);
    }
    await removeIfEmpty(assemblyDirectory);
  }

  return result;
}

async function stagePreviewManagedOutput(
  stagingParent: string,
  managedOutputDir: string
): Promise<string> {
  await fs.promises.mkdir(stagingParent, { recursive: true });
  const stagingDirectory = await fs.promises.mkdtemp(
    path.join(stagingParent, PREVIEW_STAGING_PREFIX)
  );
  try {
    await writePreviewStagingOwner(stagingDirectory);
    await fs.promises.cp(managedOutputDir, stagingDirectory, {
      recursive: true
    });
    return stagingDirectory;
  } catch (error) {
    await fs.promises
      .rm(stagingDirectory, { recursive: true, force: true })
      .catch(() => undefined);
    throw error;
  }
}

export class QtBridgeProjectSnapshot implements QtBridgeProject {
  readonly projectFile: vscode.Uri;
  readonly packageId: string | undefined;
  readonly packageVersion: string | undefined;
  readonly qtDir: vscode.Uri | undefined;
  readonly qmlImportRoot: vscode.Uri | undefined;
  private _metadata: QtBridgeQmlMetadata | undefined;
  private _isMetadataReady = false;
  private _metadataCandidates: readonly QtBridgeQmlMetadata[] = [];

  constructor(
    readonly folder: vscode.WorkspaceFolder,
    info: QtBridgeProjectInfo
  ) {
    this.projectFile = vscode.Uri.file(info.projectFile);
    this.packageId = info.packageId;
    this.packageVersion = info.packageVersion;
    this.qtDir = info.qtDir ? vscode.Uri.file(info.qtDir) : undefined;
    const qmlImportRoot = resolveQtBridgeQmlImportPath(info);
    this.qmlImportRoot = qmlImportRoot
      ? vscode.Uri.file(qmlImportRoot)
      : undefined;
  }

  get metadata() {
    return this._metadata;
  }

  get isMetadataReady() {
    return this._isMetadataReady;
  }

  get metadataCandidates() {
    return this._metadataCandidates;
  }

  updateMetadata(
    metadata: QtBridgeQmlMetadata | undefined,
    isReady: boolean,
    candidates: readonly QtBridgeQmlMetadata[] = []
  ) {
    this._metadata = metadata;
    this._isMetadataReady = isReady;
    this._metadataCandidates = candidates;
  }

  async prepareQmlPreview(): Promise<QtBridgePreviewLaunch | undefined> {
    const metadata = this._metadata;
    const application = metadata?.application;
    if (!this._isMetadataReady || !metadata || !application) {
      logger.info(
        `Preview preparation requires ready application metadata: ${this.projectFile.fsPath}`
      );
      return undefined;
    }
    if (!pathExists(application.managedOutputDir)) {
      logger.warn(
        `Qt Bridge managed output does not exist: ${application.managedOutputDir}`
      );
      return undefined;
    }

    const stagingKey = createPreviewStagingKey(
      application.managedOutputDir,
      application.nativeHostPath,
      application.executableName
    );
    const stagingParent = path.join(
      getPreviewStagingRoot(),
      application.assemblyName,
      stagingKey
    );
    let targetDirectory: string;
    try {
      targetDirectory = await stagePreviewManagedOutput(
        stagingParent,
        application.managedOutputDir
      );
    } catch (error) {
      logger.warn(
        `Failed to stage Qt Bridge preview output for ${this.projectFile.fsPath}: ${String(error)}`
      );
      return undefined;
    }
    const stagedHostPath = path.join(
      targetDirectory,
      application.executableName
    );

    if (!pathExists(stagedHostPath)) {
      if (!pathExists(application.nativeHostPath)) {
        await fs.promises.rm(targetDirectory, {
          recursive: true,
          force: true
        });
        logger.warn(
          `Qt Bridge native host does not exist: ${application.nativeHostPath}`
        );
        return undefined;
      }
      await fs.promises.copyFile(application.nativeHostPath, stagedHostPath);
    }

    const qmlImportRoot = path.join(targetDirectory, 'qml');
    const qmlImportPath = [qmlImportRoot, ...metadata.qml.importPaths].join(
      path.delimiter
    );
    const pathEntries: string[] = [];
    if (this.qtDir) {
      pathEntries.push(path.join(this.qtDir.fsPath, 'bin'));
    }
    const dotNetPathEntry = findDotNetPathEntry();
    if (dotNetPathEntry) {
      pathEntries.push(dotNetPathEntry);
    }
    logger.info(`Prepared Qt Bridge preview host: ${stagedHostPath}`);

    let disposed = false;
    return {
      executable: stagedHostPath,
      cwd: path.dirname(this.projectFile.fsPath),
      pathEntries,
      environment: {
        QML_IMPORT_PATH: qmlImportPath,
        QML2_IMPORT_PATH: qmlImportPath,
        QT_QUICK_CONTROLS_STYLE: 'Basic'
      },
      dispose() {
        if (disposed) {
          return;
        }
        disposed = true;
        void fs.promises
          .rm(targetDirectory, { recursive: true, force: true })
          .catch((error: unknown) => {
            logger.warn(
              `Failed to remove Qt Bridge preview staging directory ${targetDirectory}: ${String(error)}`
            );
          });
      }
    };
  }
}
