// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import path from 'path';
import { DebugProtocol } from '@vscode/debugprotocol';
import { Scope, Source, StackFrame, StoppedEvent } from '@vscode/debugadapter';

import {
  QmlDebugClient,
  IQmlDebugClient,
  QmlDebugConnection,
  Server,
  DebugMessageClient,
  IMessageType,
  QmlDebugConnectionState
} from '@debug/debug-connection';
import { Timer } from '@debug/timer';
import { createLogger } from 'qt-lib';
import {
  BreakpointState,
  QmlBreakpoint,
  QmlDebugSession
} from '@debug/debug-adapter';
import {
  BACKTRACE,
  BREAKONSIGNAL,
  BREAKPOINT,
  CLEARBREAKPOINT,
  COLUMN,
  CONDITION,
  CONNECT,
  CONTEXT,
  CONTINEDEBUGGING,
  DISCONNECT,
  ENABLED,
  EVALUATE,
  EVENT,
  EXPRESSION,
  FRAME,
  HANDLES,
  IGNORECOUNT,
  IN,
  INTERRUPT,
  LINE,
  LOOKUP,
  NEXT,
  NUMBER,
  OUT,
  SCOPE,
  SCRIPTREGEXP,
  SETBREAKPOINT,
  STEPACTION,
  TARGET,
  TYPE,
  V8DEBUG,
  V8MESSAGE,
  V8REQUEST,
  VERSION
} from '@debug/qmlv8debuggerclientconstants';
import { Packet } from '@debug/packet';
import { DebuggerCommand } from '@debug/debugger-command';
import { FileFinder } from '@debug/file-finder';
import { QmlEngineUI } from '@debug/ui';

const logger = createLogger('qml-engine');

type LookUpItems = Set<number>;

export enum DebuggerState {
  DebuggerNotReady, // Debugger not started

  EngineSetupRequested, // Engine starts
  EngineSetupFailed,

  EngineRunRequested,
  EngineRunFailed,

  InferiorUnrunnable, // Used in the core dump adapter

  InferiorRunRequested, // Debuggee requested to run
  InferiorRunOk, // Debuggee running
  InferiorRunFailed, // Debuggee not running

  InferiorStopRequested, // Debuggee running, stop requested
  InferiorStopOk, // Debuggee stopped
  InferiorStopFailed, // Debuggee not stopped, will kill debugger

  InferiorShutdownRequested,
  InferiorShutdownFinished,

  EngineShutdownRequested,
  EngineShutdownFinished,

  DebuggerFinished
}

export enum DebuggerStartMode {
  NoStartMode,
  StartInternal, // Start current start project's binary
  StartExternal, // Start binary found in file system
  AttachToLocalProcess, // Attach to running local process by process id
  AttachToCrashedProcess, // Attach to crashed process by process id
  AttachToCore, // Attach to a core file
  AttachToRemoteServer, // Attach to a running gdbserver
  AttachToRemoteProcess, // Attach to a running remote process
  AttachToQmlServer, // Attach to a running QmlServer
  StartRemoteProcess // Start and attach to a remote process
}

enum QtMsgType {
  QtDebugMsg,
  QtInfoMsg,
  QtWarningMsg,
  QtCriticalMsg,
  QtFatalMsg
}

export enum StepAction {
  Continue,
  StepIn,
  StepOut,
  Next
}

interface QmlMessage {
  type: string;
  seq: number;
}

interface IQmlEvent extends QmlMessage {
  event: string;
  body: IResponseBodyBreak;
}

interface IResponseBodyBreak {
  invocationText: string;
  sourceLineText: string;
  script: string;
  breakpoints: number[];
  sourceLine: number;
}

interface QmlResponse<QmlResponseBody> extends QmlMessage {
  type: 'response';
  request_seq: number;
  command: string;
  success: boolean;
  running: boolean;
  body: QmlResponseBody;
}

interface QmlResponseBodySetBreakpoint {
  type: string;
  breakpoint: number;
  line?: number;
  actual_locations?: number[];
}

interface QmlSetBreakpointResponse
  extends QmlResponse<QmlResponseBodySetBreakpoint> {
  command: 'breakpoint';
}

interface QmlVariable {
  handle?: number;
  name?: string;
  type: string;
  value: unknown;
  ref?: number;
  properties?: QmlVariable[];
}

interface QmlScope {
  frameIndex: number;
  index: number;
  type: number;
  object?: QmlVariable;
}

interface QmlFrame {
  index: number;
  func: string;
  script: string;
  line: number;
  debuggerFrame: boolean;
  scopes: QmlScope[];
}

interface QmlBacktrace {
  fromFrame: number;
  toFrame: number;
  frames: QmlFrame[];
}

type QmlLookupBody = Record<string, QmlVariable>;
type QmlLookupResponse = QmlResponse<QmlLookupBody>;
type QmlFrameResponse = QmlResponse<QmlFrame>;
type QmlScopeResponse = QmlResponse<QmlScope>;
type QmlEvaluateResponse = QmlResponse<QmlVariable>;

export interface QmlContinueResponse extends QmlResponse<undefined> {
  command: 'continue';
}

interface QmlBacktraceResponse extends QmlResponse<QmlBacktrace> {
  command: 'backtrace';
}

export class QmlEngine extends QmlDebugClient implements IQmlDebugClient {
  private readonly _ui = new QmlEngineUI();
  private _buildDirs: string[] = [];
  private _connectionState = QmlDebugConnectionState.Unavailable;
  private readonly _callbackForToken = new Map<
    number,
    // TODO: Get rid of unknown
    unknown
  >();
  private readonly _currentlyLookingUp: LookUpItems = new Set<number>();
  private readonly _refs = new Set<number>();
  private readonly _breakpointsSync = new Map<number, QmlBreakpoint>();
  private readonly _breakpointsTemp = new Array<string>();
  readonly mainQmlThreadId = 1;
  private _sendBuffer: Packet[] = [];
  private _sequence = -1;
  private _thisReference = -1;
  private readonly _msgClient: DebugMessageClient | undefined;
  private readonly _startMode: DebuggerStartMode =
    DebuggerStartMode.AttachToQmlServer;
  private _server: Server | undefined;
  private _isDying = false;
  private _state = DebuggerState.DebuggerNotReady;
  private _retryOnConnectFail = false;
  private _automaticConnect = false;
  private readonly _session: QmlDebugSession;
  private _onShutdownEngine: (() => void) | undefined;
  private readonly _connectionTimer: Timer = new Timer();
  constructor(session: QmlDebugSession) {
    super('V8Debugger', new QmlDebugConnection());
    this._ui = new QmlEngineUI();
    this._session = session;
    this._connectionTimer.setInterval(4000);
    this._connectionTimer.setSingleShot(true);
    this._connectionTimer.onTimeout(() => {
      this.checkConnectionState();
    });
    this.connection.onConnectionFailed(() => {
      this.connectionFailed();
    });
    this.connection.onConnected(() => {
      this._connectionTimer.stop();
      this.connectionEstablished();
    });
    this.connection.onDisconnected(() => {
      this.disconnected();
    });
    this._msgClient = new DebugMessageClient(this.connection);
    this._msgClient.newState((state: QmlDebugConnectionState) => {
      if (!this._msgClient) {
        throw new Error('Message client is not set');
      }
      this.logServiceStateChange(
        this._msgClient.name,
        this._msgClient.serviceVersion(),
        state
      );
    });
    this._msgClient.message((message: IMessageType) => {
      QmlEngine.appendDebugOutput(message);
    });
  }
  get thisReference() {
    return this._thisReference;
  }
  set thisReference(ref: number) {
    this._thisReference = ref;
  }
  set onShutdownEngine(cb: () => void) {
    this._onShutdownEngine = cb;
  }

  get ui() {
    return this._ui;
  }

  set buildDirs(dirs: string[]) {
    this._buildDirs = dirs;
  }
  get buildDirs() {
    return this._buildDirs;
  }

  get connectionState() {
    return this._connectionState;
  }
  override stateChanged(state: QmlDebugConnectionState): void {
    this._connectionState = state;
    logger.info(
      this.name,
      this.serviceVersion() as unknown as string,
      QmlDebugConnectionState[state]
    );
    if (state === QmlDebugConnectionState.Enabled) {
      const cb = () => {
        void this.flushSendBuffer();
        const jsonParameters = {
          redundantRefs: false,
          namesAsObjects: false
        };
        const msg = new Packet();
        msg.writeJsonUTF8(jsonParameters);
        this.runDirectCommand(CONNECT, msg.data);
        this.runCommand(new DebuggerCommand(VERSION));
      };
      Timer.singleShot(0, cb);
    }
  }
  runCommand<T>(command: DebuggerCommand, cb?: (response: T) => void) {
    ++this._sequence;
    const object = {
      type: 'request',
      command: command.function,
      seq: this._sequence,
      arguments: command.args
    };
    if (cb) {
      this._callbackForToken.set(this._sequence, cb);
    }
    const msg = new Packet();
    msg.writeJsonUTF8(object);
    this.runDirectCommand(V8REQUEST, msg.data);
    return this._sequence;
  }
  async tryClaimBreakpoint(bp: QmlBreakpoint) {
    return this.requestBreakpointInsertion(bp);
  }
  async requestBreakpointInsertion(bp: QmlBreakpoint) {
    return this.insertBreakpoint(bp);
  }
  async insertBreakpoint(bp: QmlBreakpoint) {
    const response = await this.setBreakpoint(
      SCRIPTREGEXP,
      bp.filename,
      true,
      bp.line,
      0,
      bp.condition ?? undefined,
      bp.hitCount ?? 0
    );
    const breakpointId = response.body.breakpoint;
    if (breakpointId) {
      this._breakpointsSync.set(breakpointId, bp);
    }
    return breakpointId;
  }

  clearBreakpoint(bp: QmlBreakpoint) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "clearbreakpoint",
    //      "arguments" : { "breakpoint" : <number of the break point to clear>
    //                    }
    //    }
    if (bp.state !== BreakpointState.BreakpointInserted) {
      return undefined;
    }
    if (bp.id === undefined) {
      throw new Error('Breakpoint ID is not set');
    }

    const cmd = new DebuggerCommand(CLEARBREAKPOINT);
    cmd.arg(BREAKPOINT, bp.id);
    return this.runCommand(cmd);
  }

  async setBreakpoint(
    type: string,
    target: string,
    enabled: boolean,
    line: number,
    column: number,
    condition: string | undefined,
    ignoreCount: number
  ) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "setbreakpoint",
    //      "arguments" : { "type"        : <"function" or "script" or "scriptId" or "scriptRegExp">
    //                      "target"      : <function expression or script identification>
    //                      "line"        : <line in script or function>
    //                      "column"      : <character position within the line>
    //                      "enabled"     : <initial enabled state. True or false, default is true>
    //                      "condition"   : <string with break point condition>
    //                      "ignoreCount" : <number specifying the number of break point hits to ignore, default value is 0>
    //                    }
    //    }

    const cmd = new DebuggerCommand(SETBREAKPOINT);
    cmd.arg(TYPE, type);
    cmd.arg(ENABLED, enabled);
    if (type === SCRIPTREGEXP) {
      // TODO: Use target file instead here
      cmd.arg(TARGET, target);
    } else {
      cmd.arg(TARGET, target);
    }
    if (line) {
      cmd.arg(LINE, line - 1);
    }
    if (column) {
      cmd.arg(COLUMN, column - 1);
    }
    if (condition) {
      cmd.arg(CONDITION, condition);
    }
    cmd.arg(IGNORECOUNT, ignoreCount);
    const task = new Promise<QmlSetBreakpointResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlSetBreakpointResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
      });
    });
    return task;
  }

  async backtrace(args: DebugProtocol.StackTraceArguments) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "backtrace",
    //      "arguments" : { "fromFrame" : <number>
    //                      "toFrame" : <number>
    //                      "bottom" : <boolean, set to true if the bottom of the
    //                          stack is requested>
    //                    }
    //    }

    const cmd = new DebuggerCommand(BACKTRACE);
    // wait until the backtrace response is received
    const task = new Promise<QmlBacktraceResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlBacktraceResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
      });
    });
    const result = await task;
    const backtrace = result.body;
    const fileFinder = new FileFinder();
    fileFinder.buildDirs = this.buildDirs;
    let frameCount = 0;
    const stackFrames = await Promise.all(
      backtrace.frames
        .filter((_value, index) => {
          if (args.startFrame !== undefined) {
            if (index < args.startFrame) {
              return false;
            }
          }

          if (args.levels !== undefined) {
            if (frameCount >= args.levels) {
              return false;
            }
            frameCount++;
          }

          return true;
        })
        .map(async (frame) => {
          const physicalPath = await fileFinder.findFile(frame.script);
          if (!physicalPath) {
            const err =
              `Cannot find physical path for: "${frame.script}".` +
              ' Use "buildDirs" to set the build directories in "launch.json".';
            throw new Error(err);
          }
          const parsedPath = path.parse(physicalPath);
          return new StackFrame(
            frame.index,
            frame.func,
            new Source(parsedPath.base, physicalPath),
            frame.line + 1
          );
        })
    );
    const length = backtrace.frames.length;
    return { stackFrames, length };
  }
  static handleResponse<T>(response: T, resolve: (response: T) => void) {
    resolve(response);
  }
  override messageReceived(packet: Packet): void {
    const command = packet.readStringUTF8();
    if (command !== V8DEBUG) {
      logger.error('Unexpected header:', command);
      return;
    }
    const type = packet.readStringUTF8();
    logger.info('Received message:', type);
    if (type == CONNECT) {
      this.stateChanged(QmlDebugConnectionState.Connected);
      logger.info(`${V8DEBUG} debugging session started`);
    } else if (type == INTERRUPT) {
      logger.info('Debug break requested');
    } else if (type == BREAKONSIGNAL) {
      logger.info('Break on signal handler requested');
    } else if (type == V8MESSAGE) {
      logger.info('V8 message received');
      this.analyzeV8Message(packet);
    }
  }
  async lookup(item: number) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "lookup",
    //      "arguments" : { "handles"       : <array of handles>,
    //                      "includeSource" : <boolean indicating whether
    //                                          the source will be included when
    //                                          script objects are returned>,
    //                    }
    //    }

    if (!this._currentlyLookingUp.has(item)) {
      this._currentlyLookingUp.add(item);
    }

    const cmd = new DebuggerCommand(LOOKUP);
    cmd.arg(HANDLES, [item]);
    const task = new Promise<QmlLookupResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlLookupResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
      });
    });
    const result = await task;
    if (!result.success) {
      logger.error('Lookup failed');
      return undefined;
    }
    return this.handleLookup(result);
  }
  private static convertScopeName(type: number) {
    switch (type) {
      case -1:
        return 'Qml Context';
      case 0:
        return 'Global';
      case 1:
        return 'Local';
      case 2:
        return 'With';
      case 3:
        return 'Closure';
      case 4:
        return 'Catch';
      default:
        throw new Error('Invalid scope type');
    }
  }
  private static convertScopeType(type: number) {
    switch (type) {
      case 0:
        return 'globals';
      case 1:
      case 2:
      case 4:
        return 'locals';
      default:
        throw new Error('Invalid scope type');
    }
  }
  async frame(framerNumber: number) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "frame",
    //      "arguments" : { "number" : <frame number> }
    //    }
    const cmd = new DebuggerCommand(FRAME);
    cmd.arg(NUMBER, framerNumber);
    const task = new Promise<QmlFrameResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlFrameResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
      });
    });
    const result = await task;
    if (!result.success) {
      logger.error('Frame request failed');
      return undefined;
    }
    return this.handleFrame(framerNumber, result);
  }
  async setVariable(args: DebugProtocol.SetVariableArguments) {
    const expr = `${args.name} = ${args.value};`;
    return this.evaluate(expr, -1);
  }
  async evaluate(expr: string, frameID = 0, context = 0) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "evaluate",
    //      "arguments" : { "expression"    : <expression to evaluate>,
    //                      "frame"         : <number>,
    //                      "global"        : <boolean>,
    //                      "disable_break" : <boolean>,
    //                      "context"       : <object id>
    //                    }
    //    }

    const cmd = new DebuggerCommand(EVALUATE);
    cmd.arg(EXPRESSION, expr);
    cmd.arg(FRAME, frameID);
    if (context >= 0) {
      cmd.arg(CONTEXT, context);
    }
    const task = new Promise<QmlEvaluateResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlEvaluateResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
      });
    });
    const result = await task;
    if (!result.success) {
      logger.error('Evaluate request failed');
      return undefined;
    }
    return result;
  }
  async handleFrame(framerNumber: number, response: QmlFrameResponse) {
    //    { "seq"         : <number>,
    //      "type"        : "response",
    //      "request_seq" : <number>,
    //      "command"     : "frame",
    //      "body"        : { "index"          : <frame number>,
    //                        "receiver"       : <frame receiver>,
    //                        "func"           : <function invoked>,
    //                        "script"         : <script for the function>,
    //                        "constructCall"  : <boolean indicating whether the function was called as constructor>,
    //                        "debuggerFrame"  : <boolean indicating whether this is an internal debugger frame>,
    //                        "arguments"      : [ { name: <name of the argument - missing of anonymous argument>,
    //                                               value: <value of the argument>
    //                                             },
    //                                             ... <the array contains all the arguments>
    //                                           ],
    //                        "locals"         : [ { name: <name of the local variable>,
    //                                               value: <value of the local variable>
    //                                             },
    //                                             ... <the array contains all the locals>
    //                                           ],
    //                        "position"       : <source position>,
    //                        "line"           : <source line>,
    //                        "column"         : <source column within the line>,
    //                        "sourceLineText" : <text for current source line>,
    //                        "scopes"         : [ <array of scopes, see scope request below for format> ],

    //                      }
    //      "running"     : <is the VM running after sending this response>
    //      "success"     : true
    //    }
    const frame = response.body;
    const scopes: DebugProtocol.Scope[] = [];
    for (const scopeRef of frame.scopes) {
      const dapScope = await this.scope(scopeRef.index, framerNumber);
      if (dapScope) {
        scopes.push(dapScope);
      }
    }
    return scopes;
  }

  async shutdownInferior() {
    if (this.state != DebuggerState.EngineRunRequested) {
      await this.disconnect();
    }
    this.closeConnection();
    this.ui.dispose();
    this.notifyInferiorShutdownFinished();
  }
  async disconnect() {
    // End session.
    //    { "seq"     : <number>,
    //      "type"    : "request",
    //      "command" : "disconnect",
    //    }
    const cmd = new DebuggerCommand(DISCONNECT);
    const task = new Promise<QmlBacktraceResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlBacktraceResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
      });
    });

    return task;
  }
  notifyInferiorShutdownFinished() {
    logger.info('INFERIOR FINISHED SHUT DOWN');
    this._state = DebuggerState.InferiorShutdownFinished;
    this.doShutdownEngine();
  }

  async scope(number: number, frameNumber: number) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "scope",
    //      "arguments" : { "number" : <scope number>
    //                      "frameNumber" : <frame number, optional uses selected
    //                                      frame if missing>
    //                    }
    //    }

    const cmd = new DebuggerCommand(SCOPE);
    cmd.arg(NUMBER, number);
    if (frameNumber !== -1) {
      cmd.arg(FRAME, frameNumber);
    }
    const task = new Promise<QmlScopeResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlScopeResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
      });
    });
    const result = await task;
    if (!result.success) {
      logger.error('Scope request failed');
      return undefined;
    }
    const scope = QmlEngine.handleScope(result);
    return scope;
  }
  static handleScope(response: QmlScopeResponse) {
    //    { "seq"         : <number>,
    //      "type"        : "response",
    //      "request_seq" : <number>,
    //      "command"     : "scope",
    //      "body"        : { "index"      : <index of this scope in the scope chain. Index 0 is the top scope
    //                                        and the global scope will always have the highest index for a
    //                                        frame>,
    //                        "frameIndex" : <index of the frame>,
    //                        "type"       : <type of the scope:
    //                                         0: Global
    //                                         1: Local
    //                                         2: With
    //                                         3: Closure
    //                                         4: Catch >,
    //                        "object"     : <the scope object defining the content of the scope.
    //                                        For local and closure scopes this is transient objects,
    //                                        which has a negative handle value>
    //                      }
    //      "running"     : <is the VM running after sending this response>
    //      "success"     : true
    //    }
    const scope = response.body;
    if (scope.object === undefined) {
      logger.error('Scope object is undefined');
      return undefined;
    }
    // check type of scope.object.value is unknown
    if (typeof scope.object.value !== 'number') {
      logger.error('Scope object value is not a number');
      return undefined;
    }
    if (scope.object.value === 0) {
      logger.error('Scope object value is 0');
      return undefined;
    }

    const dapScope: DebugProtocol.Scope = new Scope(
      QmlEngine.convertScopeName(scope.type),
      scope.index,
      false
    );

    dapScope.presentationHint = QmlEngine.convertScopeType(scope.type);
    if (scope.object.handle !== undefined) {
      dapScope.variablesReference = scope.object.handle + 1;
    } else if (scope.object.ref !== undefined) {
      dapScope.variablesReference = scope.object.ref + 1;
    }
    dapScope.namedVariables = scope.object.value;
    return dapScope;
  }
  async getThisVariable() {
    const exp = 'this';
    const response = await this.evaluate(exp);
    if (!response || !response.success) {
      return undefined;
    }
    const rawThisVariable = response.body;
    rawThisVariable.name = 'this';
    const thisVariable = QmlEngine.generateDapVariable(rawThisVariable);
    if (!thisVariable) {
      return undefined;
    }
    return thisVariable;
  }
  isRunning() {
    return this._state === DebuggerState.InferiorRunOk;
  }

  private clearRefs() {
    this._refs.clear();
    this._thisReference = -1;
  }
  async continueDebugging(action: StepAction) {
    //    { "seq"       : <number>,
    //      "type"      : "request",
    //      "command"   : "continue",
    //      "arguments" : { "stepaction" : <"in", "next" or "out">,
    //                      "stepcount"  : <number of steps (default 1)>
    //                    }
    //    }
    const cmd = new DebuggerCommand(CONTINEDEBUGGING);

    if (action === StepAction.StepIn) {
      cmd.arg(STEPACTION, IN);
    } else if (action === StepAction.StepOut) {
      cmd.arg(STEPACTION, OUT);
    } else if (action === StepAction.Next) {
      cmd.arg(STEPACTION, NEXT);
    }
    this.clearRefs();

    const task = new Promise<QmlContinueResponse>((resolve) => {
      this.runCommand(cmd, (debuggerResponse: QmlContinueResponse) => {
        QmlEngine.handleResponse(debuggerResponse, resolve);
        this.notifyInferiorRunOk();
      });
    });
    return task;
  }
  get refs() {
    return this._refs;
  }
  static convertQmlTypeToValue(variable: QmlVariable) {
    if (variable.type === 'object') {
      if (variable.value !== null) {
        return 'object';
      } else {
        return 'null';
      }
    } else if (variable.type === 'function') {
      return 'function';
    } else if (variable.type === 'number') {
      return (variable.value as number).toString();
    } else if (variable.type === 'boolean') {
      return (variable.value as boolean) ? 'true' : 'false';
    } else if (variable.type === 'undefined') {
      return undefined;
    } else if (variable.type === 'string') {
      const stringValue = variable.value as string;
      return '"' + stringValue + '"';
    }
    return undefined; // Ensure a return value for unsupported types
  }
  private static generateDapVariable(variable: QmlVariable) {
    const dapVariable: DebugProtocol.Variable = {
      name: variable.name ?? '',
      type: variable.type,
      value: '',
      variablesReference: 0,
      namedVariables: 0,
      indexedVariables: 0,
      presentationHint: {
        kind: 'property'
      }
    };
    const value = QmlEngine.convertQmlTypeToValue(variable);
    if (value === undefined) {
      return undefined;
    }
    dapVariable.value = value;
    if (variable.type === 'object') {
      if (variable.handle !== undefined) {
        dapVariable.variablesReference = variable.handle;
      }
      dapVariable.namedVariables = variable.value as number;
      if (dapVariable.namedVariables !== 0 && variable.ref !== undefined) {
        dapVariable.variablesReference = variable.ref + 1;
      }
    } else if (variable.type === 'function' && dapVariable.presentationHint) {
      dapVariable.presentationHint.kind = 'method';
    }
    return dapVariable;
  }
  handleLookup(response: QmlLookupResponse) {
    //    { "seq"         : <number>,
    //      "type"        : "response",
    //      "request_seq" : <number>,
    //      "command"     : "lookup",
    //      "body"        : <array of serialized objects indexed using their handle>
    //      "running"     : <is the VM running after sending this response>
    //      "success"     : true
    //    }

    const body = response.body;
    const retVariables: DebugProtocol.Variable[] = [];
    const variables = Object.values(body);
    for (const variable of variables) {
      const subVariables = variable.properties;
      if (!subVariables) {
        continue;
      }
      for (const subVar of subVariables) {
        let handle = -1;
        if (subVar.handle !== undefined) {
          handle = subVar.handle;
        } else if (subVar.ref !== undefined) {
          handle = subVar.ref;
        }
        if (handle !== -1) {
          this._currentlyLookingUp.delete(handle);
          this._refs.add(handle);
        }
        const dapVar = QmlEngine.generateDapVariable(subVar);
        if (dapVar) {
          retVariables.push(dapVar);
        }
      }
    }
    return retVariables;
  }
  analyzeV8Message(packet: Packet) {
    const message = packet.readJsonUTF8() as QmlMessage;
    const type = message.type;
    if (type === 'response') {
      const response = message as QmlResponse<QmlResponseBodySetBreakpoint>;
      const debugCommand = response.command;
      const success = response.success;
      if (!success) {
        logger.info('Request was unsuccessful');
      }
      const seq = response.request_seq;
      if (this._callbackForToken.has(seq)) {
        const cb = this._callbackForToken.get(seq);
        this._callbackForToken.delete(seq);
        if (cb) {
          const castedCB = cb as (response: unknown) => void;
          castedCB(response);
        }
      }
      logger.info('Request sequence:', seq as unknown as string);
      if (debugCommand === DISCONNECT) {
        logger.info('Debugging session ended');
      } else if (debugCommand === CONTINEDEBUGGING) {
        logger.info('Continue debugging');
      } else if (debugCommand === CLEARBREAKPOINT) {
        logger.info('Clear breakpoint');
      } else if (debugCommand === SETBREAKPOINT) {
        //                { "seq"         : <number>,
        //                  "type"        : "response",
        //                  "request_seq" : <number>,
        //                  "command"     : "setbreakpoint",
        //                  "body"        : { "type"       : <"function" or "script">
        //                                    "breakpoint" : <break point number of the new break point>
        //                                  }
        //                  "running"     : <is the VM running after sending this response>
        //                  "success"     : true
        //                }
        const body = response.body;
        const index = body.breakpoint;
        logger.info('Breakpoint index:', index as unknown as string);
        if (this._breakpointsSync.has(seq)) {
          const bp = this._breakpointsSync.get(seq);
          this._breakpointsSync.delete(seq);
          const actualLocations = body.actual_locations;
          if (actualLocations) {
            //The breakpoint requested line should be same as actual line
            if (bp && bp.state !== BreakpointState.BreakpointInserted) {
              // bp->setActualLine(actualLocations[0]);
              // bp->setActualColumn(actualLocations[1]);
              logger.info('bp.line:', bp.line.toString());
            }
          }
        } else {
          this._breakpointsTemp.push(seq.toString());
        }
      }
    } else if (type == EVENT) {
      logger.info('Event received');
      const response = message as IQmlEvent;
      const eventType = response.event;
      if (eventType === 'break') {
        logger.info('Break event');
        // clearRefs();
        const breakData = response.body;
        const invocationText = breakData.invocationText;
        const scriptUrl = breakData.script;
        const sourceLineText = breakData.sourceLineText;
        const v8BreakpointIdList = breakData.breakpoints;
        logger.info('invocationText:', invocationText);
        logger.info('scriptUrl:', scriptUrl);
        logger.info('sourceLineText:', sourceLineText);
        logger.info('v8BreakpointIdList:', v8BreakpointIdList.join(','));

        if (this.state === DebuggerState.InferiorRunOk) {
          this.notifyInferiorSpontaneousStop(breakData);
        }
      }
    }
  }
  notifyInferiorRunOk() {
    this.setState(DebuggerState.InferiorRunOk);
  }

  notifyInferiorSpontaneousStop(breakData: IResponseBodyBreak) {
    logger.info('NOTE: INFERIOR SPONTANEOUS STOP');
    const stoppedEvent: DebugProtocol.StoppedEvent = new StoppedEvent(
      'breakpoint',
      this.mainQmlThreadId
    );
    const breakpointIds = breakData.breakpoints;
    const description: string[] = [];
    description.push(breakData.script);
    description.push(breakData.sourceLineText);
    description.push(breakData.invocationText);
    description.push(breakData.breakpoints.join(','));
    stoppedEvent.body.description = description.join(':');
    stoppedEvent.body.hitBreakpointIds = breakData.breakpoints;

    logger.info('Stopped event: breakpointIds: ', breakpointIds.join(','));
    this._session.sendEvent(stoppedEvent);
    this.setState(DebuggerState.InferiorStopOk);
  }
  runDirectCommand(type: string, msg: Buffer) {
    const packet = new Packet();
    packet.writeStringUTF8(V8DEBUG);
    packet.writeStringUTF8(type);
    packet.writeBuffer(msg);
    if (this.getState() === QmlDebugConnectionState.Enabled) {
      void this.sendMessage(packet);
    } else {
      this._sendBuffer.push(packet);
    }
  }
  async flushSendBuffer() {
    if (this.getState() !== QmlDebugConnectionState.Enabled) {
      throw new Error('Connection is not enabled');
    }
    for (const packet of this._sendBuffer) {
      await this.sendMessage(packet);
    }
    this._sendBuffer = [];
  }

  logServiceStateChange(
    service: string,
    version: number,
    newState: QmlDebugConnectionState
  ) {
    switch (newState) {
      case QmlDebugConnectionState.Unavailable:
        this.showConnectionStateMessage(
          `Status of "${service}" Version: ${version} changed to 'unavailable'.`
        );
        break;
      case QmlDebugConnectionState.Enabled:
        this.showConnectionStateMessage(
          `Status of "${service}" Version: ${version} changed to 'enabled'.`
        );
        break;
      case QmlDebugConnectionState.NotConnected:
        this.showConnectionStateMessage(
          `Status of "${service}" Version: ${version} changed to 'not connected'.`
        );
        break;
      case QmlDebugConnectionState.Connected:
        this.showConnectionStateMessage(
          `Status of "${service}" Version: ${version} changed to 'connected'.`
        );
        break;
    }
  }

  showConnectionStateMessage(message: string) {
    if (this._isDying) {
      return;
    }
    logger.info('QML Debugger: ' + message);
  }
  static appendDebugOutput(message: IMessageType) {
    switch (message.type as QtMsgType) {
      case QtMsgType.QtInfoMsg:
      case QtMsgType.QtDebugMsg:
        logger.info(message.message);
        break;
      case QtMsgType.QtWarningMsg:
        logger.warn(message.message);
        break;
      case QtMsgType.QtCriticalMsg:
      case QtMsgType.QtFatalMsg:
        logger.error(message.message);
        break;
      default:
        logger.info(message.message);
        break;
    }
    // TODO: Print with logger for now and later use vscode debug console
  }
  checkConnectionState() {
    if (!this.isConnected()) {
      this.closeConnection();
      this.connectionStartupFailed();
    }
  }
  closeConnection() {
    this._automaticConnect = false;
    this._retryOnConnectFail = false;
    this._connectionTimer.stop();
    this.connection.close();
  }
  connectionEstablished() {
    if (this.state == DebuggerState.EngineRunRequested) {
      this.notifyEngineRunAndInferiorRunOk();
    }
  }
  notifyEngineRunAndInferiorRunOk() {
    logger.info('NOTE: ENGINE RUN AND INFERIOR RUN OK');
    this.ui.removeWaitingForDebugger();
    void this.ui.showSuccesfullAttach();
    this.setState(DebuggerState.InferiorRunOk);
  }
  disconnected() {
    if (this._isDying) {
      return;
    }
    logger.info('QML debugger disconnected');
    this.notifyInferiorExited();
  }
  notifyInferiorExited() {
    logger.info('NOTE: INFERIOR EXITED');
    this.setState(DebuggerState.InferiorShutdownFinished);
    this.ui.removeWaitingForDebugger();
    this.doShutdownEngine();
  }
  connectionFailed() {
    if (this.isConnected()) {
      logger.error('Connection to the QML debugger was lost');
    } else {
      this._connectionTimer.stop();
      this.connectionStartupFailed();
    }
  }
  connectionStartupFailed() {
    if (this._isDying) {
      return;
    }
    if (this._retryOnConnectFail) {
      // retry after 500 milliseconds ...
      Timer.singleShot(500, () => {
        logger.info('Retrying connection ...');
        this.beginConnection();
      });
      return;
    }
    logger.error('Cannot connect to the in-process QML debugger');
    // Do you want to retry?
    // TODO: Show user an info message
  }
  isConnected() {
    return this.connection.isConnected();
  }
  set server(server: Server | undefined) {
    this._server = server;
  }
  get server() {
    return this._server;
  }
  setupEngine() {
    if (this.server === undefined) {
      throw new Error('Server is not set');
    }
    this.notifyEngineSetupOk();

    if (this.state !== DebuggerState.EngineRunRequested) {
      throw new Error('Unexpected state:' + this.state);
    }
    void this.ui.showWaitingForDebugger(this.server.port.toString());
    if (this._startMode === DebuggerStartMode.AttachToQmlServer) {
      this.tryToConnect();
    }
    if (this._automaticConnect) {
      this.beginConnection();
    }
  }
  start() {
    this.setState(DebuggerState.EngineSetupRequested);
    logger.info('CALL: SETUP ENGINE');
    this.setupEngine();
  }
  tryToConnect() {
    logger.info('QML Debugger: Trying to connect ...');
    this._retryOnConnectFail = true;

    if (this.state === DebuggerState.EngineRunRequested) {
      if (this._isDying) {
        // Probably cpp is being debugged and hence we did not get the output yet.
        this.appStartupFailed('No application output received in time');
      } else {
        this.beginConnection();
      }
    } else {
      this._automaticConnect = true;
    }
  }
  beginConnection() {
    if (
      this.state !== DebuggerState.EngineRunRequested &&
      this._retryOnConnectFail
    ) {
      return;
    }
    if (this.server === undefined) {
      throw new Error('Server is not set');
    }
    let host = this.server.host;
    if (host === '') {
      host = 'localhost';
    }
    const port = this.server.port;
    const connection = this.connection;
    if (connection.isConnected()) {
      return;
    }
    connection.connectToHost(host, port);
    this._connectionTimer.start();
  }
  appStartupFailed(errorMessage: string) {
    logger.error(
      'Cannot connect to the in-process QML debugger: ' + errorMessage
    );
    this.ui.showError(errorMessage);
    this.notifyEngineRunFailed();
  }
  notifyEngineRunFailed() {
    logger.info('NOTE: ENGINE RUN FAILED');
    this.setState(DebuggerState.EngineRunFailed);
    this.doShutdownEngine();
  }
  doShutdownEngine() {
    this.setState(DebuggerState.EngineShutdownRequested);
    this.startDying();
    logger.info('CALL: SHUTDOWN ENGINE');
    this.shutdownEngine();
  }
  startDying() {
    this._isDying = true;
  }
  shutdownEngine() {
    if (this._onShutdownEngine) {
      this._onShutdownEngine();
    }
    this.notifyEngineShutdownFinished();
  }
  notifyEngineShutdownFinished() {
    logger.info('NOTE: ENGINE SHUTDOWN FINISHED');
    this.setState(DebuggerState.EngineShutdownFinished);
    this.doFinishDebugger();
  }
  doFinishDebugger() {
    this.setState(DebuggerState.DebuggerFinished);
  }
  notifyEngineSetupOk() {
    logger.info('NOTE: ENGINE SETUP OK');

    if (this.state !== DebuggerState.EngineSetupRequested) {
      throw new Error('Unexpected state:' + this.state);
    }
    this.setState(DebuggerState.EngineRunRequested);
  }

  get state() {
    return this._state;
  }
  setState(state: DebuggerState) {
    this._state = state;
  }
}
