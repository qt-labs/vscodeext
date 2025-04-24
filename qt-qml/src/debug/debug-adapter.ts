// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import {
  InitializedEvent,
  LoggingDebugSession,
  TerminatedEvent,
  Thread
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { Mutex } from 'async-mutex';
import path from 'path';
import { ChildProcess, execSync, spawn, SpawnOptions } from 'child_process';
import getPort from 'get-port';

import { createLogger, delay, IsLinux, IsWindows, telemetry } from 'qt-lib';
import {
  QmlDebugConnectionState,
  Server,
  ServerScheme
} from '@debug/debug-connection';
import { QmlEngine, StepAction } from '@debug/qml-engine';
import { projectManager } from '@/extension';

const logger = createLogger('debug-adapter');

export function registerQmlDebugAdapterFactory() {
  return vscode.debug.registerDebugAdapterDescriptorFactory(
    'qml',
    new QmlDebugAdapterFactory()
  );
}

enum DebugType {
  Attach,
  Launch
}

export enum BreakpointState {
  BreakpointNew,
  BreakpointInsertionRequested, //!< Inferior was told about bp, not ack'ed.
  BreakpointInsertionProceeding,
  BreakpointInserted,
  BreakpointUpdateRequested,
  BreakpointUpdateProceeding,
  BreakpointRemoveRequested,
  BreakpointRemoveProceeding,
  BreakpointDead
}

interface QmlDebugSessionAttachArguments
  extends DebugProtocol.AttachRequestArguments {
  host: string;
  port: number | string;
  buildDirs: string[] | undefined;
}

interface QmlDebugSessionLaunchArguments
  extends DebugProtocol.LaunchRequestArguments {
  program: string;
  debuggerArgs: string | undefined;
  args: string[] | undefined;
  buildDirs: string[] | undefined;
}

export interface QmlBreakpoint {
  id?: number;
  filename: string;
  line: number;
  state: BreakpointState;
  hitCount?: number | undefined;
  condition?: string | undefined;
  logMessage?: string | undefined;
}

export class QmlDebugSession extends LoggingDebugSession {
  private readonly _mutex = new Mutex();
  private _qmlEngine: QmlEngine | undefined;
  private _debugType: DebugType | undefined;
  private _process: ChildProcess | undefined;
  private readonly _breakpoints = new Map<string, QmlBreakpoint[]>();
  public constructor(session: vscode.DebugSession) {
    super();

    logger.info('Creating debug session for session:', session.id);
  }
  findBreakpoint(
    filename: string,
    sourceBreakpoint: DebugProtocol.SourceBreakpoint,
    predicate: (
      sourceBreakpoint: DebugProtocol.SourceBreakpoint,
      breakpoint: QmlBreakpoint
    ) => boolean
  ): QmlBreakpoint | undefined {
    const breakpoints = this._breakpoints.get(filename);
    if (!breakpoints) {
      return undefined;
    }
    for (const breakpoint of breakpoints) {
      if (predicate(sourceBreakpoint, breakpoint)) {
        return breakpoint;
      }
    }
    return undefined;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  protected override async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: DebugProtocol.DisconnectArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ): Promise<void> {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      if (this._debugType === undefined) {
        throw new Error('Debug type not initialized');
      }
      await this._qmlEngine.shutdownInferior();
      if (this._debugType === DebugType.Launch) {
        // If we are in launch mode, we need to kill the process.
        if (this._process?.pid) {
          logger.info('Killing process:', this._process.pid.toString());
          if (IsWindows) {
            // On Windows, we need to kill the process with taskkill
            // because ChildProcess.kill() does not work.
            execSync(`taskkill /pid ${this._process.pid} /T /F`, {
              stdio: 'ignore'
            });
          } else if (IsLinux) {
            process.kill(-this._process.pid);
          } else {
            this._process.kill();
          }
          this._process = undefined;
        }
      }
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ): Promise<void> {
    try {
      await this.waitUntilDebuggerIsReady();
      await this._mutex.waitForUnlock();
      const release = await this._mutex.acquire();
      logger.info('Func: setBreakPointsRequest: Begin');
      if (this._qmlEngine === undefined) {
        throw new Error('QML engine not initialized');
      }
      if (!args.source.path) {
        throw new Error('Source path is not defined');
      }
      const breakpointstoRemove: QmlBreakpoint[] = [];
      const breakpointsToAdd: QmlBreakpoint[] = [];
      const sourceBreakpoints = args.breakpoints ?? [];
      const isSameBreakpoint = (
        sourceBreakpoint: DebugProtocol.SourceBreakpoint,
        breakpoint: QmlBreakpoint
      ) => {
        let sourceBreakpointHitCount: number | undefined = undefined;
        if (sourceBreakpoint.hitCondition !== undefined) {
          sourceBreakpointHitCount = parseInt(
            sourceBreakpoint.hitCondition,
            10
          );
        }
        return (
          sourceBreakpoint.line === breakpoint.line &&
          sourceBreakpoint.condition === breakpoint.condition &&
          sourceBreakpoint.logMessage === breakpoint.logMessage &&
          sourceBreakpointHitCount === breakpoint.hitCount
        );
      };
      // check if current breakpoints are the same as the new ones
      for (const sourceBreakpoint of sourceBreakpoints) {
        const found = this.findBreakpoint(
          args.source.path,
          sourceBreakpoint,
          isSameBreakpoint
        );
        if (!found) {
          let hitCount: number | undefined = undefined;
          if (sourceBreakpoint.hitCondition) {
            hitCount = parseInt(sourceBreakpoint.hitCondition, 10);
          }
          const newBreakpoint: QmlBreakpoint = {
            filename: path.basename(args.source.path),
            line: sourceBreakpoint.line,
            state: BreakpointState.BreakpointNew,
            condition: sourceBreakpoint.condition,
            logMessage: sourceBreakpoint.logMessage,
            hitCount: hitCount
          };
          const currentSourceBreakpoints = this._breakpoints.get(
            args.source.path
          );
          if (currentSourceBreakpoints) {
            currentSourceBreakpoints.push(newBreakpoint);
          } else {
            this._breakpoints.set(args.source.path, [newBreakpoint]);
          }
          breakpointsToAdd.push(newBreakpoint);
        }
      }
      for (const breakpoint of this._breakpoints.get(args.source.path) ?? []) {
        const found = sourceBreakpoints.find((sourceBreakpoint) =>
          isSameBreakpoint(sourceBreakpoint, breakpoint)
        );
        if (!found) {
          breakpointstoRemove.push(breakpoint);
        }
      }

      for (const breakpoint of breakpointstoRemove) {
        const breakpoints = this._breakpoints.get(args.source.path);
        if (!breakpoints) {
          continue;
        }
        const index = breakpoints.indexOf(breakpoint);
        breakpoints.splice(index, 1);
        this._qmlEngine.clearBreakpoint(breakpoint);
      }

      for (const breakpoint of breakpointsToAdd) {
        breakpoint.state = BreakpointState.BreakpointInsertionRequested;
        const breakpontId =
          await this._qmlEngine.tryClaimBreakpoint(breakpoint);
        if (breakpontId) {
          breakpoint.id = breakpontId;
          breakpoint.state = BreakpointState.BreakpointInserted;
        }
      }

      response.body = {
        breakpoints: []
      };
      const currentBreakpoints = this._breakpoints.get(args.source.path);
      if (currentBreakpoints) {
        // We have to sort the breakpoints by line number. Otherwise, an
        // undefined behavior can occur.
        const sortedCurrentBreakpoints = currentBreakpoints.sort(
          (a, b) => a.line - b.line
        );
        for (const breakpoint of sortedCurrentBreakpoints) {
          if (
            breakpoint.state === BreakpointState.BreakpointInsertionRequested
          ) {
            continue;
          }
          if (breakpoint.id === undefined) {
            throw new Error('Breakpoint ID is undefined');
          }
          response.body.breakpoints.push({
            id: breakpoint.id,
            line: breakpoint.line,
            verified: true
          });
        }
      }
      logger.info('setBreakPointsRequest response:', JSON.stringify(response));
      this.sendResponse(response);
      release();
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  async waitUntilDebuggerIsReady() {
    if (!this._qmlEngine) {
      throw new Error('QML engine not initialized');
    }
    while (
      this._qmlEngine.connectionState !== QmlDebugConnectionState.Connected
    ) {
      await delay(1000);
    }
  }
  async waitUntilDebuggerStopped() {
    if (!this._qmlEngine) {
      throw new Error('QML engine not initialized');
    }
    while (this._qmlEngine.isRunning()) {
      await delay(500);
    }
  }
  protected override initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ) {
    logger.info('Initialize request:', JSON.stringify(args));
    response.body = {};
    response.body.supportsSetVariable = true;
    response.body.supportsConditionalBreakpoints = true;
    response.body.supportsHitConditionalBreakpoints = false;
    this.sendResponse(response);
  }
  protected override threadsRequest(
    response: DebugProtocol.ThreadsResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    logger.info('threadsRequest');
    if (!this._qmlEngine) {
      throw new Error('QML engine not initialized');
    }
    response.body = {
      threads: [new Thread(this._qmlEngine.mainQmlThreadId, 'Main Thread')]
    };
    this.sendResponse(response);
  }
  protected override async scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      logger.info('Scopes request:', JSON.stringify(args));
      await this.waitUntilDebuggerStopped();
      const scopes = await this._qmlEngine.frame(args.frameId);
      if (scopes === undefined) {
        throw new Error('Scopes are undefined');
      }
      response.body = {
        scopes: scopes
      };
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      logger.info('Evaluate request:', JSON.stringify(args));
      const result = await this._qmlEngine.evaluate(
        args.expression,
        args.frameId
      );
      if (result === undefined) {
        const message = 'Cannot evaluate expression "' + args.expression + '"';
        response.success = false;
        response.message = message;
        logger.warn(message);
        return;
      }
      const value = QmlEngine.convertQmlTypeToValue(result.body);
      if (value === undefined) {
        throw new Error('Value is undefined');
      }

      response.body = {
        result: value,
        type: result.body.type,
        variablesReference: 0,
        presentationHint: {
          kind: 'property'
        }
      };
      if (result.body.type === 'object') {
        response.body.namedVariables = (result.body.value as number) + 1;
      } else if (result.body.type === 'function') {
        response.body.presentationHint = response.body.presentationHint ?? {};
        response.body.presentationHint.kind = 'method';
      }
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async setVariableRequest(
    response: DebugProtocol.SetVariableResponse,
    args: DebugProtocol.SetVariableArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      logger.info('Set variable request:', JSON.stringify(args));
      const result = await this._qmlEngine.setVariable(args);
      if (result === undefined) {
        response.success = false;
        response.message = 'Cannot set variable';
        this.sendResponse(response);
        return;
      }
      response.body = {
        value: args.value
      };
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      logger.info('Variables request:', JSON.stringify(args));
      const firstTime = this._qmlEngine.thisReference === -1;
      const expandingThis =
        !firstTime && args.variablesReference === this._qmlEngine.thisReference;
      const includeThis = (engine: QmlEngine) => {
        const refs = engine.refs;
        if (firstTime) {
          return true;
        }
        if (refs.has(args.variablesReference - 1)) {
          return false;
        }
        return args.variablesReference !== engine.thisReference;
      };

      let variablesReference = args.variablesReference;
      if (!expandingThis) {
        variablesReference = variablesReference - 1;
      }
      const variables: DebugProtocol.Variable[] = [];
      // Always add "this" as the first variable
      if (includeThis(this._qmlEngine)) {
        const thisVariable = await this._qmlEngine.getThisVariable();
        if (thisVariable) {
          this._qmlEngine.thisReference = thisVariable.variablesReference;
          variables.push(thisVariable);
        }
      }
      const lookUpvariables = await this._qmlEngine.lookup(variablesReference);
      // Sort the variables by name
      if (lookUpvariables) {
        lookUpvariables.sort((a, b) => a.name.localeCompare(b.name));
        variables.push(...lookUpvariables);
      }

      if (variables.length === 0) {
        throw new Error('Variables are undefined');
      }

      response.body = {
        variables: variables
      };
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      await this.waitUntilDebuggerStopped();
      logger.info('Stack trace request:', JSON.stringify(args));
      const { stackFrames, length } = await this._qmlEngine.backtrace(args);
      response.body = {
        stackFrames: stackFrames
      };
      response.body.totalFrames = length;
      response.success = true;
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async continueRequest(
    response: DebugProtocol.ContinueResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: DebugProtocol.ContinueArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      const result = await this._qmlEngine.continueDebugging(
        StepAction.Continue
      );
      if (!result.success) {
        response.success = false;
      }
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async stepInRequest(
    response: DebugProtocol.StepInResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: DebugProtocol.StepInArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      const result = await this._qmlEngine.continueDebugging(StepAction.StepIn);
      if (!result.success) {
        response.success = false;
      }
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: DebugProtocol.StepOutArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }
      const result = await this._qmlEngine.continueDebugging(
        StepAction.StepOut
      );
      if (!result.success) {
        response.success = false;
      }
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  protected override async nextRequest(
    response: DebugProtocol.NextResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _args: DebugProtocol.NextArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      if (!this._qmlEngine) {
        throw new Error('QML engine not initialized');
      }

      const result = await this._qmlEngine.continueDebugging(StepAction.Next);
      if (!result.success) {
        response.success = false;
      }
      this.sendResponse(response);
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  private sendError(
    response: DebugProtocol.Response,
    number: number,
    err: string
  ) {
    logger.error('Error:', err);
    this.sendErrorResponse(response, {
      id: number,
      format: 'QML Debug: ' + err,
      showUser: true
    });
    this.sendEvent(new TerminatedEvent());
  }
  protected override async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: QmlDebugSessionLaunchArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      telemetry.sendAction('QMLDebugLaunch');
      logger.info(
        `Launch request: ${args.program}, ${args.debuggerArgs ?? ''}, ${args.args?.join(',') ?? ''}`
      );
      this._debugType = DebugType.Launch;
      let debuggerArgs = args.debuggerArgs;
      let port: number | undefined;
      let host: string | undefined;
      if (args.debuggerArgs === undefined) {
        host = 'localhost';
        port = await getPort();
        debuggerArgs = `-qmljsdebugger=host:${host},port:${port.toString()},block,services:DebugMessages,QmlDebugger,V8Debugger`;
      } else {
        const getParam = (regex: RegExp, userArgs: string) => {
          const match = userArgs.match(regex);
          if (match?.[1] === undefined) {
            throw new Error('Port not found in args');
          }
          return match[1];
        };
        const hostRegex = /host:([^,]+)/;
        const portRegex = /port:(\d+)/;
        const portStr = getParam(portRegex, args.debuggerArgs);
        host = getParam(hostRegex, args.debuggerArgs);

        const hostMatch = args.debuggerArgs.match(hostRegex);
        if (hostMatch?.[1] === undefined) {
          throw new Error('Host not found in debuggerArgs');
        }

        port = parseInt(portStr, 10);
        if (isNaN(port)) {
          throw new Error('Invalid port number');
        }
      }

      const server: Server = {
        host: host,
        port: port,
        scheme: ServerScheme.Tcp
      };
      // Start the program with the debugger args
      const program = args.program;
      const additionalArgs = args.args ?? [];
      const quoteArg = (arg: string): string => {
        // Escape double quotes and wrap the argument in quotes
        const escaped = arg.replace(/(["\\])/g, '\\$1');
        return `"${escaped}"`;
      };

      let command = `${program} ${debuggerArgs}`;
      if (additionalArgs.length > 0) {
        command += ` ${additionalArgs.map(quoteArg).join(' ')}`;
      }
      logger.info('Starting program:', command);
      let options: SpawnOptions = {
        shell: true
      };
      if (IsLinux) {
        options = {
          ...options,
          detached: true
        };
      }
      if (IsWindows) {
        const dllDirs = await vscode.commands.executeCommand(`qt-cpp.qtDir`);
        if (dllDirs !== undefined) {
          const env = { ...process.env };
          env.PATH = `${dllDirs as string};${env.PATH}`;
          options = {
            ...options,
            env: env
          };
        }
      }
      this._process = spawn(command, options);
      if (!this._process.stdout || !this._process.stderr) {
        throw new Error('Process stdout or stderr is undefined');
      }

      this._process.stdout.on('data', (data: Buffer) => {
        vscode.debug.activeDebugConsole.append(data.toString());
      });
      this._process.stderr.on('data', (data: Buffer) => {
        vscode.debug.activeDebugConsole.append(data.toString());
      });
      this._process.on('error', (err: Error) => {
        logger.error('Process error:', err.message);
        this.sendError(response, 1, err.message);
      });

      this.initAndStartEngine(server, args.buildDirs);

      this.sendResponse(response);
      this.sendEvent(new InitializedEvent());
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
  private initializeEngine(server: Server, buildDirs?: string[]) {
    this._qmlEngine = new QmlEngine(this);
    this._qmlEngine.server = server;
    this._qmlEngine.buildDirs = buildDirs ?? [];
    this._qmlEngine.onShutdownEngine = () => {
      this.sendEvent(new TerminatedEvent());
    };

    // If there is multi-workspace usage, we skip this step because we don't
    // know which build dir to use.
    // TODO: We can get the selected workspace from the CMake extension.
    const projectBuildDirs = projectManager.getBuildDirs();
    if (projectBuildDirs.length === 1 && projectBuildDirs[0] !== undefined) {
      this._qmlEngine.buildDirs.push(projectBuildDirs[0]);
    }
  }
  private initAndStartEngine(server: Server, buildDirs?: string[]) {
    this.initializeEngine(server, buildDirs);
    if (this._qmlEngine === undefined) {
      throw new Error('QML engine not initialized');
    }
    this._qmlEngine.start();
  }

  protected override attachRequest(
    response: DebugProtocol.AttachResponse,
    args: QmlDebugSessionAttachArguments,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request?: DebugProtocol.Request
  ) {
    try {
      telemetry.sendAction('QMLDebugAttach');
      logger.info('Attach request:', args.host, args.port.toString());
      this._debugType = DebugType.Attach;
      let port: number | undefined;
      if (typeof args.port === 'string') {
        port = parseInt(args.port, 10);
      }
      if (port === undefined || isNaN(port)) {
        throw new Error(`Invalid port number: ${args.port}`);
      }
      const server: Server = {
        host: args.host,
        port: port,
        scheme: ServerScheme.Tcp
      };
      this.initAndStartEngine(server, args.buildDirs);

      this.sendResponse(response);
      this.sendEvent(new InitializedEvent());
    } catch (err) {
      this.sendError(response, 1, err as string);
    }
  }
}

export class QmlDebugAdapterFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public createDebugAdapterDescriptor(
    session: vscode.DebugSession,
    executable: vscode.DebugAdapterExecutable | undefined
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    logger.info('Creating debug adapter for session:', session.id);
    logger.info('Executable:', executable?.command ?? 'undefined');

    return new vscode.DebugAdapterInlineImplementation(
      new QmlDebugSession(session)
    );
  }
}
