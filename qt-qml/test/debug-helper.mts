// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Open a QML file from a project dir and create breakpoints on the FIRST
 * executable-looking line AFTER every `// BREAK_HERE` marker.
 *
 * Returns the opened document and the prepared SourceBreakpoints (not yet added).
 */
export async function prepareQmlBreakpointsFromMarkers(
  projectDir: string,
  relQmlPath: string,
  marker = 'BREAK_HERE'
): Promise<{
  doc: vscode.TextDocument;
  breakpoints: vscode.SourceBreakpoint[];
}> {
  const qmlPath = path.join(projectDir, relQmlPath);
  const doc = await vscode.workspace.openTextDocument(qmlPath);
  await vscode.window.showTextDocument(doc);

  const lines = doc.getText().split('\n');
  const markerIdxs = lines
    .map((ln, i) => (ln.includes(marker) ? i : -1))
    .filter((i) => i >= 0);

  if (markerIdxs.length === 0) {
    throw new Error(`No // ${marker} markers found in ${relQmlPath}`);
  }

  const isSkippable = (s: string) => {
    const t = s.trim();
    return t.length === 0 || t.startsWith('//');
  };

  const locations: vscode.Location[] = [];
  for (const idx of markerIdxs) {
    let target = Math.min(idx + 1, lines.length - 1);
    while (target < lines.length && isSkippable(lines[target]!)) {
      target++;
    }
    if (target >= lines.length) target = lines.length - 1;
    locations.push(
      new vscode.Location(doc.uri, new vscode.Position(target, 0))
    );
  }

  const breakpoints = locations.map(
    (loc) => new vscode.SourceBreakpoint(loc, true)
  );
  return { doc, breakpoints };
}

/** Add breakpoints; returns a disposer to remove them later. */
export function addBreakpoints(bps: vscode.SourceBreakpoint[]) {
  vscode.debug.addBreakpoints(bps);
  return () => vscode.debug.removeBreakpoints(bps);
}

/**
 * Build a QML debug configuration for Qt Quick application
 */
export async function makeQmlDebugConfig(): Promise<vscode.DebugConfiguration> {
  // Resolve what ${command:...} would have produced
  const program = await vscode.commands.executeCommand<string>(
    'cmake.launchTargetPath'
  );
  const cwd = await vscode.commands.executeCommand<string>(
    'cmake.getLaunchTargetDirectory'
  );

  if (!program || !cwd) {
    throw new Error(
      `Failed to resolve debug launch paths from CMake Tools.
     program=${program ?? '<undefined>'}, cwd=${cwd ?? '<undefined>'}`
    );
  }

  const cfg: vscode.DebugConfiguration = {
    name: 'qml-debug-test-launch',
    type: 'qml',
    request: 'launch',
    program: program,
    cwd: cwd,
    stopAtEntry: false
  };

  if (process.env.QT_TEST_DEBUG === '1') {
    console.log('[qml-debug] Debug config:', cfg);
  }

  return cfg;
}

/**
 * Start debugging and wait for first 'stopped' event
 */
export async function startDebugAndWaitForStop(
  wsFolder: vscode.WorkspaceFolder,
  cfg: vscode.DebugConfiguration,
  opts?: { timeoutMs?: number }
): Promise<{
  session: vscode.DebugSession;
  stops: Array<{
    source?: string;
    line?: number;
    threadId?: number;
    frameId?: number;
  }>;
}> {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  let session!: vscode.DebugSession;
  const stops: Array<{
    source?: string;
    line?: number;
    threadId?: number;
    frameId?: number;
  }> = [];

  const done = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for 'stopped'`)),
      timeoutMs
    );

    const trackerDisp = vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker: (s) => {
        session = s;
        return {
          onDidSendMessage: async (m: any) => {
            if (m?.event === 'stopped') {
              const reason: string | undefined = m?.body?.reason;
              let tid: number | undefined = m?.body?.threadId;

              try {
                if (tid == null) {
                  const threads = await s.customRequest('threads');
                  tid = threads?.threads?.[0]?.id;
                  if (tid == null) throw new Error('No debug thread found');
                }

                // For QML debugging, we want to capture breakpoint stops
                if (reason === 'breakpoint' || reason === 'step') {
                  const st = await s.customRequest('stackTrace', {
                    threadId: tid
                  });
                  const f = st?.stackFrames?.[0];
                  stops.push({
                    source: f?.source?.path,
                    line: f?.line,
                    threadId: tid,
                    frameId: f?.id
                  });

                  clearTimeout(timer);
                  trackerDisp.dispose();
                  resolve();
                }
              } catch (err) {
                clearTimeout(timer);
                trackerDisp.dispose();
                reject(err);
              }
            }
          }
        };
      }
    });

    vscode.debug.startDebugging(wsFolder, cfg).then(
      (started) => {
        if (!started) {
          clearTimeout(timer);
          trackerDisp.dispose();
          reject(new Error('Failed to start debugging'));
        }
      },
      (err) => {
        clearTimeout(timer);
        trackerDisp.dispose();
        reject(err);
      }
    );
  });

  await done;
  return { session, stops };
}

/**
 * Stop the debug session
 */
export async function stopDebugSession(
  session: vscode.DebugSession
): Promise<void> {
  if (session && vscode.debug.activeDebugSession === session) {
    await vscode.commands.executeCommand('workbench.action.debug.stop');
  }
}

/**
 * Get the top frame ID from the debug session
 */
export async function getTopFrameId(
  session: vscode.DebugSession
): Promise<number> {
  const { threads } = await session.customRequest('threads');
  const threadId = threads?.[0]?.id;
  if (threadId == null) throw new Error('No debug thread found');
  const { stackFrames } = await session.customRequest('stackTrace', {
    threadId
  });
  const frame = stackFrames?.[0];
  if (!frame) throw new Error('No stack frame');
  return frame.id as number;
}

/**
 * Get local variables from a debug frame
 * For QML debugging, thread ID is always 1
 */
export async function getLocals(session: vscode.DebugSession) {
  // QML debugger always uses thread ID 1
  const threadId = 1;

  if (process.env.QT_TEST_DEBUG === '1') {
    console.log('[qml-debug] Using threadId:', threadId);
  }

  // Get fresh stack trace
  const st = await session.customRequest('stackTrace', { threadId });

  if (process.env.QT_TEST_DEBUG === '1') {
    console.log(
      '[qml-debug] StackTrace response:',
      JSON.stringify(st, null, 2)
    );
  }

  const frame = st?.stackFrames?.[0];
  if (!frame) {
    throw new Error('No stack frame found');
  }

  const frameId = frame.id;

  if (process.env.QT_TEST_DEBUG === '1') {
    console.log('[qml-debug] Requesting scopes for frameId:', frameId);
    console.log('[qml-debug] Full frame info:', JSON.stringify(frame, null, 2));
  }

  const scopesResponse = await session.customRequest('scopes', { frameId });
  const scopes = scopesResponse?.scopes;

  // Debug: log all available scopes with full details
  if (process.env.QT_TEST_DEBUG === '1') {
    console.log(
      '[qml-debug] Scopes response:',
      JSON.stringify(scopesResponse, null, 2)
    );
    console.log(
      '[qml-debug] Available scopes:',
      scopes
        ?.map((s: any) => `${s.name} (ref=${s.variablesReference})`)
        .join(', ') || '(none)'
    );
  }

  // Try to find a locals scope - QML debugger might use different names
  const localsScope =
    scopes?.find((sc: any) => /locals?/i.test(sc.name)) ??
    scopes?.find((sc: any) => /context/i.test(sc.name)) ??
    scopes?.[0];

  if (!localsScope) {
    console.error('[qml-debug] No scope found. Available scopes:', scopes);
    throw new Error('No Locals scope found');
  }

  if (process.env.QT_TEST_DEBUG === '1') {
    console.log(
      '[qml-debug] Using scope:',
      localsScope.name,
      'variablesReference:',
      localsScope.variablesReference
    );
  }

  const { variables } = await session.customRequest('variables', {
    variablesReference: localsScope.variablesReference
  });

  if (process.env.QT_TEST_DEBUG === '1') {
    console.log(
      '[qml-debug] Variables response:',
      JSON.stringify(variables, null, 2)
    );
  }

  return variables ?? [];
}

/**
 * Evaluate an expression in the current debug context
 * This uses the DAP 'evaluate' request which may work even when scopes don't
 */
export async function evaluateExpression(
  session: vscode.DebugSession,
  expression: string,
  frameId?: number
): Promise<{ result: string; type?: string; variablesReference?: number }> {
  if (process.env.QT_TEST_DEBUG === '1') {
    console.log(`[qml-debug] Evaluating expression: "${expression}"`);
  }

  try {
    const response = await session.customRequest('evaluate', {
      expression,
      frameId,
      context: 'watch' // Use 'watch' context for variable evaluation
    });

    if (process.env.QT_TEST_DEBUG === '1') {
      console.log(
        '[qml-debug] Evaluate response:',
        JSON.stringify(response, null, 2)
      );
    }

    return {
      result: response.result,
      type: response.type,
      variablesReference: response.variablesReference
    };
  } catch (err) {
    if (process.env.QT_TEST_DEBUG === '1') {
      console.log('[qml-debug] Evaluate failed:', err);
    }
    throw err;
  }
}
