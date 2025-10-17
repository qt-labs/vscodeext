// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Open a source file from a project dir and create breakpoints on the FIRST
 * executable-looking line AFTER every `// BREAK_HERE` marker.
 *
 * Returns the opened document and the prepared SourceBreakpoints (not yet added).
 */
export async function prepareBreakpointsFromMarkers(
  projectDir: string,
  relSourcePath: string,
  marker = 'BREAK_HERE'
): Promise<{
  doc: vscode.TextDocument;
  breakpoints: vscode.SourceBreakpoint[];
}> {
  const sourcePath = path.join(projectDir, relSourcePath);
  const doc = await vscode.workspace.openTextDocument(sourcePath);
  await vscode.window.showTextDocument(doc);

  const lines = doc.getText().split('\n');
  const markerIdxs = lines
    .map((ln, i) => (ln.includes(marker) ? i : -1))
    .filter((i) => i >= 0);

  if (markerIdxs.length === 0) {
    throw new Error(`No // ${marker} markers found in ${relSourcePath}`);
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

// --- Build a cross-platform C++ debug configuration -------------------------
export function makeCppDebugConfig(opts: {
  program: string; // absolute path to the built binary
  cwd: string; // working dir (e.g., build dir)
  visualizerFile?: string; // optional: qt natvis path
}): vscode.DebugConfiguration {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const miMode = process.env.MIMODE || (isMac ? 'lldb' : 'gdb');

  const cfg: vscode.DebugConfiguration = {
    name: 'natvis-test-launch',
    type: isWin ? 'cppvsdbg' : 'cppdbg',
    request: 'launch',
    ...(isWin ? {} : { MIMode: miMode }),
    program: opts.program,
    cwd: opts.cwd,
    stopAtEntry: false,
    console: 'integratedTerminal',
    showDisplayString: true
  };

  if (opts.visualizerFile) {
    // cppdbg supports "visualizerFile"; cppvsdbg reads natvis from VS, but keeping this is harmless.
    (cfg as any).visualizerFile = path.normalize(opts.visualizerFile);
  }
  return cfg;
}

// --- Start debugging and resolve on first 'stopped' --------------------------
// debug-helper.mts
export async function startDebugAndWaitForStop(
  wsFolder: vscode.WorkspaceFolder,
  cfg: vscode.DebugConfiguration,
  opts?: { timeoutMs?: number; continueUntilHits?: number }
): Promise<{
  session: vscode.DebugSession;
  stops: Array<{ source?: string; line?: number; threadId?: number; frameId?: number }>;
}> {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  let session!: vscode.DebugSession;
  const stops: Array<{ source?: string; line?: number; threadId?: number; frameId?: number }> = [];

  const done = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for 'stopped'`)), timeoutMs);

    const trackerDisp = vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker: (s) => ({
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

              // skip non-breakpoint stops (entry, signal, etc.)
              if (reason !== 'breakpoint' && (opts?.continueUntilHits ?? 0) >= 0) {
                await s.customRequest('continue', { threadId: tid });
                return;
              }

              const st = await s.customRequest('stackTrace', { threadId: tid });
              const f = st?.stackFrames?.[0];
              stops.push({ source: f?.source?.path, line: f?.line, threadId: tid, frameId: f?.id });

              // continue to hit N stops if requested
              if (opts?.continueUntilHits && stops.length < opts.continueUntilHits) {
                await s.customRequest('continue', { threadId: tid });
                return;
              }

              clearTimeout(timer);
              trackerDisp.dispose();
              resolve();
            } catch (e) {
              clearTimeout(timer);
              trackerDisp.dispose();
              reject(e);
            }
          }

          if (m?.event === 'terminated' && stops.length === 0) {
            clearTimeout(timer);
            trackerDisp.dispose();
            reject(new Error('Debug session terminated before hitting a breakpoint'));
          }
        }
      })
    });
  });

  const started = await vscode.debug.startDebugging(wsFolder, cfg);
  if (!started) throw new Error('Failed to start debug session');

  session = vscode.debug.activeDebugSession!;
  await done;
  return { session, stops };
}
// --- Graceful termination ----------------------------------------------------
export async function stopDebugSession(session?: vscode.DebugSession) {
  if (!session) return;
  try {
    await session.customRequest('disconnect', { terminateDebuggee: true });
  } catch {
    // some adapters might not support disconnect; ignore
  }
}

export async function getTopFrameId(session: vscode.DebugSession): Promise<number> {
  const { threads } = await session.customRequest('threads');
  const threadId = threads?.[0]?.id;
  if (threadId == null) throw new Error('No debug thread found');
  const { stackFrames } = await session.customRequest('stackTrace', { threadId });
  const frame = stackFrames?.[0];
  if (!frame) throw new Error('No stack frame');
  return frame.id as number;
}

export async function getLocals(session: vscode.DebugSession, frameId: number) {
  const { scopes } = await session.customRequest('scopes', { frameId });
  const localsScope =
    scopes?.find((sc: any) => /locals?/i.test(sc.name)) ?? scopes?.[0];
  if (!localsScope) throw new Error('No Locals scope found');
  const { variables } = await session.customRequest('variables', {
    variablesReference: localsScope.variablesReference,
  });
  return variables ?? [];
}