// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import {
  Session,
  ServiceLauncher,
  Settings,
  type ElevationRequest
} from 'sms-api';

import { createLogger, resolveConfiguration } from 'qt-lib';
import {
  EXTENSION_ID,
  CONF_INSTALLATION_PATH,
  CONF_USER_AGENT
} from '@/constants';

const logger = createLogger('service-connection');

const CLIENT_AUTHOR = 'The Qt Company';

let launcher: ServiceLauncher | undefined;
let session: Session | undefined;

function extensionVersion(): string {
  const ext = vscode.extensions.getExtension(`theqtcompany.${EXTENSION_ID}`);
  const packageJSON = ext?.packageJSON as Record<string, unknown> | undefined;
  const version = packageJSON?.version;
  return typeof version === 'string' ? version : '0.0.0';
}

/**
 * Answers `service/elevation-required`: the service needs administrator
 * rights, for example to install into a directory the user cannot write.
 * The helper is started through the authorization dialog of the operating
 * system (pkexec, UAC, or Authorization Services).
 */
async function startElevatedHelper(
  request: ElevationRequest
): Promise<boolean> {
  logger.info(
    `The service needs administrator rights: ${request.reason || 'no reason given'}`
  );
  if (request.reason) {
    void vscode.window.showInformationMessage(request.reason);
  }
  if (!launcher) {
    return false;
  }
  const ready = await launcher.startElevatedHelper(request);
  if (!ready) {
    logger.error(
      `The elevated helper was not started: ${launcher.lastError?.message ?? 'unknown error'}`
    );
  }
  return ready;
}

export async function ensureConnected(): Promise<Session> {
  if (session?.isConnected) {
    logger.info('Already connected to service');
    return session;
  }

  if (!launcher) {
    const serviceLogger = createLogger('service');
    launcher = new ServiceLauncher({
      onStdout: (line) => {
        serviceLogger.info(line);
      },
      onStderr: (line) => {
        serviceLogger.error(line);
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
      `Failed to start service: ${err?.message ?? 'Unknown error'}.`
    );
  }

  if (!session) {
    const version = extensionVersion();
    session = new Session({
      userAgent: `${CONF_USER_AGENT}/${version}`,
      client: { author: CLIENT_AUTHOR, name: CONF_USER_AGENT, version },
      onElevationRequired: startElevatedHelper
    });
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
        `Installation path mismatch: service="${serviceInstallPath ?? ''}", ` +
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
