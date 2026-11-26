// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';
import {
  InstallReason,
  type JobCallbacks,
  type PackageData,
  type Packages
} from 'sms-api';

import { EXTENSION_ID, CONF_INSTALLATION_PATH } from '@/constants';
import { getInstallRoot, installationTarget } from '@/install-root';
import {
  QT_FRAMEWORK,
  listProductVersions,
  productDir
} from '@/install-layout';
import { isPackageOperationRunning } from '@/install-state';

const QT_FRAMEWORK_PRODUCT = 'qtframework';

/** The name to show for a package: its display name, else its name or id. */
export function packageLabel(pkg: PackageData): string {
  return pkg.displayNames[0] ?? (pkg.name || pkg.id);
}

/**
 * What a package is built for, for example `MSVC 2022 x86_64`: the display
 * name that follows the name of the package. A version of Qt can come in
 * several builds, on Windows one per compiler, so the version alone does
 * not tell its packages apart. Empty when the backend names none.
 */
export function packageVariant(pkg: PackageData): string {
  return pkg.displayNames[1] ?? '';
}

/**
 * Name, version and variant of a package, for example
 * `Qt Framework 6.12.1 (MSVC 2022 x86_64)`.
 */
export function packageTitle(pkg: PackageData): string {
  const variant = packageVariant(pkg);
  return `${packageLabel(pkg)} ${pkg.version}${variant ? ` (${variant})` : ''}`;
}

/**
 * The target of a package: its id without the component at the end, for
 * example `io.qt.qtframework.windows-11-x86_64-msvc2022` for the id
 * `io.qt.qtframework.windows-11-x86_64-msvc2022.monolith`. The alias
 * packages of one build of Qt share it.
 */
export function packageTarget(pkg: PackageData): string {
  const dot = pkg.id.lastIndexOf('.');
  return dot > 0 ? pkg.id.slice(0, dot) : pkg.id;
}

/**
 * Whether a package is built for LLVM-MinGW, as the packages of the target
 * `io.qt.qtframework.windows-11-x86_64-llvm-mingw2217` are.
 */
function isLlvmMingwPackage(pkg: PackageData): boolean {
  return /llvm[-_]mingw/i.test(packageTarget(pkg));
}

/**
 * Search the packages the extension offers to install: the ones for this
 * host, a version of Qt as one package per build, with the ones installed
 * in the installation root reported as installed.
 *
 * The LLVM-MinGW builds of Qt are left out. The service has no LLVM-MinGW
 * toolchain to install with them, unlike for MinGW, so a project could not
 * be built against such a build. Every search of the extension goes through
 * here, so they are neither listed nor installed.
 */
export async function searchInstallablePackages(
  packages: Packages,
  callbacks?: JobCallbacks
): Promise<PackageData[]> {
  const available = await packages.searchAvailablePackages(
    installationTarget(),
    { packagePresentation: 'monolith' },
    callbacks
  );
  return available.filter((pkg) => !isLlvmMingwPackage(pkg));
}

/**
 * Where a target comes among the builds of one version: on Windows MSVC,
 * then MinGW. Targets with another compiler come last, in the order of the
 * service.
 */
function compilerRank(target: string): number {
  const name = target.toLowerCase();
  if (name.includes('msvc')) {
    return 0;
  }
  if (name.includes('mingw')) {
    return 1;
  }
  return 2;
}

/** Newest version first, the builds of one version by compilerRank(). */
function compareBuilds(
  a: { version: string; target: string },
  b: { version: string; target: string }
): number {
  return (
    b.version.localeCompare(a.version, undefined, {
      numeric: true,
      sensitivity: 'base'
    }) || compilerRank(a.target) - compilerRank(b.target)
  );
}

function comparePackages(a: PackageData, b: PackageData): number {
  return compareBuilds(
    { version: a.version, target: packageTarget(a) },
    { version: b.version, target: packageTarget(b) }
  );
}

/**
 * The packages in the order to offer them: the products as the service
 * lists them, the newest version of each first, and the builds of one
 * version with the preferred compiler first, see compilerRank().
 */
export function sortPackages(packages: readonly PackageData[]): PackageData[] {
  const productOrder = new Map<string, number>();
  for (const pkg of packages) {
    if (!productOrder.has(pkg.product)) {
      productOrder.set(pkg.product, productOrder.size);
    }
  }
  const productIndex = (pkg: PackageData) => productOrder.get(pkg.product) ?? 0;
  return [...packages].sort(
    (a, b) => productIndex(a) - productIndex(b) || comparePackages(a, b)
  );
}

/**
 * The packages of the newest version among `packages`: the builds of that
 * version, the preferred compiler first, see compilerRank().
 */
export function newestPackages(
  packages: readonly PackageData[]
): PackageData[] {
  const sorted = [...packages].sort(comparePackages);
  const newest = sorted[0]?.version;
  return sorted.filter((pkg) => pkg.version === newest);
}

/**
 * Whether a package is part of the Qt Framework, and of `version` when one
 * is given. The backend names the product; the id carries it too, for
 * packages the journal recorded without one.
 */
export function isFrameworkPackage(
  pkg: PackageData,
  version?: string
): boolean {
  if (version !== undefined && pkg.version !== version) {
    return false;
  }
  return (
    pkg.product === QT_FRAMEWORK_PRODUCT ||
    pkg.id.includes(`.${QT_FRAMEWORK_PRODUCT}.`)
  );
}

/**
 * Whether removing the packages `removed` names, together with the
 * packages nothing needs any more, leaves no package in the installation
 * that holds `installed`. That is so when no other package was installed
 * on request: the service then takes the rest as unneeded dependencies.
 */
export function removalEmptiesInstallation(
  installed: readonly PackageData[],
  removed: readonly { id: string; version: string }[]
): boolean {
  const named = new Set(removed.map((ref) => `${ref.id}@${ref.version}`));
  return installed
    .filter((pkg) => pkg.installReason === InstallReason.Manual)
    .every((pkg) => named.has(`${pkg.id}@${pkg.version}`));
}

/**
 * A build of a Qt version the service has installed, with its packages.
 * One version can be installed in several builds, for example for MSVC and
 * for MinGW.
 */
export interface InstalledQtVersion {
  readonly version: string;
  /** What the build is for, for example `MSVC 2022 x86_64`. */
  readonly variant: string;
  /** The target its packages share, see packageTarget(). */
  readonly target: string;
  /** The packages of the build, sorted by label. */
  readonly packages: PackageData[];
}

/** Identifies a build among the installed ones: its target and version. */
export function qtBuildKey(
  qt: Pick<InstalledQtVersion, 'version' | 'target'>
): string {
  return `${qt.target}@${qt.version}`;
}

/** Version and variant of a build, for example `Qt 6.12.1 (MSVC 2022 x86_64)`. */
export function installedQtTitle(
  qt: Pick<InstalledQtVersion, 'version' | 'variant'>
): string {
  return `Qt ${qt.version}${qt.variant ? ` (${qt.variant})` : ''}`;
}

/**
 * Group the Qt Framework packages of a `packages/list` answer by build,
 * that is by version and target: newest version first, and the builds of
 * one version by compiler, see compilerRank(). Packages of other products,
 * such as the build tools, are left out: the view lists Qt versions.
 */
export function groupFrameworkVersions(
  packages: readonly PackageData[]
): InstalledQtVersion[] {
  const builds = new Map<
    string,
    { version: string; target: string; packages: PackageData[] }
  >();
  for (const pkg of packages) {
    if (!isFrameworkPackage(pkg)) {
      continue;
    }
    const build = { version: pkg.version, target: packageTarget(pkg) };
    const key = qtBuildKey(build);
    const known = builds.get(key);
    if (known) {
      known.packages.push(pkg);
    } else {
      builds.set(key, { ...build, packages: [pkg] });
    }
  }
  return [...builds.values()]
    .map((build) => ({
      ...build,
      // The packages of a build name the same variant. The target tells
      // the builds of a version apart when the journal recorded none.
      variant:
        build.packages.map(packageVariant).find((name) => name.length > 0) ??
        build.target.slice(build.target.lastIndexOf('.') + 1),
      packages: build.packages.sort((a, b) =>
        packageLabel(a).localeCompare(packageLabel(b))
      )
    }))
    .sort(compareBuilds);
}

// The Qt versions of the last `packages/list` answer, newest first. Empty
// until the service has answered, and after an answer that failed.
let installedVersions: readonly InstalledQtVersion[] = [];
const installedVersionsEmitter = new vscode.EventEmitter<void>();

/**
 * Fires when the Qt versions the service reports as installed change, see
 * setInstalledVersions().
 */
export const onDidChangeInstalledVersions = installedVersionsEmitter.event;

/**
 * Remember the Qt versions of a `packages/list` answer. The Installed
 * Packages view calls this each time it has read them, so the rest of the
 * extension asks the same answer and does not look on disk, where the
 * layout is up to the service.
 */
export function setInstalledVersions(
  versions: readonly InstalledQtVersion[]
): void {
  const before = installedVersions.map(qtBuildKey).join('\n');
  installedVersions = versions;
  if (versions.map(qtBuildKey).join('\n') !== before) {
    installedVersionsEmitter.fire();
  }
}

/**
 * Whether the service reports at least one Qt Framework version in the
 * installation root. False until the service has answered.
 */
export function isAnyVersionInstalled(): boolean {
  return installedVersions.length > 0;
}

/**
 * Check whether a Qt version is installed on disk, in any build, for
 * versions the service does not report. See install-layout.ts for the
 * folder structure.
 */
export function isVersionInstalledOnDisk(version: string): boolean {
  const installRoot = getInstallRoot();
  if (!installRoot) {
    return false;
  }
  return listProductVersions(installRoot, QT_FRAMEWORK).includes(version);
}

let diskWatchers: vscode.FileSystemWatcher[] = [];

/**
 * Watch the Qt framework installation directory on disk and invoke `onChange`
 * whenever a version folder is added or removed — e.g. an install/uninstall
 * done outside the extension, or a manual change. What is installed is then
 * read from the service again; the disk only says when to ask. The watcher re-targets
 * automatically when the installation-root setting changes.
 */
export function watchInstalledPackagesOnDisk(
  context: vscode.ExtensionContext,
  onChange: () => void
): void {
  const retarget = () => {
    diskWatchers.forEach((w) => {
      w.dispose();
    });
    diskWatchers = [];

    const installRoot = getInstallRoot();
    if (!installRoot) {
      return;
    }

    // Ignore disk churn while an install or a removal is changing the
    // folder — the intermediate states are noise. The operation reads the
    // installed versions again itself once it completes.
    const handle = () => {
      if (isPackageOperationRunning()) {
        return;
      }
      onChange();
    };

    const addWatcher = (base: string, glob: string) => {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(base), glob)
      );
      watcher.onDidCreate(handle);
      watcher.onDidDelete(handle);
      diskWatchers.push(watcher);
    };

    // Non-recursive watch of the immediate children (the version folders).
    addWatcher(productDir(installRoot, QT_FRAMEWORK), '*');

    // The watcher above is anchored inside the installation root, so it cannot
    // observe the root itself being removed. Deleting the installation root
    // wipes the Qt versions along with it, which must be noticed as well.
    // Watch the root entry from its parent so its deletion (and re-creation) is
    // reported. Skip when the root has no parent (e.g. a filesystem root).
    const installRootParent = path.dirname(installRoot);
    if (installRootParent && installRootParent !== installRoot) {
      addWatcher(installRootParent, path.basename(installRoot));
    }
  };

  retarget();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_ID}.${CONF_INSTALLATION_PATH}`)) {
        retarget();
      }
    }),
    {
      dispose: () => {
        diskWatchers.forEach((w) => {
          w.dispose();
        });
        diskWatchers = [];
      }
    }
  );
}
