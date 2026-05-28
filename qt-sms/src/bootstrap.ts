// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';

import * as vscode from 'vscode';
import {
  createLogger,
  IsLinux,
  IsMacOS,
  IsWindows,
  IsArm64,
  Isx64
} from 'qt-lib';
import { QtAccountStorage, ServiceLauncher } from 'sms-api';

const logger = createLogger('bootstrap');

const BOOTSTRAP_BASE_URL = 'https://cdn.qt.io/install/public/bootstrap';

function getBootstrapUrl(): string | undefined {
  if (IsMacOS) {
    return `${BOOTSTRAP_BASE_URL}/bootstrap-vscode-macos-universal.dmg.zip`;
  }

  let arch: string | undefined;
  if (Isx64) {
    arch = 'x86_64';
  } else if (IsArm64) {
    arch = 'aarch64';
  }
  if (!arch) {
    return undefined;
  }

  if (IsLinux) {
    return `${BOOTSTRAP_BASE_URL}/bootstrap-vscode-linux-${arch}.run.zip`;
  }
  if (IsWindows) {
    return `${BOOTSTRAP_BASE_URL}/bootstrap-vscode-windows-${arch}.exe.zip`;
  }
  return undefined;
}

/**
 * Check whether the bootstrap has already been installed by looking for the
 * QtCompany.ini file that it creates on successful completion.
 */
function isBootstrapInstalled(): boolean {
  const iniPath = QtAccountStorage.defaultQtCompanyPath();
  return fs.existsSync(iniPath);
}

/**
 * Download a file from `url` to `destPath`, following redirects.
 */
async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl: string, redirectCount: number) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }
      https
        .get(reqUrl, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            doRequest(res.headers.location, redirectCount + 1);
            return;
          }
          if (
            !res.statusCode ||
            res.statusCode < 200 ||
            res.statusCode >= 300
          ) {
            reject(new Error(`HTTP ${String(res.statusCode)} for ${reqUrl}`));
            return;
          }

          const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10);
          let receivedBytes = 0;

          const fileStream = fs.createWriteStream(destPath);
          res.pipe(fileStream);

          res.on('data', (chunk: Buffer) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              onProgress(Math.round((receivedBytes / totalBytes) * 100));
            }
          });

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
          fileStream.on('error', (err) => {
            fs.unlink(destPath, (unlinkErr) => {
              if (unlinkErr) {
                logger.warn(
                  `Failed to clean up ${destPath}: ${unlinkErr.message}`
                );
              }
            });
            reject(err instanceof Error ? err : new Error(String(err)));
          });
        })
        .on('error', (err) => {
          fs.unlink(destPath, (unlinkErr) => {
            if (unlinkErr) {
              logger.warn(
                `Failed to clean up ${destPath}: ${unlinkErr.message}`
              );
            }
          });
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    };
    doRequest(url, 0);
  });
}

/**
 * Unzip a file using platform-native tools.
 */
async function unzipFile(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      // Use PowerShell Expand-Archive
      execFile(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`
        ],
        (err) => {
          if (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          } else {
            resolve();
          }
        }
      );
    } else {
      execFile('unzip', ['-o', zipPath, '-d', destDir], (err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        } else {
          resolve();
        }
      });
    }
  });
}

/**
 * Run the bootstrap installer after extracting it.
 */
async function runBootstrap(extractDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (IsMacOS) {
      // Find the .app inside the extracted dir
      const entries = fs.readdirSync(extractDir);
      const dmgFile = entries.find((e) => e.endsWith('.dmg'));
      if (!dmgFile) {
        // Look for .app directly
        const appBundle = entries.find((e) => e.endsWith('.app'));
        if (!appBundle) {
          reject(new Error('No .app or .dmg found in extracted bootstrap'));
          return;
        }
        const appPath = path.join(extractDir, appBundle);
        logger.info(`Running bootstrap app directly: ${appPath}`);
        execFile(
          'open',
          ['-n', '-W', appPath, '--args', 'install', '--accept-telemetry'],
          (err) => {
            if (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            } else {
              resolve();
            }
          }
        );
        return;
      }
      // Mount the DMG, find the app inside, run it
      const mountPoint = path.join(extractDir, 'bootstrap-mount');
      fs.mkdirSync(mountPoint, { recursive: true });
      execFile(
        'hdiutil',
        [
          'attach',
          path.join(extractDir, dmgFile),
          '-mountpoint',
          mountPoint,
          '-nobrowse'
        ],
        (err) => {
          if (err) {
            reject(new Error(`Failed to mount DMG: ${err.message}`));
            return;
          }
          const mountEntries = fs.readdirSync(mountPoint);
          const appBundle = mountEntries.find((e) => e.endsWith('.app'));
          if (!appBundle) {
            execFile(
              'hdiutil',
              ['detach', mountPoint, '-force'],
              (detachErr) => {
                if (detachErr) {
                  logger.warn(`Failed to detach DMG: ${detachErr.message}`);
                }
              }
            );
            reject(new Error('No .app found inside DMG'));
            return;
          }
          const appPath = path.join(mountPoint, appBundle);
          logger.info(`Running bootstrap app from DMG: ${appPath}`);
          execFile(
            'open',
            ['-n', '-W', appPath, '--args', 'install', '--accept-telemetry'],
            (runErr) => {
              // Always try to detach the DMG
              execFile(
                'hdiutil',
                ['detach', mountPoint, '-force'],
                (detachErr) => {
                  if (detachErr) {
                    logger.warn(`Failed to detach DMG: ${detachErr.message}`);
                  }
                }
              );
              if (runErr) {
                reject(
                  runErr instanceof Error ? runErr : new Error(String(runErr))
                );
              } else {
                resolve();
              }
            }
          );
        }
      );
    } else if (IsLinux) {
      const entries = fs.readdirSync(extractDir);
      const runFile = entries.find((e) => e.endsWith('.run'));
      if (!runFile) {
        reject(new Error('No .run file found in extracted bootstrap'));
        return;
      }
      const runPath = path.join(extractDir, runFile);
      fs.chmodSync(runPath, 0o755);
      logger.info(`Running bootstrap: ${runPath}`);
      execFile(runPath, ['install', '--accept-telemetry'], (err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        } else {
          resolve();
        }
      });
    } else if (IsWindows) {
      const entries = fs.readdirSync(extractDir);
      const exeFile = entries.find((e) => e.endsWith('.exe'));
      if (!exeFile) {
        reject(new Error('No .exe file found in extracted bootstrap'));
        return;
      }
      const exePath = path.join(extractDir, exeFile);
      logger.info(`Running bootstrap: ${exePath}`);
      execFile(exePath, ['install', '--accept-telemetry'], (err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        } else {
          resolve();
        }
      });
    } else {
      reject(new Error(`Unsupported platform: ${process.platform}`));
    }
  });
}

/**
 * Download, extract, and run the bootstrap installer.
 * Called on extension activation if the service is not already running.
 */
export async function installBootstrap(): Promise<void> {
  logger.info('Bootstrap workflow started');

  const launcher = new ServiceLauncher();
  if (await launcher.isServiceRunning()) {
    logger.info('Service is already running, skipping bootstrap');
    return;
  }

  if (isBootstrapInstalled()) {
    logger.info(
      `Bootstrap already installed ("${QtAccountStorage.defaultQtCompanyPath()}" exists)`
    );
    return;
  }

  const url = getBootstrapUrl();
  if (!url) {
    logger.error(
      `Unsupported platform/architecture for bootstrap: ${process.platform}/${os.arch()}`
    );
    void vscode.window.showErrorMessage(
      `Bootstrap is not available for this platform (${process.platform}).`
    );
    return;
  }

  logger.info(`Bootstrap URL: ${url}`);

  const tmpDir = path.join(
    os.tmpdir(),
    'qt-bootstrap-' + Date.now().toString()
  );
  fs.mkdirSync(tmpDir, { recursive: true });
  const zipFileName = path.basename(new URL(url).pathname);
  const zipPath = path.join(tmpDir, zipFileName);

  logger.info(`Downloading bootstrap to ${zipPath}`);

  try {
    // Download
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading Qt bootstrap installer...',
        cancellable: false
      },
      async (progress) => {
        let lastPct = 0;
        await downloadFile(url, zipPath, (pct) => {
          const increment = pct - lastPct;
          if (increment > 0) {
            progress.report({ increment, message: `${String(pct)}%` });
            lastPct = pct;
          }
        });
      }
    );

    logger.info(`Bootstrap downloaded to ${zipPath}`);

    // Extract
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Extracting Qt bootstrap installer...',
        cancellable: false
      },
      async () => {
        await unzipFile(zipPath, tmpDir);
      }
    );

    logger.info(`Bootstrap extracted to ${tmpDir}`);

    // Run
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Running Qt bootstrap installer...',
        cancellable: false
      },
      async () => {
        await runBootstrap(tmpDir);
      }
    );

    logger.info('Bootstrap installation completed successfully');

    // Start the service now that serviceInstallPath is in QtCompany.ini
    const postLauncher = new ServiceLauncher();
    const started = await postLauncher.startService();
    if (started) {
      logger.info('Service started after bootstrap');
    } else {
      const err2 = postLauncher.lastError;
      logger.warn(
        `Service could not be started after bootstrap: ${err2?.message ?? 'unknown'}`
      );
    }

    void vscode.window.showInformationMessage(
      'Qt bootstrap installation completed successfully.'
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Bootstrap installation failed: ${msg}`);
    void vscode.window.showErrorMessage(
      `Qt bootstrap installation failed: ${msg}`
    );
  } finally {
    // Clean up temp files
    logger.info(`Cleaning up temp directory: ${tmpDir}`);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      logger.warn(`Failed to clean up temp directory: ${tmpDir}`);
    }
  }
}
