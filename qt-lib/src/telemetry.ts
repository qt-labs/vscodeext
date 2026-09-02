// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as process from 'process';
import {
  TelemetryReporter,
  TelemetryEventProperties,
  TelemetryEventMeasurements
} from '@vscode/extension-telemetry';

type Props = TelemetryEventProperties;
type Measures = TelemetryEventMeasurements;

const globalConnectionString =
  'InstrumentationKey=09d5f9a1-0532-4146-b158-a653220b28b6;IngestionEndpoint=https://germanywestcentral-1.in.applicationinsights.azure.com/;LiveEndpoint=https://germanywestcentral.livediagnostics.monitor.azure.com/;ApplicationId=8758b8d8-22d0-459d-b1b4-1689a3a350d5';

class Telemetry {
  private _reporter: TelemetryReporter | undefined;
  private _context: vscode.ExtensionContext | undefined;

  public activate(context: vscode.ExtensionContext, connectionString?: string) {
    this._reporter = new TelemetryReporter(
      connectionString ?? globalConnectionString,
      undefined,
      { ignoreUnhandledErrors: true }
    );

    this._context = context;
    this._context.subscriptions.push(this._reporter);
  }

  public dispose() {
    if (this._reporter) {
      void this._reporter.dispose();
    }
  }

  public sendAction(actionName: string, p?: Props, m?: Measures) {
    const name = `action.${actionName}.triggered`;
    this._report('event', name, p, m);
  }

  public sendConfig(configName: string, p?: Props, m?: Measures) {
    const name = `config.${configName}.triggered`;
    this._report('event', name, p, m);
  }

  public sendEvent(name: string, p?: Props, m?: Measures) {
    this._report('event', name, p, m);
  }

  public sendRawEvent(name: string, p?: Props, m?: Measures) {
    this._report('raw', name, p, m);
  }

  public sendDangerousEvent(name: string, p?: Props, m?: Measures) {
    this._report('dangerous', name, p, m);
  }

  public sendDangerousErrorEvent(name: string, p?: Props, m?: Measures) {
    this._report('dangerousError', name, p, m);
  }

  private _report(
    kind: 'event' | 'raw' | 'error' | 'dangerous' | 'dangerousError',
    name: string,
    props?: Props,
    measures?: Measures
  ) {
    // Note:
    // we ignore telemetry when the environment says so.
    // This is useful when running tests or developing locally,
    // to avoid tainting telemetry data with fake values.
    if (process.env.QT_SUPPRESS_TELEMETRY === '1') {
      if (process.env.QT_LOG_SUPPRESSED_TELEMETRY === '1') {
        console.log(
          'Telemetry suppressed:',
          [
            `extension = '${this._context?.extension.id ?? ''}'`,
            `name = '${name}'`,
            `kind = '${kind}'`
          ].join(', ')
        );
      }
      return;
    }

    if (!this._reporter) {
      throw new Error('Telemetry reporter not initialized');
    }

    switch (kind) {
      case 'event':
        this._reporter.sendTelemetryEvent(name, props, measures);
        break;

      case 'raw':
        this._reporter.sendRawTelemetryEvent(name, props, measures);
        break;

      case 'error':
        this._reporter.sendTelemetryErrorEvent(name, props, measures);
        break;

      case 'dangerous':
        this._reporter.sendDangerousTelemetryEvent(name, props, measures);
        break;

      case 'dangerousError':
        this._reporter.sendDangerousTelemetryErrorEvent(name, props, measures);
        break;
    }
  }
}

const telemetry = new Telemetry();

export { telemetry, type TelemetryEventProperties };
