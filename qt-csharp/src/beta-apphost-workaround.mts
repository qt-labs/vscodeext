// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

/**
 * TEMPORARY PREVIEW WORKAROUND -- REMOVE ME.
 *
 * Qt Bridge 0.4.0.22-beta can deploy its unpatched native host template over
 * the SDK-finalised application host (QTBRIDGES-360). Recover the SDK host
 * only in the disposable preview staging directory.
 *
 * Remove as soon as an updated package containing bridge commit
 * 8edb48c43878fd83afe162e5b7f928c10c830172 is published; require that fixed
 * package for preview from then on. In all cases, remove this compatibility
 * code before the C# extension leaves preview.
 *
 * Removal checklist:
 * - Delete this file and test/suite/beta-apphost-workaround.test.mts.
 * - Remove that test's entry from esbuild.mjs.
 * - Remove the import and marked call in project.mts. Keep the permanent
 *   fs.promises.access(stagedHostPath) check immediately before that call.
 * Alternatively, revert the beta-workaround commit to remove all of it.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createLogger, type QtBridgeQmlMetadata } from 'qt-lib';

const logger = createLogger('beta-apphost-workaround');

async function resolveSdkAppHost(
  metadata: QtBridgeQmlMetadata,
  dotNetDirectory: string | undefined
): Promise<string> {
  const dotNetName = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
  const dotNet = dotNetDirectory
    ? path.join(dotNetDirectory, dotNetName)
    : dotNetName;
  const args = [
    'msbuild',
    metadata.projectFile,
    '-nologo',
    '-getProperty:IntermediateOutputPath,TargetDir,_NativeExecutableExtension',
    `-p:Configuration=${metadata.configuration}`
  ];
  if (metadata.targetFramework) {
    args.push(`-p:TargetFramework=${metadata.targetFramework}`);
  }
  // Evaluate properties only: do not build or restore the user's project.
  const { stdout } = await promisify(execFile)(dotNet, args, {
    cwd: path.dirname(metadata.projectFile),
    timeout: 15000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
  });
  const result = JSON.parse(stdout) as {
    Properties: {
      IntermediateOutputPath: string;
      TargetDir: string;
      _NativeExecutableExtension: string;
    };
  };
  const properties = result.Properties;
  const outputDir = metadata.application?.managedOutputDir;
  if (
    !properties.IntermediateOutputPath ||
    !outputDir ||
    fs.realpathSync(properties.TargetDir) !== fs.realpathSync(outputDir)
  ) {
    throw new Error(
      'The evaluated build output does not match the selected Qt Bridge metadata.'
    );
  }
  return path.resolve(
    path.dirname(metadata.projectFile),
    properties.IntermediateOutputPath.replace(/\\/g, path.sep),
    `apphost${properties._NativeExecutableExtension}`
  );
}

export async function applyBetaAppHostWorkaround(
  stagedHostPath: string,
  metadata: QtBridgeQmlMetadata,
  options: {
    dotNetDirectory?: string | undefined;
    resolveHost?: (metadata: QtBridgeQmlMetadata) => Promise<string>;
  } = {}
) {
  const marker = Buffer.from('QTBRIDGE_HOST_MANIFEST_V1__UNPATCHED__');
  const host = await fs.promises.readFile(stagedHostPath);
  if (!host.includes(marker)) {
    return;
  }
  try {
    const sdkHostPath = options.resolveHost
      ? await options.resolveHost(metadata)
      : await resolveSdkAppHost(metadata, options.dotNetDirectory);
    const sdkHost = await fs.promises.readFile(sdkHostPath);
    if (sdkHost.includes(marker) || !sdkHost.includes(Buffer.from('QTBM'))) {
      throw new Error('The SDK app host has no patched Qt Bridge manifest.');
    }
    await fs.promises.copyFile(sdkHostPath, stagedHostPath);
    logger.info(
      `Recovered patched Qt Bridge preview host from: ${sdkHostPath}`
    );
  } catch (error) {
    throw new Error(
      'The Qt Bridge output contains an unpatched app host and its SDK host could not be recovered. ' +
        'Clean and rebuild the application, or update Qt Bridge to a version with the ' +
        `QTBRIDGES-360 deployment fix (8edb48c). ${String(error)}`
    );
  }
}
