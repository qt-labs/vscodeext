/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import * as net from 'net';
import { randomUUID } from 'crypto';

import { PacketReader, encodeJsonPacket } from './transport';
import {
  type ClientInfo,
  type ElevationHandler,
  type ElevationRequest,
  type SmsError,
  type UserPrompt,
  type UserPromptReply,
  UserPromptType,
  ErrorCategory,
  ErrorCode,
  errorCategoryForCode,
  IPC
} from './types';

// ── JSON-RPC 2.0 wire types ─────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: string;
  result: unknown;
}

interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string;
  error: { code: number; message: string };
}

type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

// ── Pending call bookkeeping ─────────────────────────────────────────────────

export type SuccessHandler = (result: unknown) => void;
export type ErrorHandler = (error: SmsError) => void;
export type ProgressHandler = (params: Record<string, unknown>) => void;
export type MessageHandler = (params: Record<string, unknown>) => void;
export type PromptHandler = (prompt: UserPrompt) => Promise<UserPromptReply>;

interface PendingCall {
  id: string;
  onSuccess: SuccessHandler;
  onError: ErrorHandler;
  onProgress?: ProgressHandler | undefined;
  onMessage?: MessageHandler | undefined;
  onPrompt?: PromptHandler | undefined;
}

export interface JsonRpcDispatcherOptions {
  /** Sent as the top-level `userAgent` and `client` of every request. */
  client?: ClientInfo;
  /**
   * Answers `service/elevation-required`. Without it the dispatcher reports
   * `ready: false` and the operation fails with error 4000.
   */
  onElevationRequired?: ElevationHandler;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isResponse(
  msg: JsonRpcMessage
): msg is JsonRpcSuccessResponse | JsonRpcErrorResponse {
  return 'id' in msg && !('method' in msg);
}

function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return 'method' in msg && !('id' in msg);
}

function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return 'method' in msg && 'id' in msg;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parsePromptType(raw: unknown): UserPromptType | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const map: Record<string, UserPromptType> = {
    choice: UserPromptType.Choice,
    text: UserPromptType.Text,
    directorypath: UserPromptType.DirectoryPath,
    directory: UserPromptType.DirectoryPath,
    filepath: UserPromptType.FilePath,
    file: UserPromptType.FilePath
  };
  return map[raw.toLowerCase()];
}

// ── JsonRpcDispatcher ────────────────────────────────────────────────────────

export class JsonRpcDispatcher {
  private readonly socket: net.Socket;
  private readonly reader = new PacketReader();
  private readonly pending = new Map<string, PendingCall>();
  private readonly client: ClientInfo | undefined;
  private readonly onElevationRequired: ElevationHandler | undefined;
  private disposed = false;

  constructor(socket: net.Socket, options?: JsonRpcDispatcherOptions) {
    this.socket = socket;
    this.client = options?.client;
    this.onElevationRequired = options?.onElevationRequired;

    socket.on('data', (chunk: Buffer) => {
      this.reader.feed(chunk);
    });

    this.reader.on('packet', (pkt: { command: string; data: string }) => {
      if (pkt.command !== 'JSON') {
        return;
      }
      let msg: unknown;
      try {
        msg = JSON.parse(pkt.data);
      } catch {
        return; // Unparseable – drop silently
      }
      if (asRecord(msg)) {
        this.dispatch(msg as JsonRpcMessage);
      }
    });

    socket.once('close', () => {
      this.rejectAll({
        category: ErrorCategory.ServiceConnection,
        code: ErrorCode.SocketError,
        message: 'Socket closed'
      });
    });

    socket.once('error', (err: Error) => {
      this.rejectAll({
        category: ErrorCategory.ServiceConnection,
        code: ErrorCode.SocketError,
        message: err.message
      });
    });
  }

  /**
   * Send a JSON-RPC request and register handlers for the response.
   * Returns the generated request id.
   */
  call(
    method: string,
    params: unknown,
    onSuccess: SuccessHandler,
    onError: ErrorHandler,
    onProgress?: ProgressHandler,
    onPrompt?: PromptHandler,
    onMessage?: MessageHandler
  ): string {
    const id = randomUUID();
    const request: Record<string, unknown> = {
      jsonrpc: '2.0',
      id,
      method
    };
    if (this.client) {
      request.userAgent = this.client.userAgent;
      request.client = {
        author: this.client.author,
        name: this.client.name,
        version: this.client.version
      };
    }
    request.params = params;
    this.pending.set(id, {
      id,
      onSuccess,
      onError,
      onProgress,
      onMessage,
      onPrompt
    });
    this.send(request as unknown as JsonRpcMessage);
    return id;
  }

  /**
   * Send a raw JSON-RPC message (used for responses to service requests).
   */
  send(msg: JsonRpcMessage): void {
    if (this.disposed) {
      return;
    }
    const raw = JSON.stringify(msg);
    this.socket.write(encodeJsonPacket(raw));
  }

  dispose(): void {
    this.disposed = true;
    this.reader.reset();
    this.pending.clear();
  }

  // ── Internal dispatch ────────────────────────────────────────────────────

  /**
   * Tells the three kinds of messages apart in the order the protocol
   * requires: notification, service request, then response. A
   * `service/question` reuses the id of the client request it belongs to,
   * so `method` must be checked before `id`.
   */
  private dispatch(msg: JsonRpcMessage): void {
    if (isNotification(msg)) {
      this.handleNotification(msg);
      return;
    }

    if (isRequest(msg)) {
      this.handleServiceRequest(msg);
      return;
    }

    if (isResponse(msg)) {
      this.handleResponse(msg);
    }
  }

  private handleNotification(msg: JsonRpcNotification): void {
    const params = asRecord(msg.params);
    const callId = nonEmptyString(params?.id);
    if (!params || !callId) {
      return;
    }
    const call = this.pending.get(callId);
    if (!call) {
      return;
    }
    switch (msg.method) {
      case IPC.notifications.progress:
        call.onProgress?.(params);
        break;
      case IPC.notifications.message:
        call.onMessage?.(params);
        break;
      default:
        // Unknown notifications are ignored.
        break;
    }
  }

  private handleServiceRequest(msg: JsonRpcRequest): void {
    switch (msg.method) {
      case IPC.requests.question:
        this.handlePrompt(msg);
        break;
      case IPC.requests.elevationRequired:
        this.handleElevation(msg);
        break;
      default:
        // Unknown service requests get error 2000.
        this.sendError(
          msg.id,
          ErrorCode.UnknownCommand,
          `Unknown method: ${msg.method}`
        );
        break;
    }
  }

  private handleResponse(
    msg: JsonRpcSuccessResponse | JsonRpcErrorResponse
  ): void {
    const call = this.pending.get(msg.id);
    if (!call) {
      return;
    }
    this.pending.delete(msg.id);

    if ('error' in msg) {
      const error = asRecord(msg.error);
      const code =
        typeof error?.code === 'number' ? error.code : ErrorCode.UnknownError;
      call.onError({
        category: errorCategoryForCode(code),
        code: code as ErrorCode,
        message:
          typeof error?.message === 'string' ? error.message : 'Unknown error'
      });
    } else if ('result' in msg) {
      call.onSuccess(msg.result);
    }
  }

  /**
   * `service/question`: its id is the id of the client request it belongs
   * to. A question that cannot be answered is cancelled with an error
   * response, otherwise the service would wait forever.
   */
  private handlePrompt(msg: JsonRpcRequest): void {
    const params = asRecord(msg.params);
    const call = this.pending.get(msg.id);
    const promptType = parsePromptType(params?.type);

    if (!params || !call?.onPrompt || !promptType) {
      this.sendError(
        msg.id,
        ErrorCode.UserCancelled,
        'The client cannot answer this question'
      );
      return;
    }

    const choicesRaw = params.choices;
    const choices =
      typeof choicesRaw === 'string'
        ? choicesRaw.split(',').filter(Boolean)
        : [];

    const prompt: UserPrompt = {
      type: promptType,
      id: (params.id as string | undefined) ?? '',
      title: (params.title as string | undefined) ?? '',
      message: (params.message as string | undefined) ?? '',
      defaultAnswer: (params.defaultAnswer as string | undefined) ?? '',
      choices,
      placeholderText: (params.placeHolderText as string | undefined) ?? ''
    };

    const onPrompt = call.onPrompt;
    Promise.resolve()
      .then(async () => onPrompt(prompt))
      .then((reply) => {
        if (reply.kind === 'cancel') {
          this.sendError(msg.id, ErrorCode.UserCancelled, 'User canceled');
          return;
        }
        const result: Record<string, string> = { id: prompt.id };
        if (reply.kind === 'choice') {
          result.replyChoice = reply.choice;
        } else {
          result.replyText = reply.text;
        }
        this.send({ jsonrpc: '2.0', id: msg.id, result });
      })
      .catch(() => {
        this.sendError(msg.id, ErrorCode.UserCancelled, 'User canceled');
      });
  }

  /**
   * `service/elevation-required`: has its own id. The client starts the
   * elevated helper and answers `{ ready }`.
   */
  private handleElevation(msg: JsonRpcRequest): void {
    const params = asRecord(msg.params);
    const elevatedSocketName = nonEmptyString(params?.elevatedSocketName);
    const authorizationKey = nonEmptyString(params?.authorizationKey);
    if (!elevatedSocketName || !authorizationKey) {
      this.sendError(
        msg.id,
        ErrorCode.InvalidRequestFormat,
        'Missing elevatedSocketName or authorizationKey'
      );
      return;
    }

    const request: ElevationRequest = {
      elevatedSocketName,
      authorizationKey,
      reason: (params?.reason as string | undefined) ?? ''
    };

    const handler = this.onElevationRequired;
    void Promise.resolve()
      .then(async () => (handler ? handler(request) : false))
      .catch(() => false)
      .then((ready) => {
        this.send({ jsonrpc: '2.0', id: msg.id, result: { ready } });
      });
  }

  private sendError(id: string, code: ErrorCode, message: string): void {
    const response: JsonRpcErrorResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message }
    };
    this.send(response);
  }

  private rejectAll(error: SmsError): void {
    for (const call of this.pending.values()) {
      call.onError(error);
    }
    this.pending.clear();
  }
}
