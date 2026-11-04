
// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export type UiState =  'unknown' | 'triggered' | 'loading' | 'loaded';

export interface TraceData {
  fileName: string;
  filePath: string;
  bytes: Uint8Array;
};

export interface ProfilerConfig {
  distUri: string;
  containerEl: HTMLElement;
  onRpcMessage: (msg: RpcOutput) => void;
  log: (...args: unknown[]) => void;
}

type RpcMessage<M extends string, P> = {
  jsonrpc: '2.0';
  method: M;
  params: P
};

export type RpcOutput =
  | RpcMessage<'traceEventSelected', {
      lineNumber: number,
      columnNumber: number,
      sourceFilePath: string
    }>

  | RpcMessage<'traceFileLoadingStarted', {
    traceFilePath: string
    }>

  | RpcMessage<'traceFileLoadingFinished', {
      successful: boolean,
      errorMessage: string,
      traceFilePath: string
    }>
;

// type guards
export function isRpcOutput(msg: unknown): msg is RpcOutput {
  if (!isObject(msg) || msg.jsonrpc !== '2.0' || !isObject(msg.params)) {
    return false;
  }

  const p = msg.params;
  switch (msg.method) {
    case 'traceEventSelected':
      return typeof p.lineNumber === 'number'
        && typeof p.columnNumber === 'number'
        && typeof p.sourceFilePath === 'string';

    case 'traceFileLoadingStarted':
      return typeof p.traceFilePath === 'string';

    case 'traceFileLoadingFinished':
      return typeof p.successful === 'boolean'
        && typeof p.errorMessage === 'string'
        && typeof p.traceFilePath === 'string';

    default:
      return false;
  }
}

// helpers
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
