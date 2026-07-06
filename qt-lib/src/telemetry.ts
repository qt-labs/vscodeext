// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import {
  TelemetryEventMeasurements,
  TelemetryEventProperties,
  TelemetryReporter
} from '@vscode/extension-telemetry';

export type { TelemetryEventProperties };
export { TelemetryReporter };

const globalConnectionString =
  'InstrumentationKey=09d5f9a1-0532-4146-b158-a653220b28b6;IngestionEndpoint=https://germanywestcentral-1.in.applicationinsights.azure.com/;LiveEndpoint=https://germanywestcentral.livediagnostics.monitor.azure.com/;ApplicationId=8758b8d8-22d0-459d-b1b4-1689a3a350d5';
export let reporter: TelemetryReporter;

enum EventTypes {
  event = 'event',
  rawEvent = 'rawEvent',
  dangerousEvent = 'dangerousEvent',
  errorEvent = 'error',
  dangerousErrorEvent = 'dangerousError'
}

class Telemetry {
  reporter: TelemetryReporter | undefined;
  activate(context: vscode.ExtensionContext, connectionString?: string) {
    this.reporter = new TelemetryReporter(
      connectionString ?? globalConnectionString,
      undefined,
      { ignoreUnhandledErrors: true }
    );
    context.subscriptions.push(this.reporter);
  }
  sendAction(
    actionName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    this.send(
      EventTypes.event,
      `action.${actionName}.triggered`,
      properties,
      measurements
    );
  }
  sendConfig(
    configName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    this.send(
      EventTypes.event,
      `config.${configName}.triggered`,
      properties,
      measurements
    );
  }
  sendEvent(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    this.send(EventTypes.event, eventName, properties, measurements);
  }
  sendRawEvent(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    this.send(EventTypes.rawEvent, eventName, properties, measurements);
  }
  sendDangerousEvent(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    this.send(EventTypes.dangerousEvent, eventName, properties, measurements);
  }
  sendErrorEvent(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    this.send(EventTypes.errorEvent, eventName, properties, measurements);
  }
  sendDangerousErrorEvent(
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    this.send(
      EventTypes.dangerousErrorEvent,
      eventName,
      properties,
      measurements
    );
  }
  private send(
    eventType: EventTypes,
    eventName: string,
    properties?: TelemetryEventProperties,
    measurements?: TelemetryEventMeasurements
  ) {
    if (!this.reporter) {
      throw new Error('Telemetry reporter not initialized');
    }

    switch (eventType) {
      case EventTypes.event:
        this.reporter.sendTelemetryEvent(eventName, properties, measurements);
        break;
      case EventTypes.rawEvent:
        this.reporter.sendRawTelemetryEvent(
          eventName,
          properties,
          measurements
        );
        break;
      case EventTypes.dangerousEvent:
        this.reporter.sendDangerousTelemetryEvent(
          eventName,
          properties,
          measurements
        );
        break;
      case EventTypes.errorEvent:
        this.reporter.sendTelemetryErrorEvent(
          eventName,
          properties,
          measurements
        );
        break;
      case EventTypes.dangerousErrorEvent:
        this.reporter.sendDangerousTelemetryErrorEvent(
          eventName,
          properties,
          measurements
        );
        break;
      default:
        throw new Error('Invalid event type');
    }
  }
  dispose() {
    if (this.reporter) {
      void this.reporter.dispose();
    }
  }
}

export const telemetry = new Telemetry();
