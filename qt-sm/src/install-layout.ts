// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

/**
 * Where the service puts the packages of an installation. Every product
 * gets a folder per version, below the folder of its vendor:
 *
 *   <installRoot>/<vendor>/<product>/<version>/
 *
 * for example `io.qt/qtframework/6.12.0`, `org.cmake/cmake/3.30.6` and
 * `org.ninja-build/ninja/1.12.1`. The service does not report these paths,
 * so this is the one place the extension knows them.
 */
interface ProductLocation {
  readonly vendor: string;
  readonly product: string;
}

export const QT_FRAMEWORK: ProductLocation = {
  vendor: 'io.qt',
  product: 'qtframework'
};
export const CMAKE: ProductLocation = { vendor: 'org.cmake', product: 'cmake' };
export const NINJA: ProductLocation = {
  vendor: 'org.ninja-build',
  product: 'ninja'
};

/** The folder that holds the version folders of a product. */
export function productDir(
  installRoot: string,
  location: ProductLocation
): string {
  return path.join(installRoot, location.vendor, location.product);
}

/** The folder of one version of a product. */
export function productVersionDir(
  installRoot: string,
  location: ProductLocation,
  version: string
): string {
  return path.join(productDir(installRoot, location), version);
}

/**
 * The versions of a product installed on disk, newest first. Each
 * subdirectory of the product folder is a version.
 */
export function listProductVersions(
  installRoot: string,
  location: ProductLocation
): string[] {
  try {
    return fs
      .readdirSync(productDir(installRoot, location), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
      );
  } catch {
    // The product folder is missing until the product is installed.
    return [];
  }
}
