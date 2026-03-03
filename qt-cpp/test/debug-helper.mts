// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Debug-session utilities for qt-cpp NatVis integration tests.
 *
 * This module provides small helpers used by natvis.test.mts to:
 *   - Create and manage breakpoints from inline source markers.
 *   - Build fully-resolved C++ debug configurations (no ${command:...} left unresolved).
 *   - Launch a debug session and wait for breakpoint stops via a DAP tracker.
 *   - Retrieve and flatten Locals into a minimal, stable shape for snapshot testing.
 *   - Read and normalize qt-cpp’s contributed debug configuration snippets.
 *
 * All helpers are test-oriented and may rely on console logging and strict errors.
 */

/**
 * Prepare debugger breakpoints by scanning a source file for marker comments.
 *
 * This helper looks for lines containing a marker string (by default `BREAK_HERE`)
 * in the given source file and creates one enabled `SourceBreakpoint` per marker.
 *
 * For each marker:
 *   - The breakpoint is placed on the **next executable line** after the marker.
 *   - Empty lines and comment-only lines are skipped to avoid invalid locations.
 *
 * This pattern allows test fixtures to remain readable and self-documenting:
 * breakpoints are declared inline in the source code without hard-coding
 * line numbers in tests.
 *
 * Behavior:
 *   - Opens the source file in the editor to ensure breakpoints are registered.
 *   - Throws an error if no marker occurrences are found.
 *
 * @param projectDir    Absolute path to the project root.
 * @param relSourcePath Path to the source file relative to `projectDir`.
 * @param marker        Marker string used to locate breakpoint positions.
 *
 * @returns An object containing:
 *   - `doc`         : The opened TextDocument for the source file.
 *   - `breakpoints` : Enabled SourceBreakpoints derived from marker locations.
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

/**
 * Create a fully-resolved C++ debug configuration for NatVis tests.
 *
 * This helper constructs a concrete `DebugConfiguration` equivalent to what
 * VS Code would produce from a `launch.json` using CMake Tools and the qt-cpp
 * extension — but **without** relying on `${command:...}` indirections.
 *
 * The function:
 *   - Resolves all command-based fields eagerly:
 *       • `cmake.launchTargetPath`
 *       • `cmake.getLaunchTargetDirectory`
 *       • `qt-cpp.natvis`
 *   - Selects the appropriate debugger type per platform:
 *       • Windows → `cppvsdbg`
 *       • macOS/Linux → `cppdbg`
 *   - Chooses a suitable MI mode (`lldb` or `gdb`) for non-Windows platforms.
 *   - Applies Linux-specific fixes required on CI (explicit `gdb` path).
 *
 * The resulting configuration is:
 *   - Platform-correct,
 *   - Fully concrete (no unresolved `${command:...}`),
 *   - Suitable for programmatic launching via `startDebugging`,
 *   - Behaviorally equivalent to a user-driven launch.
 *
 * Debug logging of the final configuration is enabled when `QT_TEST_DEBUG=1`.
 *
 * @returns A resolved `DebugConfiguration` ready to be passed to
 *          `vscode.debug.startDebugging`.
 *
 * @throws Error if required launch paths or the NatVis file cannot be resolved.
 */
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

/**
 * Start a debug session and wait until one or more `stopped` events occur.
 *
 * This helper launches a debug session programmatically and synchronously
 * waits for the debugger to stop at a breakpoint, mirroring the behavior
 * of a user-driven debug launch.
 *
 * Core behavior:
 *   - Registers a `DebugAdapterTracker` **before** launching the session
 *     to reliably observe all DAP events.
 *   - Starts debugging with the provided workspace folder and fully
 *     materialized debug configuration.
 *   - Listens for `stopped` events and records the first stack frame
 *     (source, line, threadId, frameId) for each relevant stop.
 *
 * Stop handling logic:
 *   - Automatically continues past non-breakpoint stops (entry, signal, etc.).
 *   - Optionally continues execution until a specified number of breakpoint
 *     hits has been observed (`continueUntilHits`).
 *   - Resolves once the desired stop condition is met.
 *
 * Failure modes:
 *   - Rejects if the debug session terminates before any breakpoint is hit.
 *   - Rejects if no `stopped` event is received within the timeout.
 *   - Propagates unexpected debugger protocol or request errors.
 *
 * Design notes:
 *   - The debug session is captured immediately when the tracker is created,
 *     ensuring it is available even if events arrive very early.
 *   - The helper does not assume a fixed threadId; it queries threads when
 *     necessary to remain debugger-agnostic.
 *   - The tracker is disposed deterministically on success or failure.
 *
 * @param wsFolder Workspace folder in which to start debugging.
 * @param cfg      Fully resolved debug configuration (no `${command:...}`).
 * @param opts     Optional controls:
 *                   - `timeoutMs`         : maximum wait time (default: 15000ms).
 *                   - `continueUntilHits`: number of breakpoint stops to observe
 *                                           before resolving.
 *
 * @returns An object containing:
 *           - `session`: the active `DebugSession`.
 *           - `stops`  : ordered list of breakpoint stop metadata captured.
 *
 * @throws Error if the debug session fails to start, terminates prematurely,
 *         or does not hit the expected breakpoints within the timeout.
 */
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
      createDebugAdapterTracker: (s) => {
        session = s;
        const onMessageSend = async (m: any) => {
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
        };
        return { onDidSendMessage: onMessageSend };
      }
    });
  });

  const started = await vscode.debug.startDebugging(wsFolder, cfg);
  if (!started) throw new Error('Failed to start debug session');

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

/**
 * Retrieve the list of local variables for a given stack frame.
 *
 * This helper queries the Debug Adapter Protocol directly to obtain
 * the contents of the *Locals* scope for a specific frame in an active
 * debug session.
 *
 * Behavior:
 *   - Requests all scopes for the given `frameId`.
 *   - Selects the scope whose name matches `/locals?/i` if present,
 *     otherwise falls back to the first available scope.
 *   - Requests all variables from the selected scope and returns them
 *     verbatim as reported by the debugger.
 *
 * Design notes:
 *   - The function is debugger-agnostic and does not assume a fixed
 *     scope ordering or naming convention.
 *   - No filtering, flattening, or normalization is performed here;
 *     callers are expected to apply snapshot materialization separately.
 *   - Throws early if no scopes are available, as meaningful Locals
 *     inspection is impossible in that case.
 *
 * @param session Active VS Code debug session.
 * @param frameId Stack frame identifier obtained from a `stopped` event.
 * @returns       Array of debugger variables belonging to the Locals scope.
 *
 * @throws Error if no Locals scope can be identified for the frame.
 */
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

/**
 * Minimal representation of a debugger configuration snippet as declared
 * in a VS Code extension's package.json.
 *
 * This mirrors the structure used under:
 *   contributes.debuggers[].configurationSnippets[]
 *
 * Only the fields relevant for snippet-based NatVis/debug tests are modeled.
 */
interface DebugConfigurationSnippet {
  /** Optional user-visible label shown in the debug configuration picker. */
  label?: string;

  /** Optional descriptive text explaining the snippet. */
  description?: string;

  /** Debug configuration body provided by the snippet. */
  body?: vscode.DebugConfiguration;
}

/**
 * Partial representation of a debugger contribution from qt-cpp's package.json.
 *
 * This captures only the subset needed to locate and materialize
 * Qt-provided debug configuration snippets for automated tests.
 */
interface QtCppDebuggerContribution {
  /** Debugger type identifier (e.g. "cppdbg", "cppvsdbg"). */
  type?: string;

  /** Configuration snippets contributed for this debugger type. */
  configurationSnippets?: DebugConfigurationSnippet[];
}

/**
 * Minimal shape of qt-cpp's package.json relevant to debugger snippet tests.
 *
 * This interface allows tests to:
 *   - read contributed debugger entries,
 *   - locate Qt-specific debug configuration snippets,
 *   - materialize those snippets into concrete DebugConfigurations.
 *
 * It intentionally ignores all unrelated package.json fields.
 */
interface QtCppPackageJson {
  contributes?: {
    /** Debugger contributions declared by the extension. */
    debuggers?: QtCppDebuggerContribution[];
  };
}

/**
 * Unescape a VS Code snippet-encoded string.
 *
 * This helper removes snippet-specific escaping such as `^"` so the
 * resulting string matches the literal value that would be produced
 * when the snippet is expanded by VS Code.
 *
 * @param input  Raw string taken from a debugger configuration snippet.
 * @returns      Unescaped, human-readable string.
 */
function unescapeSnippetString(input: string): string {
  let s = input;

  if (s.startsWith('^"') && s.endsWith('"') && s.length >= 3) {
    s = s.slice(2, -1);
  }

  s = s.replace(/\^"/g, '"');
  return s;
}

/**
 * Normalize a debugger configuration taken from a VS Code snippet.
 *
 * This helper recursively walks the snippet `body` and unescapes all
 * snippet-encoded strings (e.g. `^"`), producing a configuration object
 * that matches what VS Code would generate after snippet expansion.
 *
 * The returned object is a deep-cloned, normalized version of the input
 * and is safe to pass directly to `startDebugging`.
 *
 * @param body  DebugConfiguration body taken from a debugger snippet.
 * @returns     Fully unescaped and normalized DebugConfiguration.
 */
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

/**
 * Minimal representation of a debugger variable as returned by DAP.
 *
 * This interface captures only the fields relevant for NatVis testing:
 *   - `name`  : fully-qualified variable name.
 *   - `type`  : debugger-reported type (optional).
 *   - `value` : raw string value as shown by the debugger (optional).
 *
 * It intentionally omits presentation and metadata fields to keep
 * snapshot materialization focused and stable.
 */
export interface DebugVariable {
  name: string;
  type?: string;
  value?: string;
}

/**
 * Names of variables whose debugger representation relies on NatVis
 * `CustomListItems` expansion (e.g. QHash/QMultiHash based containers).
 *
 * These types behave differently from most Qt containers in the DAP variable
 * tree:
 *
 *  • The first-level children are often hidden behind an intermediate
 *    `[Raw View]` node.
 *  • The actual entries (e.g. `[key]` nodes) are produced by NatVis
 *    `CustomListItems`, which are not always materialized by the debugger
 *    unless explicitly traversed.
 *
 * When walking the debugger variable tree we therefore enable a special
 * traversal mode for these roots to ensure their entries are discovered
 * and included in the runtime snapshot.
 *
 * This set identifies the root variables that require this custom handling.
 */
const QHASH_ROOTS = new Set<string>([
  'containerTypes.qHashStringInt',
  'containerTypes.qMultiHashStringInt',
  'containerTypes.qVariantHash'
]);

/**
 * Returns true if the variable corresponds exactly to one of the
 * known QHash/QMultiHash root variables that require special traversal.
 */
function isHashRoot(fullName: string): boolean {
  return QHASH_ROOTS.has(fullName);
}

/**
 * Returns true if the variable is located under a QHash/QMultiHash root.
 * This is used to keep the walker in "hash mode" while traversing the
 * subtree produced by NatVis CustomListItems.
 */
function isUnderHashRoot(fullName: string): boolean {
  for (const r of QHASH_ROOTS) {
    if (fullName === r || fullName.startsWith(r + '.')) {
      return true;
    }
  }
  return false;
}

/**
 * Minimal representation of a DAP Variable returned by the debugger
 * `variables` request. Only the fields used by the snapshot builder
 * are modeled here.
 */
type DapVariable = {
  name: string;
  value?: string;
  type?: string;
  variablesReference?: number;
};

/**
 * Minimal shape of the DAP `variables` response returned by
 * `DebugSession.customRequest('variables', ...)`.
 */
type VariablesResponse = { variables: DapVariable[] };

/**
 * Helper that issues a DAP `variables` request and returns the
 * resulting variables array.
 */
async function fetchVars(
  session: vscode.DebugSession,
  args: Record<string, unknown>
): Promise<DapVariable[]> {
  const r = (await session.customRequest(
    'variables',
    args
  )) as VariablesResponse;
  return r.variables ?? [];
}

/**
 * Default helper used to fetch the direct children of a variable
 * using its `variablesReference`.
 */
async function fetchChildrenDefault(
  session: vscode.DebugSession,
  variablesReference: number
): Promise<DapVariable[]> {
  return fetchVars(session, { variablesReference });
}

/**
 * Fetch children for QHash/QMultiHash variables whose entries are produced
 * by NatVis `CustomListItems`.
 *
 * Some debug adapters do not expose these entries through the default
 * `variables` request alone. To maximize compatibility, this helper tries
 * several access patterns:
 *
 *  1) Unfiltered request (often the only one that works)
 *  2) Indexed paging (`filter: 'indexed'`)
 *  3) Named variables (`filter: 'named'`)
 *
 * All discovered variables are aggregated and returned.
 */
async function fetchChildrenForHash(
  session: vscode.DebugSession,
  variablesReference: number
): Promise<DapVariable[]> {
  const out: DapVariable[] = [];

  // 0) Unfiltered first (often the only one that works)
  const unfiltered = await fetchVars(session, { variablesReference });
  out.push(...unfiltered);

  // 1) Best-effort indexed paging
  const PAGE = 200;
  for (let start = 0; ; start += PAGE) {
    const indexed = await fetchVars(session, {
      variablesReference,
      filter: 'indexed',
      start,
      count: PAGE
    });
    if (indexed.length === 0) break;
    out.push(...indexed);
    if (indexed.length < PAGE) break;
  }

  // 2) Best-effort named
  const named = await fetchVars(session, {
    variablesReference,
    filter: 'named'
  });
  out.push(...named);

  return out;
}

/**
 * Collects and flattens the debugger "Locals" variable tree into a list of
 * `DebugVariable` entries suitable for snapshot comparison.
 *
 * The function walks the DAP variable hierarchy recursively starting from the
 * frame's local variables and produces a flattened dotted-name representation
 * (e.g. `containerTypes.qHashStringInt.[one].value`).
 *
 * Special handling is implemented for QHash/QMultiHash containers because
 * their entries are produced by NatVis `CustomListItems`, which may appear
 * behind `[Raw View]` nodes or require alternative variable requests.
 *
 * Behavior:
 *  - Recursively traverses the debugger variable tree up to `maxDepth`.
 *  - Skips `[Raw View]` nodes in normal traversal.
 *  - For known hash roots (`QHASH_ROOTS`) it enters a special traversal mode:
 *      • `[Raw View]` nodes are traversed but not recorded.
 *      • children are fetched using `fetchChildrenForHash(...)`.
 *      • internal pointer graphs (e.g. `d`) are skipped to avoid explosion.
 *  - All visited nodes are recorded as flattened `DebugVariable` entries.
 *
 * The resulting list is later converted into a snapshot used for NatVis
 * comparison against the golden expectations.
 */
export async function getFlattenedLocals(
  session: vscode.DebugSession | undefined,
  frameId: number,
  maxDepth = 3
): Promise<DebugVariable[]> {
  if (!session) {
    throw new Error('[natvis.test] No active debug session');
  }
  const s: vscode.DebugSession = session;

  const roots = await getLocals(s, frameId);
  const acc: DebugVariable[] = [];

  async function walkVar(v: any, prefix: string, depth: number): Promise<void> {
    const fullName = prefix ? `${prefix}.${v.name}` : v.name;

    const inHash = isUnderHashRoot(fullName) || isHashRoot(fullName);
    const isRawView = v.name === '[Raw View]';

    // Default behavior unchanged: skip Raw View entirely unless we are in hash mode
    if (!inHash && isRawView) {
      return;
    }

    // Record node (unchanged), except: do not record the Raw View container in hash mode
    if (!(inHash && isRawView)) {
      acc.push({
        name: fullName,
        type: v.type,
        value: typeof v.value === 'string' ? v.value : String(v.value ?? '')
      });
    }

    if (
      !v.variablesReference ||
      v.variablesReference <= 0 ||
      depth >= maxDepth
    ) {
      return;
    }

    // Extra path only: restrict deeper expansion to the hash roots (and under them)
    // Default path continues expanding everything like before.
    if (inHash) {
      // Avoid huge internal pointer graphs under QHash
      if (v.name === 'd') {
        return;
      }

      // IMPORTANT: do not include "[Raw View]" in the dotted path
      const nextPrefix = isRawView ? prefix : fullName;

      const children = await fetchChildrenForHash(s, v.variablesReference);
      console.log(
        `[natvis.test] Fetched ${children.length} children for ${fullName} (hash mode)`
      );
      for (const child of children) {
        await walkVar(child, nextPrefix, depth + 1);
      }
      return;
    }

    // Default path (exactly like your original code)
    const children = await fetchChildrenDefault(s, v.variablesReference);
    for (const child of children) {
      await walkVar(child, fullName, depth + 1);
    }
  }

  for (const root of roots) {
    await walkVar(root, '', 0);
  }

  return acc;
}
