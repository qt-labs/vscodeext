// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { Session, ServiceLauncher, Settings } from 'sms-api';

import { createLogger, resolveConfiguration } from 'qt-lib';
import {
  EXTENSION_ID,
  CONF_SERVICE_EXECUTABLE_PATH,
  CONF_INSTALLATION_PATH,
  CONF_USER_AGENT
} from '@/constants';

const logger = createLogger('service-connection');

let launcher: ServiceLauncher | undefined;
let session: Session | undefined;

function getServiceExecutablePath(): string | undefined {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const exePath = config.get<string>(CONF_SERVICE_EXECUTABLE_PATH);
  return exePath && exePath.length > 0 ? exePath : undefined;
}

export async function ensureConnected(): Promise<Session> {
  if (session?.isConnected) {
    logger.info('Already connected to service');
    return session;
  }

  if (!launcher) {
    const serviceBin = getServiceExecutablePath();
    const serviceLogger = createLogger('service');
    launcher = new ServiceLauncher({
      ...(serviceBin ? { serviceBin } : {}),
      onStdout: (line) => {
        serviceLogger.info(line);
      },
      onStderr: (line) => {
        serviceLogger.warn(line);
      }
    });
  }

  const started = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Starting Qt Software Management Service...',
      cancellable: false
    },
    async () => launcher?.startService()
  );

  if (!started) {
    const err = launcher.lastError;
    throw new Error(
      `Failed to start service: ${err?.message ?? 'Unknown error'}. ` +
        `Check the "qt-sms.serviceExecutablePath" setting.`
    );
  }

  if (!session) {
    session = new Session(CONF_USER_AGENT);
  }

  await session.connectToService();

  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const rawInstallPath = config.get<string>(CONF_INSTALLATION_PATH);
  const settings = new Settings(session);

  if (rawInstallPath) {
    const installPath = resolveConfiguration(rawInstallPath);
    const serviceInstallPath = await settings.getInstallationPath();
    if (serviceInstallPath !== installPath) {
      logger.info(
        `Installation path mismatch: service="${serviceInstallPath}", ` +
          `setting="${installPath}". Updating service.`
      );
      await settings.setInstallationPath(installPath);
    } else {
      logger.info(`installationPath: "${installPath}"`);
    }
  }

  return session;
}

export function getSession(): Session | undefined {
  return session;
}

export function disconnect(): void {
  if (session) {
    session.disconnectFromService();
    session = undefined;
  }
  launcher = undefined;
  logger.info('Disconnected from service');
}
