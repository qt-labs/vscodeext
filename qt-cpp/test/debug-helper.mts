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
export async function makeCppDebugConfig(): Promise<vscode.DebugConfiguration> {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';
  const miMode = process.env.MIMODE || (isMac ? 'lldb' : 'gdb');

  // Resolve what ${command:...} would have produced
  const program = await vscode.commands.executeCommand<string>(
    'cmake.launchTargetPath'
  );
  const cwd = await vscode.commands.executeCommand<string>(
    'cmake.getLaunchTargetDirectory'
  );
  const visualizerFile =
    await vscode.commands.executeCommand<string>('qt-cpp.natvis');

  if (!program || !cwd) {
    throw new Error(
      `Failed to resolve debug launch paths from CMake Tools.
     program=${program ?? '<undefined>'}, cwd=${cwd ?? '<undefined>'}`
    );
  }
  if (!visualizerFile) {
    throw new Error('qt-cpp.natvis did not resolve to a NatVis file path.');
  }
  const cfg: vscode.DebugConfiguration = {
    name: 'natvis-test-launch',
    type: isWin ? 'cppvsdbg' : 'cppdbg',
    request: 'launch',
    ...(isWin ? {} : { MIMode: miMode }),
    // Always the correct binary/dir for the *selected kit* and *build type*
    program: program, //'${command:cmake.launchTargetPath}', // built binary
    cwd: cwd, //'${command:cmake.getLaunchTargetDirectory}', // correct working dir
    // Let the Qt extension provide the NatVis (need a Qt kit to be selected)
    visualizerFile: visualizerFile, //'${command:qt-cpp.natvis}', // Qt NatVis provider
    stopAtEntry: true,
    console: 'internalConsole',
    externalConsole: false,
    showDisplayString: true
  };

  // Non-Windows: set MI mode, and on Linux also force the debugger path.
  if (!isWin) {
    (cfg as any).MIMode = miMode;

    // On Ubuntu CI, cpptools can't infer the MI debugger, so we point it at gdb explicitly.
    if (isLinux && !(cfg as any).miDebuggerPath) {
      (cfg as any).miDebuggerPath = 'gdb';
    }
  }

  // 🔍 Log what we *intend* to launch (only when QT_TEST_DEBUG=1)
  if (process.env.QT_TEST_DEBUG === '1') {
    console.log(
      '[natvis.test] Debug config type:',
      cfg.type,
      'MIMode:',
      (cfg as any).MIMode ?? '<none>',
      'MIDebuggerPath:',
      (cfg as any).miDebuggerPath ?? '<none>'
    );
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
              if (
                reason !== 'breakpoint' &&
                (opts?.continueUntilHits ?? 0) >= 0
              ) {
                await s.customRequest('continue', { threadId: tid });
                return;
              }

              const st = await s.customRequest('stackTrace', { threadId: tid });
              const f = st?.stackFrames?.[0];
              stops.push({
                source: f?.source?.path,
                line: f?.line,
                threadId: tid,
                frameId: f?.id
              });

              // continue to hit N stops if requested
              if (
                opts?.continueUntilHits &&
                stops.length < opts.continueUntilHits
              ) {
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
            reject(
              new Error('Debug session terminated before hitting a breakpoint')
            );
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

export async function getLocals(session: vscode.DebugSession, frameId: number) {
  const { scopes } = await session.customRequest('scopes', { frameId });
  const localsScope =
    scopes?.find((sc: any) => /locals?/i.test(sc.name)) ?? scopes?.[0];
  if (!localsScope) throw new Error('No Locals scope found');
  const { variables } = await session.customRequest('variables', {
    variablesReference: localsScope.variablesReference
  });
  return variables ?? [];
}

interface DebugConfigurationSnippet {
  label?: string;
  description?: string;
  body?: vscode.DebugConfiguration;
}

interface QtCppDebuggerContribution {
  type?: string;
  configurationSnippets?: DebugConfigurationSnippet[];
}

interface QtCppPackageJson {
  contributes?: {
    debuggers?: QtCppDebuggerContribution[];
  };
}

function unescapeSnippetString(input: string): string {
  let s = input;

  if (s.startsWith('^"') && s.endsWith('"') && s.length >= 3) {
    s = s.slice(2, -1);
  }

  s = s.replace(/\^"/g, '"');
  return s;
}

function normalizeSnippetDebugConfiguration(
  body: vscode.DebugConfiguration
): vscode.DebugConfiguration {
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return unescapeSnippetString(value);
    }
    if (Array.isArray(value)) {
      return value.map((v) => visit(v));
    }
    if (value && typeof value === 'object') {
      const src = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(src)) {
        out[k] = visit(v);
      }
      return out;
    }
    return value;
  };

  const cloned = visit(body) as vscode.DebugConfiguration;
  return cloned;
}

/**
 * Pick the debug configuration snippet to test:
 *
 *   - Windows → the cppvsdbg snippet (body.type === 'cppvsdbg')
 *   - Others (Linux/macOS) → the "Qt: Debug with cppdbg" snippet
 *     (body.type === 'cppdbg', prefer label not containing "lldb")
 */
export function getQtCppSnippetDebugConfiguration(): vscode.DebugConfiguration {
  const ext = vscode.extensions.getExtension('theqtcompany.qt-cpp');
  if (!ext) {
    throw new Error(
      "[qt-cpp] Extension 'theqtcompany.qt-cpp' not found when looking up debug snippets"
    );
  }

  const pkg = ext.packageJSON as QtCppPackageJson;
  const debuggers = pkg.contributes?.debuggers ?? [];

  const allSnippets: DebugConfigurationSnippet[] = [];
  for (const dbg of debuggers) {
    if (Array.isArray(dbg.configurationSnippets)) {
      allSnippets.push(...dbg.configurationSnippets);
    }
  }

  if (allSnippets.length === 0) {
    throw new Error(
      '[qt-cpp] No configurationSnippets found in contributes.debuggers'
    );
  }

  const isWin = process.platform === 'win32';

  let snippet: DebugConfigurationSnippet | undefined;

  if (isWin) {
    // Windows: use the Visual Studio debugger snippet
    snippet = allSnippets.find((s) => s.body?.type === 'cppvsdbg');
  } else {
    // Non-Windows: use the cppdbg snippet (but *not* the lldb variant)
    snippet =
      allSnippets.find(
        (s) =>
          s.body?.type === 'cppdbg' &&
          !(s.label ?? '').toLowerCase().includes('lldb')
      ) || allSnippets.find((s) => s.body?.type === 'cppdbg');
  }

  if (!snippet || !snippet.body) {
    const details = allSnippets.map((s) => s.label ?? '<no-label>').join(', ');
    throw new Error(
      `[qt-cpp] Could not find a suitable configuration snippet for platform. ` +
        `Available snippet labels: [${details}]`
    );
  }

  const normalized = normalizeSnippetDebugConfiguration(snippet.body);

  if (!normalized.name) {
    normalized.name =
      snippet.label ??
      (isWin ? 'Qt snippet (cppvsdbg)' : 'Qt snippet (cppdbg)');
  }

  return normalized;
}

export interface DebugVariable {
  name: string;
  type?: string;
  value?: string;
}

/**
 * Returns a flat list of Locals, including children, using dotted names:
 *   core           -> "core"
 *   core.qRect     -> "core.qRect"
 *   core.qByteArray -> "core.qByteArray"
 *
 * It builds on top of getLocals(session, frameId) and uses the DAP
 * "variables" request to walk into children, up to maxDepth.
 */
export async function getFlattenedLocals(
  session: vscode.DebugSession | undefined,
  frameId: number,
  maxDepth = 3
): Promise<DebugVariable[]> {
  if (!session) {
    throw new Error('[natvis.test] No active debug session');
  }

  // Reuse existing helper that returns top-level Locals
  const roots = await getLocals(session, frameId);

  const acc: DebugVariable[] = [];

  async function walkVar(v: any, prefix: string, depth: number): Promise<void> {
    const fullName = prefix ? `${prefix}.${v.name}` : v.name;

    acc.push({
      name: fullName,
      type: v.type,
      value: typeof v.value === 'string' ? v.value : String(v.value ?? '')
    });

    if (
      !v.variablesReference ||
      v.variablesReference <= 0 ||
      depth >= maxDepth
    ) {
      return;
    }

    const varsResponse = (await session!.customRequest('variables', {
      variablesReference: v.variablesReference
    })) as { variables: any[] };

    for (const child of varsResponse.variables) {
      await walkVar(child, fullName, depth + 1);
    }
  }

  for (const root of roots) {
    await walkVar(root, '', 0);
  }

  return acc;
}
