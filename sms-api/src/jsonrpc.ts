/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

import * as net from 'net';
import { randomUUID } from 'crypto';

import { PacketReader, encodeJsonPacket } from './transport';
import {
  type SmsError,
  type UserPrompt,
  type UserPromptReply,
  UserPromptType,
  ErrorCategory,
  ErrorCode
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
  error: { code: number; category?: number; message: string };
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
  private disposed = false;

  constructor(socket: net.Socket) {
    this.socket = socket;

    socket.on('data', (chunk: Buffer) => {
      this.reader.feed(chunk);
    });

    this.reader.on('packet', (pkt: { command: string; data: string }) => {
      if (pkt.command !== 'JSON') {
        return;
      }
      let msg: JsonRpcMessage;
      try {
        msg = JSON.parse(pkt.data) as JsonRpcMessage;
      } catch {
        return; // Unparseable – drop silently
      }
      this.dispatch(msg);
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
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    this.pending.set(id, {
      id,
      onSuccess,
      onError,
      onProgress,
      onMessage,
      onPrompt
    });
    this.send(request);
    return id;
  }

  /**
   * Send a raw JSON-RPC message (used for prompt responses).
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

  private dispatch(msg: JsonRpcMessage): void {
    // Progress notification: { method: "service/progress", params: { id, progress } }
    if (isNotification(msg) && msg.method === 'service/progress') {
      const params = msg.params as Record<string, unknown> | undefined;
      const callId = params?.id as string | undefined;
      if (!callId) {
        return;
      }
      const call = this.pending.get(callId);
      if (call?.onProgress && params) {
        call.onProgress(params);
      }
      return;
    }

    // Message notification: { method: "service/message", params: { id, message } }
    if (isNotification(msg) && msg.method === 'service/message') {
      const params = msg.params as Record<string, unknown> | undefined;
      const callId = params?.id as string | undefined;
      if (!callId) {
        return;
      }
      const call = this.pending.get(callId);
      if (call?.onMessage && params) {
        call.onMessage(params);
      }
      return;
    }

    // User prompt request from server: { method: "service/question", id, params }
    if (isRequest(msg) && msg.method === 'service/question') {
      this.handlePrompt(msg);
      return;
    }

    // Standard response
    if (isResponse(msg)) {
      this.handleResponse(msg);
      return;
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
      call.onError({
        category:
          (msg.error.category as ErrorCategory | undefined) ??
          ErrorCategory.Unknown,
        code: msg.error.code as ErrorCode,
        message: msg.error.message
      });
    } else if ('result' in msg) {
      call.onSuccess(msg.result);
    }
  }

  private handlePrompt(msg: JsonRpcRequest): void {
    const params = msg.params as Record<string, unknown> | undefined;
    if (!params) {
      return;
    }

    // The prompt's request id is used to look up the pending call
    const call = this.pending.get(msg.id);
    if (!call?.onPrompt) {
      return;
    }

    const promptType = parsePromptType(params.type);
    if (!promptType) {
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

    void call.onPrompt(prompt).then((reply) => {
      if (reply.kind === 'cancel') {
        const errorResp: JsonRpcErrorResponse = {
          jsonrpc: '2.0',
          id: msg.id,
          error: {
            code: ErrorCode.UserCancelled,
            message: 'User canceled while answering prompt'
          }
        };
        this.send(errorResp);
      } else {
        const result: Record<string, string> = { id: prompt.id };
        if (reply.kind === 'choice') {
          result.replyChoice = reply.choice;
        } else {
          result.replyText = reply.text;
        }
        const resp: JsonRpcSuccessResponse = {
          jsonrpc: '2.0',
          id: msg.id,
          result
        };
        this.send(resp);
      }
    });
  }

  private rejectAll(error: SmsError): void {
    for (const call of this.pending.values()) {
      call.onError(error);
    }
    this.pending.clear();
  }
}
